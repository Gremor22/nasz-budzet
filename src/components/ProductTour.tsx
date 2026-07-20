"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTour } from "@/lib/tour/context";
import { waitForElement } from "@/lib/tour/wait-for-element";
import type { TourPlacement } from "@/lib/tour/types";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 10;
const GAP = 14;
const VIEWPORT_PAD = 16;

function measureTarget(targetId: string): Rect | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${targetId}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  };
}

function safeTop(): number {
  return VIEWPORT_PAD;
}

function safeBottom(viewportH: number): number {
  return viewportH - VIEWPORT_PAD;
}

/** Wybiera top/bottom tak, żeby dymek zmieścił się w oknie. */
function resolveVerticalPlacement(
  rect: Rect,
  preferred: TourPlacement,
  popoverH: number,
): "top" | "bottom" {
  if (preferred !== "top" && preferred !== "bottom") return "bottom";

  const spaceBelow = safeBottom(window.innerHeight) - (rect.top + rect.height);
  const spaceAbove = rect.top - safeTop();

  if (preferred === "bottom") {
    if (spaceBelow >= popoverH + GAP) return "bottom";
    if (spaceAbove >= popoverH + GAP) return "top";
    return spaceBelow >= spaceAbove ? "bottom" : "top";
  }

  if (spaceAbove >= popoverH + GAP) return "top";
  if (spaceBelow >= popoverH + GAP) return "bottom";
  return spaceAbove >= spaceBelow ? "top" : "bottom";
}

function buildPopoverStyle(
  rect: Rect | null,
  preferred: TourPlacement,
  popoverH: number,
): { style: CSSProperties; placement: TourPlacement } {
  const maxW = Math.min(320, window.innerWidth - 32);
  const centerLeft = Math.min(
    Math.max(VIEWPORT_PAD, rect ? rect.left + rect.width / 2 - maxW / 2 : VIEWPORT_PAD),
    window.innerWidth - maxW - VIEWPORT_PAD,
  );

  if (!rect || preferred === "center") {
    return {
      placement: "center",
      style: {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        maxWidth: "min(22rem, calc(100vw - 2rem))",
        maxHeight: `calc(100dvh - ${VIEWPORT_PAD * 2}px)`,
        overflowY: "auto",
      },
    };
  }

  const vertical = resolveVerticalPlacement(rect, preferred, popoverH);
  const maxHeight = `calc(100dvh - ${VIEWPORT_PAD * 2}px)`;

  if (vertical === "bottom") {
    let top = rect.top + rect.height + GAP;
    const maxTop = safeBottom(window.innerHeight) - popoverH;
    top = Math.min(Math.max(top, safeTop()), Math.max(safeTop(), maxTop));
    return {
      placement: "bottom",
      style: {
        top,
        left: centerLeft,
        maxWidth: maxW,
        maxHeight,
        overflowY: "auto",
      },
    };
  }

  let bottom = window.innerHeight - rect.top + GAP;
  const minBottom = VIEWPORT_PAD;
  const maxBottom = window.innerHeight - safeTop() - popoverH;
  bottom = Math.min(Math.max(bottom, minBottom), Math.max(minBottom, maxBottom));

  return {
    placement: "top",
    style: {
      bottom,
      left: centerLeft,
      maxWidth: maxW,
      maxHeight,
      overflowY: "auto",
    },
  };
}

export function ProductTour() {
  const {
    active,
    currentStep,
    stepIndex,
    steps,
    nextStep,
    prevStep,
    skipTour,
  } = useTour();
  const [rect, setRect] = useState<Rect | null>(null);
  const [resolvedPlacement, setResolvedPlacement] =
    useState<TourPlacement>("center");
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const popoverRef = useRef<HTMLDivElement>(null);

  const refreshRect = useCallback(async () => {
    if (!currentStep?.target) {
      setRect(null);
      return;
    }
    await waitForElement(currentStep.target);
    const el = document.querySelector<HTMLElement>(
      `[data-tour="${currentStep.target}"]`,
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    setRect(measureTarget(currentStep.target));
  }, [currentStep]);

  const layoutPopover = useCallback(() => {
    if (!currentStep) return;
    const popoverH = popoverRef.current?.offsetHeight ?? 280;
    const { style, placement } = buildPopoverStyle(
      rect,
      currentStep.placement,
      popoverH,
    );
    setPopoverStyle(style);
    setResolvedPlacement(placement);
  }, [currentStep, rect]);

  useLayoutEffect(() => {
    if (!active || !currentStep) return;
    void refreshRect();
  }, [active, currentStep, refreshRect, stepIndex]);

  useLayoutEffect(() => {
    layoutPopover();
  }, [layoutPopover, stepIndex, currentStep?.id]);

  useEffect(() => {
    if (!active) return;
    const onResize = () => {
      void refreshRect();
      layoutPopover();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [active, layoutPopover, refreshRect]);

  if (!active || !currentStep) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const showSpotlight = Boolean(currentStep.target && rect);

  return (
    <div
      className="fixed inset-0 z-[200] pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      <div className="absolute inset-0" aria-hidden />

      {!showSpotlight && (
        <div className="absolute inset-0 bg-black/55" aria-hidden />
      )}

      {showSpotlight && rect && (
        <>
          <div
            className="pointer-events-none absolute rounded-2xl ring-4 ring-[var(--accent)] ring-offset-2 ring-offset-transparent"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
            }}
          />
          <TourArrow placement={resolvedPlacement} rect={rect} />
        </>
      )}

      <div
        ref={popoverRef}
        className="pointer-events-auto fixed z-[201] rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-xl"
        style={popoverStyle}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
          Krok {stepIndex + 1} z {steps.length}
        </p>
        <h2 id="tour-title" className="mt-1 text-lg font-semibold">
          {currentStep.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
          {currentStep.body}
        </p>
        {currentStep.example && (
          <p className="mt-2 rounded-xl bg-[var(--bg-accent)] px-3 py-2 text-sm text-[var(--ink)]">
            <span className="font-medium">Przykład: </span>
            {currentStep.example}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!isFirst && (
            <button
              type="button"
              className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
              onClick={prevStep}
            >
              Wstecz
            </button>
          )}
          <button
            type="button"
            className="flex-1 rounded-xl bg-[var(--accent)] px-3 py-2.5 text-sm font-medium text-white"
            onClick={isLast ? skipTour : nextStep}
          >
            {isLast ? "Zakończ" : "Dalej →"}
          </button>
        </div>
        {!isLast && (
          <button
            type="button"
            className="mt-3 w-full text-center text-xs text-[var(--ink-muted)] underline"
            onClick={skipTour}
          >
            Pomiń przewodnik
          </button>
        )}
      </div>
    </div>
  );
}

function TourArrow({
  placement,
  rect,
}: {
  placement: TourPlacement;
  rect: Rect;
}) {
  if (placement === "center") return null;

  const size = 10;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  let style: CSSProperties = {};
  if (placement === "bottom") {
    style = { top: rect.top + rect.height + 4, left: cx - size };
  } else if (placement === "top") {
    style = { top: rect.top - size * 2 - 4, left: cx - size };
  } else if (placement === "right") {
    style = { top: cy - size, left: rect.left + rect.width + 4 };
  } else if (placement === "left") {
    style = { top: cy - size, left: rect.left - size * 2 - 4 };
  }

  const rotateDeg =
    placement === "bottom"
      ? 45
      : placement === "top"
        ? 225
        : placement === "right"
          ? 135
          : -45;

  return (
    <div
      className="pointer-events-none absolute z-[201] h-3 w-3 border-l border-t border-[var(--line)] bg-[var(--card)]"
      style={{ ...style, transform: `rotate(${rotateDeg}deg)` }}
      aria-hidden
    />
  );
}
