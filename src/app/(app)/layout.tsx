"use client";

import { BudgetProvider, useBudget } from "@/lib/data/budget-context";
import { BottomNav } from "@/components/BottomNav";
import { HouseholdGate } from "@/components/HouseholdGate";
import { ProductTour } from "@/components/ProductTour";
import { TourProvider } from "@/lib/tour/context";
import { usePathname } from "next/navigation";

function AppShell({ children }: { children: React.ReactNode }) {
  const { householdId, dataSource, hydrated } = useBudget();
  const pathname = usePathname();
  const onOnboarding = pathname === "/onboarding" || pathname === "/start";
  const showNav =
    hydrated &&
    !(dataSource === "supabase" && (!householdId || onOnboarding));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col pt-[env(safe-area-inset-top)]">
      <main
        className={`flex-1 px-4 pt-4 ${
          showNav
            ? "pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
            : "pb-[calc(2rem+env(safe-area-inset-bottom))]"
        }`}
      >
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
        <TourProvider>
          <AppShell>{children}</AppShell>
          <ProductTour />
        </TourProvider>
      </HouseholdGate>
    </BudgetProvider>
  );
}
