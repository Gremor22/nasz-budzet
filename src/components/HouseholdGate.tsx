"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useBudget } from "@/lib/data/budget-context";

const SETUP_PATHS = ["/onboarding", "/start"];

/**
 * Gospodarstwo → prosty start (2 pytania) → reszta aplikacji.
 */
export function HouseholdGate({ children }: { children: React.ReactNode }) {
  const { hydrated, dataSource, householdId, state, error } = useBudget();
  const router = useRouter();
  const pathname = usePathname();
  const needsSetup =
    dataSource === "supabase" &&
    Boolean(householdId) &&
    !state.household.initialSetupDone;

  useEffect(() => {
    if (!hydrated) return;
    if (dataSource === "supabase" && !householdId && pathname !== "/onboarding") {
      router.replace("/onboarding");
      return;
    }
    if (dataSource === "supabase" && householdId && pathname === "/onboarding") {
      router.replace(needsSetup ? "/start" : "/");
      return;
    }
    if (needsSetup && !SETUP_PATHS.includes(pathname)) {
      router.replace("/start");
      return;
    }
    if (!needsSetup && pathname === "/start") {
      router.replace("/");
    }
  }, [hydrated, dataSource, householdId, pathname, router, needsSetup]);

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
          Sprawdź migracje SQL w Supabase (w tym{" "}
          <code className="text-xs">20260721150000_simple_setup.sql</code>).
        </p>
      </div>
    );
  }

  if (dataSource === "supabase" && !householdId && pathname !== "/onboarding") {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-[var(--ink-muted)]">
        Przekierowanie…
      </div>
    );
  }

  if (needsSetup && !SETUP_PATHS.includes(pathname)) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-[var(--ink-muted)]">
        Przekierowanie do szybkiego startu…
      </div>
    );
  }

  return <>{children}</>;
}
