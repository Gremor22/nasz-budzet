"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useBudget } from "@/lib/data/budget-context";
import { getTourSteps } from "@/lib/tour/steps";
import {
  isTourCompleted,
  markTourCompleted,
} from "@/lib/tour/storage";
import type { TourStep } from "@/lib/tour/types";

interface TourContextValue {
  active: boolean;
  stepIndex: number;
  steps: TourStep[];
  currentStep: TourStep | null;
  startTour: () => void;
  skipTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { hydrated, householdId, dataSource } = useBudget();
  const includeReceipt = dataSource === "supabase";
  const steps = useMemo(
    () => getTourSteps(includeReceipt),
    [includeReceipt],
  );

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [pendingStepIndex, setPendingStepIndex] = useState<number | null>(null);
  const autoStarted = useRef(false);

  const canRunTour =
    hydrated &&
    dataSource !== "loading" &&
    pathname !== "/onboarding" &&
    pathname !== "/paragon" &&
    (dataSource === "local" || Boolean(householdId));

  const goToStep = useCallback(
    (index: number) => {
      const step = steps[index];
      if (!step) return;

      if (pathname === step.path) {
        setStepIndex(index);
        setPendingStepIndex(null);
        return;
      }

      setPendingStepIndex(index);
      router.push(step.path);
    },
    [pathname, router, steps],
  );

  const finishTour = useCallback(() => {
    markTourCompleted();
    setActive(false);
    setStepIndex(0);
    setPendingStepIndex(null);
  }, []);

  const startTour = useCallback(() => {
    setActive(true);
    setStepIndex(0);
    setPendingStepIndex(null);
    if (pathname !== steps[0]?.path) {
      router.push(steps[0]?.path ?? "/");
    }
  }, [pathname, router, steps]);

  const skipTour = useCallback(() => {
    finishTour();
  }, [finishTour]);

  const nextStep = useCallback(() => {
    if (pendingStepIndex !== null) return;
    const next = stepIndex + 1;
    if (next >= steps.length) {
      finishTour();
      return;
    }
    goToStep(next);
  }, [finishTour, goToStep, pendingStepIndex, stepIndex, steps.length]);

  const prevStep = useCallback(() => {
    if (pendingStepIndex !== null) return;
    const prev = stepIndex - 1;
    if (prev < 0) return;
    goToStep(prev);
  }, [goToStep, pendingStepIndex, stepIndex]);

  useEffect(() => {
    if (!canRunTour || autoStarted.current || isTourCompleted()) return;
    autoStarted.current = true;
    const timer = window.setTimeout(() => {
      setActive(true);
      setStepIndex(0);
      setPendingStepIndex(null);
      if (pathname !== "/") router.push("/");
    }, 900);
    return () => window.clearTimeout(timer);
  }, [canRunTour, pathname, router]);

  /** Po router.push czekamy, aż pathname = path kroku, dopiero wtedy zmieniamy indeks. */
  useEffect(() => {
    if (pendingStepIndex === null) return;
    const step = steps[pendingStepIndex];
    if (step && pathname === step.path) {
      setStepIndex(pendingStepIndex);
      setPendingStepIndex(null);
    }
  }, [pathname, pendingStepIndex, steps]);

  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  const displayIndex = pendingStepIndex ?? stepIndex;

  const value = useMemo<TourContextValue>(
    () => ({
      active,
      stepIndex: displayIndex,
      steps,
      currentStep: active ? (steps[displayIndex] ?? null) : null,
      startTour,
      skipTour,
      nextStep,
      prevStep,
    }),
    [
      active,
      displayIndex,
      nextStep,
      prevStep,
      skipTour,
      startTour,
      steps,
    ],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTour musi być wewnątrz TourProvider");
  }
  return ctx;
}
