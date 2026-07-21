"use client";

import { BudgetProvider, useBudget } from "@/lib/data/budget-context";
import { AppFooter } from "@/components/AppFooter";
import { PullToRefresh } from "@/components/PullToRefresh";
import { BottomNav } from "@/components/BottomNav";
import { HouseholdGate } from "@/components/HouseholdGate";
import { ProductTour } from "@/components/ProductTour";
import { TourProvider } from "@/lib/tour/context";
import { ThemeProvider } from "@/lib/theme/context";
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
        className={`min-w-0 flex-1 overflow-x-hidden px-4 pt-4 ${
          showNav
            ? "pb-[calc(9.5rem+env(safe-area-inset-bottom))]"
            : "pb-[calc(2rem+env(safe-area-inset-bottom))]"
        }`}
        style={
          showNav
            ? {
                scrollPaddingBottom:
                  "calc(9.5rem + env(safe-area-inset-bottom))",
              }
            : undefined
        }
      >
        <PullToRefresh>
          {children}
          <AppFooter />
        </PullToRefresh>
      </main>
      {showNav ? <BottomNav /> : null}
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <BudgetProvider>
        <HouseholdGate>
          <TourProvider>
            <AppShell>{children}</AppShell>
            <ProductTour />
          </TourProvider>
        </HouseholdGate>
      </BudgetProvider>
    </ThemeProvider>
  );
}
