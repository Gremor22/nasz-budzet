"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { createDemoState } from "@/lib/data/demo-data";
import {
  SupabaseBudgetRepository,
  type AccountInput,
  type IncomeSourceInput,
  type RecurringBillInput,
  type SavingsGoalInput,
} from "@/lib/data/supabase-repository";
import type {
  BudgetState,
  ForecastMode,
  ForecastResult,
  Transaction,
} from "@/lib/data/types";
import { computeForecast } from "@/lib/forecast/engine";
import {
  applyIncomeSourceSync,
  incomeSourceSyncChanged,
} from "@/lib/income/sync-source-transactions";
import { todayIsoWarsaw } from "@/lib/dates/today";
import { nextMonthlyPayDate } from "@/lib/dates/pay-day";
import type { SimpleSetupInput } from "@/lib/data/simple-setup";

type DataSource = "local" | "supabase" | "loading";

interface BudgetContextValue {
  state: BudgetState;
  forecast: ForecastResult;
  hydrated: boolean;
  dataSource: DataSource;
  householdId: string | null;
  userEmail: string | null;
  error: string | null;
  refresh: () => Promise<void>;
  addExpense: (
    input: Omit<Transaction, "id" | "createdAt" | "updatedAt" | "type">,
  ) => Promise<string>;
  addIncome: (
    input: Omit<Transaction, "id" | "createdAt" | "updatedAt" | "type">,
  ) => Promise<string>;
  removeTransaction: (id: string) => Promise<void>;
  completeSimpleSetup: (input: import("@/lib/data/simple-setup").SimpleSetupInput) => Promise<void>;
  resetHouseholdBudget: () => Promise<void>;
  changeMode: (mode: ForecastMode) => Promise<void>;
  changeHorizon: (days: number) => Promise<void>;
  changeBufferZl: (zl: number) => Promise<void>;
  saveAccount: (input: AccountInput & { id?: string }) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
  saveIncomeSource: (input: IncomeSourceInput & { id?: string }) => Promise<void>;
  removeIncomeSource: (id: string) => Promise<void>;
  saveRecurringBill: (
    input: RecurringBillInput & { id?: string },
  ) => Promise<void>;
  removeRecurringBill: (id: string) => Promise<void>;
  setGoalReserved: (id: string, reserved: boolean) => Promise<void>;
  saveSavingsGoal: (input: SavingsGoalInput & { id?: string }) => Promise<void>;
  removeSavingsGoal: (id: string) => Promise<void>;
  createInviteCode: () => Promise<string>;
  signOut: () => Promise<void>;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function BudgetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BudgetState>(() => createDemoState());
  const [hydrated, setHydrated] = useState(false);
  const [dataSource, setDataSource] = useState<DataSource>("loading");
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshInFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    // Jedna synchronizacja naraz — bez wyścigów = bez potrójnej pensji
    if (refreshInFlight.current) {
      await refreshInFlight.current;
      return;
    }

    const run = (async () => {
      setError(null);

      if (!hasSupabaseEnv()) {
        setDataSource("local");
        setHouseholdId(null);
        setUserEmail(null);
        setState(createDemoState());
        setHydrated(true);
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setDataSource("local");
        setHouseholdId(null);
        setUserEmail(null);
        setHydrated(true);
        return;
      }

      setUserEmail(user.email ?? null);

      const { data: membership, error: memErr } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (memErr) {
        setError(memErr.message);
        setHydrated(true);
        return;
      }

      if (!membership) {
        setHouseholdId(null);
        setDataSource("supabase");
        setHydrated(true);
        return;
      }

      try {
        const repo = new SupabaseBudgetRepository(
          supabase,
          membership.household_id,
        );
        const loaded = await repo.load();
        loaded.settings.asOfDate = todayIsoWarsaw();
        await repo.purgeDemoData();
        try {
          await repo.ensureBudgetStartedDate();
        } catch {
          /* kolumna budget_started_date — uruchom migrację SQL */
        }
        const fresh = await repo.load();
        fresh.settings.asOfDate = todayIsoWarsaw();
        const synced = applyIncomeSourceSync(fresh);
        if (incomeSourceSyncChanged(fresh, synced)) {
          await repo.persistIncomeSourceSync(fresh, synced);
        }
        setState(synced);
        setHouseholdId(membership.household_id);
        setDataSource("supabase");
        setHydrated(true);
      } catch (e) {
        setHouseholdId(membership.household_id);
        setDataSource("supabase");
        setError(e instanceof Error ? e.message : "Błąd wczytywania danych");
        setHydrated(true);
      }
    })();

    refreshInFlight.current = run;
    try {
      await run;
    } finally {
      refreshInFlight.current = null;
    }
  }, []);

  useEffect(() => {
    void refresh().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : "Błąd ładowania");
      setHydrated(true);
    });
  }, [refresh]);

  const forecast = useMemo(() => computeForecast(state), [state]);

  const withRepo = useCallback(async () => {
    if (!hasSupabaseEnv() || !householdId) return null;
    return new SupabaseBudgetRepository(createClient(), householdId);
  }, [householdId]);

  const value: BudgetContextValue = {
    state,
    forecast,
    hydrated,
    dataSource,
    householdId,
    userEmail,
    error,
    refresh,
    addExpense: async (input) => {
      const repo = await withRepo();
      if (!repo) {
        const now = new Date().toISOString();
        const id = `tx-${crypto.randomUUID()}`;
        setState((prev) => ({
          ...prev,
          transactions: [
            {
              ...input,
              type: "expense",
              id,
              createdAt: now,
              updatedAt: now,
            },
            ...prev.transactions,
          ],
        }));
        return id;
      }
      const id = await repo.addTransaction({ ...input, type: "expense" });
      await refresh();
      return id;
    },
    addIncome: async (input) => {
      const repo = await withRepo();
      if (!repo) {
        const now = new Date().toISOString();
        const id = `tx-${crypto.randomUUID()}`;
        setState((prev) => ({
          ...prev,
          transactions: [
            {
              ...input,
              type: "income",
              id,
              createdAt: now,
              updatedAt: now,
            },
            ...prev.transactions,
          ],
        }));
        return id;
      }
      const id = await repo.addTransaction({ ...input, type: "income" });
      await refresh();
      return id;
    },
    removeTransaction: async (id) => {
      const repo = await withRepo();
      if (!repo) {
        setState((prev) => ({
          ...prev,
          transactions: prev.transactions.filter((tx) => tx.id !== id),
        }));
        return;
      }
      await repo.deleteTransaction(id);
      await refresh();
    },
    completeSimpleSetup: async (input: SimpleSetupInput) => {
      const repo = await withRepo();
      if (!repo) {
        const day = input.incomeDayOfMonth ?? 1;
        setState((prev) => {
          const mainId = prev.accounts[0]?.id ?? "acc-main";
          const accounts =
            prev.accounts.length > 0
              ? prev.accounts.map((a, i) =>
                  i === 0
                    ? {
                        ...a,
                        name: "Główne konto",
                        openingBalanceGrosze: input.balanceGrosze,
                      }
                    : a,
                )
              : [
                  {
                    id: mainId,
                    name: "Główne konto",
                    owner: "shared" as const,
                    type: "shared" as const,
                    openingBalanceGrosze: input.balanceGrosze,
                    includeInBudget: true,
                    active: true,
                  },
                ];
          const incomeSources =
            input.incomeName?.trim() &&
            input.incomeAmountGrosze &&
            input.incomeAmountGrosze > 0
              ? [
                  {
                    id: `inc-${crypto.randomUUID()}`,
                    name: input.incomeName.trim(),
                    owner: "pawel" as const,
                    typicalAmountGrosze: input.incomeAmountGrosze,
                    safeAmountGrosze: input.incomeAmountGrosze,
                    frequency: "monthly_on_day" as const,
                    dayOfMonth: day,
                    nextOccurrenceDate: nextMonthlyPayDate(day),
                    confidence: "expected" as const,
                    active: true,
                  },
                ]
              : prev.incomeSources;
          return applyIncomeSourceSync({
            ...prev,
            accounts,
            incomeSources,
            transactions: [],
            recurringBills: [],
            savingsGoals: [],
            household: {
              ...prev.household,
              initialSetupDone: true,
              budgetStartedDate: `${todayIsoWarsaw().slice(0, 7)}-01`,
            },
          });
        });
        return;
      }
      await repo.completeSimpleSetup(input);
      await refresh();
    },
    resetHouseholdBudget: async () => {
      const repo = await withRepo();
      if (!repo) {
        const fresh = createDemoState();
        setState({
          ...fresh,
          household: { ...fresh.household, initialSetupDone: false },
          accounts: [
            {
              id: "acc-main",
              name: "Główne konto",
              owner: "shared",
              type: "shared",
              openingBalanceGrosze: 0,
              includeInBudget: true,
              active: true,
            },
          ],
          incomeSources: [],
          recurringBills: [],
          transactions: [],
          savingsGoals: [],
        });
        return;
      }
      await repo.resetHouseholdBudget();
      await refresh();
    },
    changeMode: async (mode) => {
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, forecastMode: mode },
        household: { ...prev.household, defaultForecastMode: mode },
      }));
      const repo = await withRepo();
      if (repo) await repo.updateHouseholdSettings({ forecastMode: mode });
    },
    changeHorizon: async (days) => {
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, horizonDays: days },
        household: { ...prev.household, defaultHorizonDays: days },
      }));
      const repo = await withRepo();
      if (repo) await repo.updateHouseholdSettings({ horizonDays: days });
    },
    changeBufferZl: async (zl) => {
      const grosze = Math.max(0, Math.round(zl * 100));
      setState((prev) => ({
        ...prev,
        household: { ...prev.household, safetyBufferGrosze: grosze },
      }));
      const repo = await withRepo();
      if (repo) await repo.updateHouseholdSettings({ safetyBufferGrosze: grosze });
    },
    saveAccount: async (input) => {
      const repo = await withRepo();
      if (!repo) {
        setState((prev) => {
          if (input.id) {
            return {
              ...prev,
              accounts: prev.accounts.map((a) =>
                a.id === input.id ? { ...a, ...input, id: input.id } : a,
              ),
            };
          }
          return {
            ...prev,
            accounts: [
              ...prev.accounts,
              { ...input, id: `acc-${crypto.randomUUID()}` },
            ],
          };
        });
        return;
      }
      await repo.upsertAccount(input);
      await refresh();
    },
    removeAccount: async (id) => {
      const repo = await withRepo();
      if (!repo) {
        setState((prev) => ({
          ...prev,
          accounts: prev.accounts.filter((a) => a.id !== id),
        }));
        return;
      }
      await repo.deleteAccount(id);
      await refresh();
    },
    saveIncomeSource: async (input) => {
      const repo = await withRepo();
      if (!repo) {
        setState((prev) => {
          let next: BudgetState;
          if (input.id) {
            next = {
              ...prev,
              incomeSources: prev.incomeSources.map((s) =>
                s.id === input.id ? { ...s, ...input, id: input.id } : s,
              ),
            };
          } else {
            next = {
              ...prev,
              incomeSources: [
                ...prev.incomeSources,
                { ...input, id: `inc-${crypto.randomUUID()}` },
              ],
            };
          }
          return applyIncomeSourceSync(next);
        });
        return;
      }
      await repo.upsertIncomeSource(input);
      await refresh();
    },
    removeIncomeSource: async (id) => {
      const repo = await withRepo();
      if (!repo) {
        setState((prev) =>
          applyIncomeSourceSync({
            ...prev,
            incomeSources: prev.incomeSources.filter((s) => s.id !== id),
          }),
        );
        return;
      }
      await repo.deleteIncomeSource(id);
      await refresh();
    },
    saveRecurringBill: async (input) => {
      const repo = await withRepo();
      if (!repo) {
        setState((prev) => {
          if (input.id) {
            return {
              ...prev,
              recurringBills: prev.recurringBills.map((b) =>
                b.id === input.id ? { ...b, ...input, id: input.id } : b,
              ),
            };
          }
          return {
            ...prev,
            recurringBills: [
              ...prev.recurringBills,
              { ...input, id: `bill-${crypto.randomUUID()}` },
            ],
          };
        });
        return;
      }
      await repo.upsertRecurringBill(input);
      await refresh();
    },
    removeRecurringBill: async (id) => {
      const repo = await withRepo();
      if (!repo) {
        setState((prev) => ({
          ...prev,
          recurringBills: prev.recurringBills.filter((b) => b.id !== id),
        }));
        return;
      }
      await repo.deleteRecurringBill(id);
      await refresh();
    },
    setGoalReserved: async (id, reserved) => {
      const repo = await withRepo();
      if (!repo) {
        setState((prev) => ({
          ...prev,
          savingsGoals: prev.savingsGoals.map((g) =>
            g.id === id ? { ...g, reserved } : g,
          ),
        }));
        return;
      }
      await repo.setGoalReserved(id, reserved);
      await refresh();
    },
    saveSavingsGoal: async (input) => {
      const repo = await withRepo();
      if (!repo) {
        setState((prev) => {
          if (input.id) {
            return {
              ...prev,
              savingsGoals: prev.savingsGoals.map((g) =>
                g.id === input.id ? { ...g, ...input, id: input.id } : g,
              ),
            };
          }
          return {
            ...prev,
            savingsGoals: [
              ...prev.savingsGoals,
              { ...input, id: `goal-${crypto.randomUUID()}` },
            ],
          };
        });
        return;
      }
      await repo.upsertSavingsGoal(input);
      await refresh();
    },
    removeSavingsGoal: async (id) => {
      const repo = await withRepo();
      if (!repo) {
        setState((prev) => ({
          ...prev,
          savingsGoals: prev.savingsGoals.filter((g) => g.id !== id),
        }));
        return;
      }
      await repo.deleteSavingsGoal(id);
      await refresh();
    },
    createInviteCode: async () => {
      if (!householdId) throw new Error("Brak gospodarstwa");
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("create_invitation", {
        p_household_id: householdId,
        p_days_valid: 7,
      });
      if (rpcError) throw new Error(rpcError.message);
      return String(data);
    },
    signOut: async () => {
      if (hasSupabaseEnv()) {
        const supabase = createClient();
        await supabase.auth.signOut();
      }
      window.location.href = "/logowanie";
    },
  };

  return (
    <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>
  );
}

export function useBudget(): BudgetContextValue {
  const ctx = useContext(BudgetContext);
  if (!ctx) {
    throw new Error("useBudget musi być użyty wewnątrz BudgetProvider");
  }
  return ctx;
}
