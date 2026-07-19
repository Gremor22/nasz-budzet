"use client";

import { useEffect, useState } from "react";

/**
 * Prosty komunikat offline — bez cache’owania całej aplikacji.
 * U góry, żeby nie kolidował z dolną nawigacją.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    function sync() {
      setOffline(!navigator.onLine);
    }
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[65] px-3 pt-[max(0.5rem,env(safe-area-inset-top))]"
      role="alert"
    >
      <div className="mx-auto max-w-md rounded-2xl bg-[#5a6b61] px-4 py-2.5 text-center text-sm text-white shadow-md">
        Brak internetu — logowanie i zapis danych wymagają połączenia.
      </div>
    </div>
  );
}
