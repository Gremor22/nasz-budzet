"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
} from "@/lib/data/supabase-repository";
import type {
  BudgetState,
  ForecastMode,
  ForecastResult,
  Transaction,
} from "@/lib/data/types";
import { computeForecast } from "@/lib/forecast/engine";
import { todayIsoWarsaw } from "@/lib/dates/today";

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
  ) => Promise<void>;
  addIncome: (
    input: Omit<Transaction, "id" | "createdAt" | "updatedAt" | "type">,
  ) => Promise<void>;
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
  seedDemo: () => Promise<void>;
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

  const refresh = useCallback(async () => {
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
      setState(loaded);
      setHouseholdId(membership.household_id);
      setDataSource("supabase");
      setHydrated(true);
    } catch (e) {
      setHouseholdId(membership.household_id);
      setDataSource("supabase");
      setError(e instanceof Error ? e.message : "Błąd wczytywania danych");
      setHydrated(true);
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
        setState((prev) => ({
          ...prev,
          transactions: [
            {
              ...input,
              type: "expense",
              id: `tx-${crypto.randomUUID()}`,
              createdAt: now,
              updatedAt: now,
            },
            ...prev.transactions,
          ],
        }));
        return;
      }
      await repo.addTransaction({ ...input, type: "expense" });
      await refresh();
    },
    addIncome: async (input) => {
      const repo = await withRepo();
      if (!repo) {
        const now = new Date().toISOString();
        setState((prev) => ({
          ...prev,
          transactions: [
            {
              ...input,
              type: "income",
              id: `tx-${crypto.randomUUID()}`,
              createdAt: now,
              updatedAt: now,
            },
            ...prev.transactions,
          ],
        }));
        return;
      }
      await repo.addTransaction({ ...input, type: "income" });
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
          if (input.id) {
            return {
              ...prev,
              incomeSources: prev.incomeSources.map((s) =>
                s.id === input.id ? { ...s, ...input, id: input.id } : s,
              ),
            };
          }
          return {
            ...prev,
            incomeSources: [
              ...prev.incomeSources,
              { ...input, id: `inc-${crypto.randomUUID()}` },
            ],
          };
        });
        return;
      }
      await repo.upsertIncomeSource(input);
      await refresh();
    },
    removeIncomeSource: async (id) => {
      const repo = await withRepo();
      if (!repo) {
        setState((prev) => ({
          ...prev,
          incomeSources: prev.incomeSources.filter((s) => s.id !== id),
        }));
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
    seedDemo: async () => {
      const repo = await withRepo();
      if (!repo) throw new Error("Brak gospodarstwa");
      await repo.seedDemoData();
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
