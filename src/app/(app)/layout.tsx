"use client";

import { BudgetProvider, useBudget } from "@/lib/data/budget-context";
import { BottomNav } from "@/components/BottomNav";
import { HouseholdGate } from "@/components/HouseholdGate";
import { usePathname } from "next/navigation";

function AppShell({ children }: { children: React.ReactNode }) {
  const { householdId, dataSource, hydrated } = useBudget();
  const pathname = usePathname();
  const onOnboarding = pathname === "/onboarding";
  const showNav =
    hydrated &&
    !(dataSource === "supabase" && (!householdId || onOnboarding));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <main className={`flex-1 px-4 pt-4 ${showNav ? "pb-28" : "pb-8"}`}>
        {children}
      </main>
      {showNav ? <BottomNav /> : null}
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <BudgetProvider>
      <HouseholdGate>
        <AppShell>{children}</AppShell>
      </HouseholdGate>
    </BudgetProvider>
  );
}
