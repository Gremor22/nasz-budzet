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
import { SupabaseBudgetRepository } from "@/lib/data/supabase-repository";
import type {
  BudgetState,
  ForecastMode,
  Transaction,
} from "@/lib/data/types";
import { computeForecast } from "@/lib/forecast/engine";
import type { ForecastResult } from "@/lib/data/types";
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

    const repo = new SupabaseBudgetRepository(supabase, membership.household_id);
    const loaded = await repo.load();
    // Lokalne ustawienia sesji (tryb) mogą nadpisać — start z HH
    loaded.settings.asOfDate = todayIsoWarsaw();
    setState(loaded);
    setHouseholdId(membership.household_id);
    setDataSource("supabase");
    setHydrated(true);
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
