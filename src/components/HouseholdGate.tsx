"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useBudget } from "@/lib/data/budget-context";

/**
 * Gdy użytkownik jest zalogowany w Supabase, ale nie ma gospodarstwa,
 * kierujemy na ekran onboarding.
 */
export function HouseholdGate({ children }: { children: React.ReactNode }) {
  const { hydrated, dataSource, householdId, error } = useBudget();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!hydrated) return;
    if (dataSource === "supabase" && !householdId && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
    if (dataSource === "supabase" && householdId && pathname === "/onboarding") {
      router.replace("/");
    }
  }, [hydrated, dataSource, householdId, pathname, router]);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-[var(--ink-muted)]">
        Ładowanie…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <p className="rounded-xl bg-[#fde8e8] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
        <p className="mt-3 text-sm text-[var(--ink-muted)]">
          Sprawdź, czy wkleiłeś migrację SQL i klucze w `.env.local`.
        </p>
      </div>
    );
  }

  if (dataSource === "supabase" && !householdId && pathname !== "/onboarding") {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-[var(--ink-muted)]">
        Przekierowanie do konfiguracji gospodarstwa…
      </div>
    );
  }

  return <>{children}</>;
}
