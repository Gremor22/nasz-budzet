"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

/**
 * Easter egg: Nyan Cat z głową Damiana zamiast kota —
 * lata po ekranie jak opętany (losowe odbicia + szarpnięcia).
 */
export function PossessedNyanDamian({ onDone }: { onDone?: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const box = boxRef.current;
    const sprite = spriteRef.current;
    if (!box || !sprite) return;

    const w = 168;
    const h = 100;
    let x = Math.random() * 80 + 20;
    let y = Math.random() * 120 + 40;
    let vx = 4.2 + Math.random() * 2.5;
    let vy = 3.1 + Math.random() * 2.2;
    if (Math.random() > 0.5) vx *= -1;
    if (Math.random() > 0.5) vy *= -1;
    let frames = 0;
    const maxFrames = 480; // ~8s

    const tick = () => {
      frames += 1;
      const bw = box.clientWidth;
      const bh = box.clientHeight;

      // Losowe „opętane” szarpnięcia co ~0.5–1s
      if (frames % 36 === 0) {
        vx += (Math.random() - 0.5) * 5;
        vy += (Math.random() - 0.5) * 5;
        const speed = Math.hypot(vx, vy);
        if (speed < 3.5) {
          const scale = 4 / Math.max(speed, 0.1);
          vx *= scale;
          vy *= scale;
        }
        if (speed > 11) {
          vx *= 0.7;
          vy *= 0.7;
        }
      }

      x += vx;
      y += vy;

      if (x <= 0) {
        x = 0;
        vx = Math.abs(vx) + Math.random() * 1.5;
      } else if (x + w >= bw) {
        x = bw - w;
        vx = -(Math.abs(vx) + Math.random() * 1.5);
      }
      if (y <= 0) {
        y = 0;
        vy = Math.abs(vy) + Math.random() * 1.5;
      } else if (y + h >= bh) {
        y = bh - h;
        vy = -(Math.abs(vy) + Math.random() * 1.5);
      }

      const flip = vx < 0 ? -1 : 1;
      const wobble = Math.sin(frames / 4) * 8;
      sprite.style.transform = `translate(${x}px, ${y}px) scaleX(${flip}) rotate(${wobble}deg)`;

      if (frames >= maxFrames) {
        onDone?.();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [onDone]);

  return (
    <div
      ref={boxRef}
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden bg-black/35"
      aria-hidden
    >
      <div className="nyan-rainbow absolute inset-0 opacity-40" />
      <div
        ref={spriteRef}
        className="absolute left-0 top-0 will-change-transform"
        style={{ width: 168, height: 100 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/nyan-cat.gif"
          alt=""
          className="h-full w-full object-contain drop-shadow-2xl"
          draggable={false}
        />
        {/* Głowa Damiana zamiast głowy kota (po prawej stronie sprite’a Nyan) */}
        <div className="absolute right-[6%] top-[-6%] h-14 w-14 overflow-hidden rounded-full border-2 border-white shadow-lg">
          <Image
            src="/damian-head.png"
            alt=""
            width={112}
            height={112}
            className="h-full w-full object-cover object-[center_18%] scale-125"
            priority
          />
        </div>
      </div>
    </div>
  );
}
