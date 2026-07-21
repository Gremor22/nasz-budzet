"use client";

import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
} from "react";
import { useBudget } from "@/lib/data/budget-context";

const STREAK_RESET_MS = 60_000;
const EASTER_EGG_AT = 5;

/** Pull-to-refresh — easter egg (Nyan Cat) dopiero po 5. odświeżeniu z rzędu. */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const { refresh } = useBudget();
  const startY = useRef(0);
  const pulling = useRef(false);
  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showNyan, setShowNyan] = useState(false);
  const streakRef = useRef(0);
  const lastPullAt = useRef(0);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY > 4) return;
    startY.current = e.touches[0]?.clientY ?? 0;
    pulling.current = true;
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current || refreshing) return;
    const y = e.touches[0]?.clientY ?? 0;
    const delta = Math.max(0, y - startY.current);
    if (delta > 0 && window.scrollY <= 4) {
      setPullPx(Math.min(delta * 0.45, 72));
    }
  }, [refreshing]);

  const finishPull = useCallback(async () => {
    pulling.current = false;
    if (pullPx < 56 || refreshing) {
      setPullPx(0);
      return;
    }

    const now = Date.now();
    if (now - lastPullAt.current > STREAK_RESET_MS) {
      streakRef.current = 0;
    }
    lastPullAt.current = now;
    streakRef.current += 1;

    const triggerEgg = streakRef.current >= EASTER_EGG_AT;
    if (triggerEgg) streakRef.current = 0;

    setPullPx(0);
    setRefreshing(true);

    try {
      await refresh();
    } finally {
      setRefreshing(false);
      if (triggerEgg) {
        setShowNyan(true);
        window.setTimeout(() => setShowNyan(false), 3200);
      }
    }
  }, [pullPx, refresh, refreshing]);

  const onTouchEnd = useCallback(() => {
    void finishPull();
  }, [finishPull]);

  return (
    <>
      <div
        className="relative"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex items-center justify-center overflow-hidden text-xs text-[var(--ink-muted)] transition-[height] duration-150"
          style={{ height: pullPx > 0 ? pullPx : refreshing ? 32 : 0 }}
        >
          {(pullPx > 0 || refreshing) && (
            <span>{refreshing ? "Odświeżam…" : pullPx >= 56 ? "Puść" : "Ciągnij w dół…"}</span>
          )}
        </div>
        {children}
      </div>
      {showNyan && (
        <div
          className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/nyan-cat.gif"
            alt=""
            className="max-w-[min(92vw,360px)] animate-pulse drop-shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
