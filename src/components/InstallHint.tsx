"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "nasz-budzet-install-hint-dismissed";

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome/.test(ua);
  return isIos && isSafari;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const legacy = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mq || legacy;
}

/**
 * Instrukcja instalacji — tylko Safari na iPhonie, gdy nie jesteśmy w standalone.
 */
export function InstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    if (isIosSafari() && !isStandalone()) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] px-3 pt-[max(0.5rem,env(safe-area-inset-top))]"
      role="status"
    >
      <div className="mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-3 shadow-md">
        <div className="min-w-0 flex-1 text-sm leading-relaxed">
          <p className="font-semibold">Dodaj do ekranu początkowego</p>
          <p className="mt-1 text-[var(--ink-muted)]">
            W Safari stuknij przycisk <strong>Udostępnij</strong> (kwadrat ze
            strzałką), a potem <strong>Dodaj do ekranu początkowego</strong>.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg px-2 py-1 text-sm text-[var(--ink-muted)]"
          aria-label="Zamknij podpowiedź"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* ignore */
            }
            setVisible(false);
          }}
        >
          Zamknij
        </button>
      </div>
    </div>
  );
}
