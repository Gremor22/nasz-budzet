"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  addTransaction,
  budgetRepository,
  setForecastMode,
  setHorizonDays,
  setSafetyBuffer,
} from "@/lib/data/repository";
import { createDemoState } from "@/lib/data/demo-data";
import type {
  BudgetState,
  ForecastMode,
  Transaction,
} from "@/lib/data/types";
import { computeForecast } from "@/lib/forecast/engine";
import type { ForecastResult } from "@/lib/data/types";

interface BudgetContextValue {
  state: BudgetState;
  forecast: ForecastResult;
  hydrated: boolean;
  addExpense: (
    input: Omit<Transaction, "id" | "createdAt" | "updatedAt" | "type"> & {
      type?: "expense";
    },
  ) => void;
  addIncome: (
    input: Omit<Transaction, "id" | "createdAt" | "updatedAt" | "type"> & {
      type?: "income";
    },
  ) => void;
  changeMode: (mode: ForecastMode) => void;
  changeHorizon: (days: number) => void;
  changeBufferZl: (zl: number) => void;
  resetDemo: () => void;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

export function BudgetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BudgetState>(() => createDemoState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = budgetRepository.load();
    setState(loaded);
    setHydrated(true);
  }, []);

  const persist = useCallback((next: BudgetState) => {
    setState(next);
    budgetRepository.save(next);
  }, []);

  const forecast = useMemo(() => computeForecast(state), [state]);

  const value: BudgetContextValue = {
    state,
    forecast,
    hydrated,
    addExpense: (input) => {
      persist(
        addTransaction(state, {
          ...input,
          type: "expense",
        }),
      );
    },
    addIncome: (input) => {
      persist(
        addTransaction(state, {
          ...input,
          type: "income",
        }),
      );
    },
    changeMode: (mode) => persist(setForecastMode(state, mode)),
    changeHorizon: (days) => persist(setHorizonDays(state, days)),
    changeBufferZl: (zl) =>
      persist(setSafetyBuffer(state, Math.round(zl * 100))),
    resetDemo: () => persist(budgetRepository.resetDemo()),
  };

  return (
    <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>
  );
}

export function useBudget(): BudgetContextValue {
  const ctx = useContext(BudgetContext);
  if (!ctx) {
    throw new Error("useBudget musi być użyty wewnątrz BudgetProvider");
  }
  return ctx;
}
