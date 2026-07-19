"use client";

import { BudgetProvider } from "@/lib/data/budget-context";
import { BottomNav } from "@/components/BottomNav";
import { HouseholdGate } from "@/components/HouseholdGate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <BudgetProvider>
      <HouseholdGate>
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
          <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
          <BottomNav />
        </div>
      </HouseholdGate>
    </BudgetProvider>
  );
}
