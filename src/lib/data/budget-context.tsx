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
  readActiveHouseholdId,
  writeActiveHouseholdId,
} from "@/lib/data/active-household";
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
  HouseholdMember,
  HouseholdMemberRole,
  PersonId,
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
  userId: string | null;
  myPersonId: PersonId | null;
  myRole: HouseholdMemberRole | null;
  members: HouseholdMember[];
  error: string | null;
  refresh: (opts?: { preferHouseholdId?: string }) => Promise<void>;
  addExpense: (
    input: Omit<Transaction, "id" | "createdAt" | "updatedAt" | "type">,
  ) => Promise<string>;
  addIncome: (
    input: Omit<Transaction, "id" | "createdAt" | "updatedAt" | "type">,
  ) => Promise<string>;
  removeTransaction: (id: string) => Promise<void>;
  completeSimpleSetup: (input: SimpleSetupInput) => Promise<void>;
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
  joinWithInviteCode: (input: {
    code: string;
    personKey: PersonId;
    balanceGrosze: number;
  }) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  setMyPersonKey: (personKey: PersonId) => Promise<void>;
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
  const [userId, setUserId] = useState<string | null>(null);
  const [myPersonId, setMyPersonId] = useState<PersonId | null>(null);
  const [myRole, setMyRole] = useState<HouseholdMemberRole | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const refreshInFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async (opts?: { preferHouseholdId?: string }) => {
    // Jedna synchronizacja naraz — bez wyścigów = bez potrójnej pensji
    if (refreshInFlight.current) {
      await refreshInFlight.current;
      // Po dołączeniu kodem musimy przeładować wskazane gospodarstwo
      if (opts?.preferHouseholdId) {
        return refresh(opts);
      }
      return;
    }

    const run = (async () => {
      setError(null);

      if (!hasSupabaseEnv()) {
        setDataSource("local");
        setHouseholdId(null);
        setUserEmail(null);
        setUserId(null);
        setMyPersonId(null);
        setMyRole(null);
        setMembers([]);
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
        setUserId(null);
        setMyPersonId(null);
        setMyRole(null);
        setMembers([]);
        setHydrated(true);
        return;
      }

      setUserEmail(user.email ?? null);
      setUserId(user.id);

      let householdIdToLoad: string | null = null;

      const resolveMembership = async (householdId: string) => {
        const { data, error } = await supabase
          .from("household_members")
          .select("household_id")
          .eq("user_id", user.id)
          .eq("household_id", householdId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        return data?.household_id ?? null;
      };

      // 1) Jawnie wskazane (po dołączeniu kodem)
      if (opts?.preferHouseholdId) {
        try {
          householdIdToLoad = await resolveMembership(opts.preferHouseholdId);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Błąd członkostwa");
          setHydrated(true);
          return;
        }
      }

      // 2) Zapamiętane w przeglądarce (żeby nie wracać do starego pustego HH)
      if (!householdIdToLoad) {
        const stored = readActiveHouseholdId();
        if (stored) {
          try {
            householdIdToLoad = await resolveMembership(stored);
          } catch {
            householdIdToLoad = null;
          }
          if (!householdIdToLoad) writeActiveHouseholdId(null);
        }
      }

      // 3) Najnowsze członkostwo (po dołączeniu kodem — nie najstarsze puste)
      if (!householdIdToLoad) {
        const { data: membership, error: memErr } = await supabase
          .from("household_members")
          .select("household_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (memErr) {
          setError(memErr.message);
          setHydrated(true);
          return;
        }
        householdIdToLoad = membership?.household_id ?? null;
      }

      if (!householdIdToLoad) {
        setHouseholdId(null);
        writeActiveHouseholdId(null);
        setMyPersonId(null);
        setMyRole(null);
        setMembers([]);
        setDataSource("supabase");
        setHydrated(true);
        return;
      }

      try {
        const { data: memberRows, error: membersErr } = await supabase
          .from("household_members")
          .select("user_id, role, person_key")
          .eq("household_id", householdIdToLoad);
        if (membersErr) throw new Error(membersErr.message);

        const userIds = (memberRows ?? []).map((m) => m.user_id as string);
        const { data: profiles } = userIds.length
          ? await supabase
              .from("profiles")
              .select("id, display_name")
              .in("id", userIds)
          : { data: [] as { id: string; display_name: string }[] };

        const profileById = new Map(
          (profiles ?? []).map((p) => [p.id as string, p.display_name as string]),
        );

        const loadedMembers: HouseholdMember[] = (memberRows ?? []).map((m) => {
          const pk = m.person_key;
          return {
            userId: m.user_id as string,
            role: (m.role as HouseholdMemberRole) ?? "member",
            personKey:
              pk === "pawel" || pk === "milena" ? pk : null,
            displayName: profileById.get(m.user_id as string) ?? "Użytkownik",
          };
        });
        setMembers(loadedMembers);

        const mine = loadedMembers.find((m) => m.userId === user.id);
        setMyRole(mine?.role ?? null);
        setMyPersonId(mine?.personKey ?? null);

        const repo = new SupabaseBudgetRepository(
          supabase,
          householdIdToLoad,
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
        try {
          await repo.syncIncomeSourceTransactions({
            asOfDate: fresh.settings.asOfDate,
            horizonDays: fresh.settings.horizonDays,
          });
          const afterSync = await repo.load();
          afterSync.settings.asOfDate = todayIsoWarsaw();
          setState(afterSync);
        } catch {
          // Fallback gdy RPC Etapu 8 jeszcze nie jest na serwerze
          const synced = applyIncomeSourceSync(fresh);
          if (incomeSourceSyncChanged(fresh, synced)) {
            await repo.persistIncomeSourceSync(fresh, synced);
            const afterLegacy = await repo.load();
            afterLegacy.settings.asOfDate = todayIsoWarsaw();
            setState(afterLegacy);
          } else {
            setState(synced);
          }
        }
        setHouseholdId(householdIdToLoad);
        writeActiveHouseholdId(householdIdToLoad);
        setDataSource("supabase");
        setHydrated(true);
      } catch (e) {
        setHouseholdId(householdIdToLoad);
        writeActiveHouseholdId(householdIdToLoad);
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
    userId,
    myPersonId,
    myRole,
    members,
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
      const person: PersonId = myPersonId ?? "pawel";
      const myBal = input.myBalanceGrosze ?? input.balanceGrosze ?? 0;
      if (!repo) {
        const day = input.incomeDayOfMonth ?? 1;
        const partner: PersonId = person === "pawel" ? "milena" : "pawel";
        setState((prev) => {
          const accounts = [
            {
              id: `acc-${person}`,
              name: person === "pawel" ? "Konto Pawła" : "Konto Mileny",
              owner: person,
              type: "personal" as const,
              openingBalanceGrosze: myBal,
              includeInBudget: true,
              active: true,
            },
            {
              id: `acc-${partner}`,
              name: partner === "pawel" ? "Konto Pawła" : "Konto Mileny",
              owner: partner,
              type: "personal" as const,
              openingBalanceGrosze: 0,
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
                    owner: input.incomeOwner ?? person,
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
      await repo.completeSimpleSetup(input, person);
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
      if (myRole !== "owner") {
        throw new Error("Tylko właściciel gospodarstwa może generować kod");
      }
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("create_invitation", {
        p_household_id: householdId,
        p_days_valid: 7,
      });
      if (rpcError) throw new Error(rpcError.message);
      return String(data);
    },
    joinWithInviteCode: async (input) => {
      const trimmed = input.code.trim();
      if (!trimmed) throw new Error("Wpisz kod zaproszenia");
      if (!hasSupabaseEnv()) {
        throw new Error("Dołączanie wymaga konta w Supabase");
      }
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("accept_invitation", {
        p_code: trimmed,
        p_person_key: input.personKey,
        p_opening_balance_grosze: Math.max(0, Math.round(input.balanceGrosze)),
      });
      if (rpcError) throw new Error(rpcError.message);
      const joinedId = data ? String(data) : undefined;
      if (joinedId) writeActiveHouseholdId(joinedId);
      await refresh(joinedId ? { preferHouseholdId: joinedId } : undefined);
    },
    removeMember: async (memberUserId: string) => {
      if (!householdId) throw new Error("Brak gospodarstwa");
      if (myRole !== "owner") {
        throw new Error("Tylko właściciel może wyrzucać członków");
      }
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("remove_household_member", {
        p_household_id: householdId,
        p_user_id: memberUserId,
      });
      if (rpcError) throw new Error(rpcError.message);
      await refresh({ preferHouseholdId: householdId });
    },
    setMyPersonKey: async (personKey: PersonId) => {
      if (!householdId) throw new Error("Brak gospodarstwa");
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("set_my_person_key", {
        p_household_id: householdId,
        p_person_key: personKey,
      });
      if (rpcError) throw new Error(rpcError.message);
      await refresh({ preferHouseholdId: householdId });
    },
    signOut: async () => {
      if (hasSupabaseEnv()) {
        const supabase = createClient();
        await supabase.auth.signOut();
      }
      writeActiveHouseholdId(null);
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
