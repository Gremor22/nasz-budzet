"use client";

import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
} from "react";
import { useBudget } from "@/lib/data/budget-context";
import { BouncingDamianHead } from "@/components/BouncingDamianHead";

const STREAK_RESET_MS = 45_000;

export function PullToRefreshDamian({ children }: { children: ReactNode }) {
  const { refresh } = useBudget();
  const startY = useRef(0);
  const pulling = useRef(false);
  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [animMode, setAnimMode] = useState<"bounce" | "nyan" | null>(null);
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
      setPullPx(Math.min(delta * 0.45, 88));
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

    const mode = streakRef.current >= 3 ? "nyan" : "bounce";
    if (streakRef.current >= 3) streakRef.current = 0;

    setPullPx(0);
    setRefreshing(true);
    setAnimMode(mode);

    try {
      await refresh();
    } finally {
      /* animacja kończy się w BouncingDamianHead */
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
          className="flex items-center justify-center overflow-hidden transition-[height] duration-150"
          style={{ height: pullPx > 0 ? pullPx : refreshing ? 48 : 0 }}
        >
          {(pullPx > 0 || refreshing) && (
            <div className="flex flex-col items-center gap-1 text-xs text-[var(--ink-muted)]">
              <div
                className="h-10 w-10 overflow-hidden rounded-full border-2 border-[var(--accent)] bg-white shadow"
                style={{
                  transform: `translateY(${Math.min(pullPx * 0.2, 12)}px) rotate(${pullPx * 2}deg)`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/damian-head.png"
                  alt=""
                  className="h-full w-full object-cover object-[center_18%] scale-125"
                />
              </div>
              {pullPx >= 56 ? "Puść — odświeżam" : "Ciągnij w dół…"}
            </div>
          )}
        </div>
        {children}
      </div>
      {animMode && (
        <BouncingDamianHead
          mode={animMode}
          onDone={() => {
            setAnimMode(null);
            setRefreshing(false);
          }}
        />
      )}
    </>
  );
}
