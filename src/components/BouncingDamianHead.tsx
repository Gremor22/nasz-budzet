"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

type Mode = "bounce" | "nyan";

/** Głowa Damiana odbijająca się jak wygaszacz DVD. */
export function BouncingDamianHead({
  mode,
  onDone,
}: {
  mode: Mode;
  onDone?: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const box = boxRef.current;
    const head = headRef.current;
    if (!box || !head) return;

    const headSize = mode === "nyan" ? 72 : 64;
    let x = 40;
    let y = 60;
    let vx = 2.4;
    let vy = 1.8;
    let frames = 0;
    const maxFrames = mode === "nyan" ? 420 : 280;

    const tick = () => {
      frames += 1;
      const bw = box.clientWidth;
      const bh = box.clientHeight;
      x += vx;
      y += vy;
      if (x <= 0 || x + headSize >= bw) vx *= -1;
      if (y <= 0 || y + headSize >= bh) vy *= -1;
      head.style.transform = `translate(${x}px, ${y}px)`;
      if (frames >= maxFrames) {
        onDone?.();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mode, onDone]);

  return (
    <div
      ref={boxRef}
      className="pointer-events-none fixed inset-0 z-[100] bg-black/25"
      aria-hidden
    >
      {mode === "nyan" && (
        <div className="absolute inset-0 overflow-hidden opacity-90">
          <div className="nyan-rainbow absolute inset-0" />
        </div>
      )}
      <div ref={headRef} className="absolute left-0 top-0 will-change-transform">
        <div
          className={`relative overflow-hidden rounded-full border-2 border-white shadow-lg ${
            mode === "nyan" ? "h-[72px] w-[72px] animate-pulse" : "h-16 w-16"
          }`}
        >
          <Image
            src="/damian-head.png"
            alt=""
            width={160}
            height={160}
            className="h-full w-full object-cover object-[center_18%] scale-125"
            priority
          />
        </div>
        {mode === "nyan" && (
          <span className="absolute -right-2 top-1/2 -translate-y-1/2 text-2xl animate-bounce">
            🌈
          </span>
        )}
      </div>
    </div>
  );
}
