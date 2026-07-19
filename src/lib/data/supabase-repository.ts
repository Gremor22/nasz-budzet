import type { SupabaseClient } from "@supabase/supabase-js";
import { createDemoState } from "@/lib/data/demo-data";
import {
  mapDbToBudgetState,
  type DbAccount,
  type DbHousehold,
  type DbIncomeSource,
  type DbRecurringBill,
  type DbSavingsGoal,
  type DbTransaction,
} from "@/lib/data/mappers";
import type { BudgetState, ForecastMode, Transaction } from "@/lib/data/types";
import { todayIsoWarsaw } from "@/lib/dates/today";

/**
 * Repozytorium Supabase — ten sam kształt danych co localStorage.
 * Używa wyłącznie klienta z anon key + sesją użytkownika (RLS).
 */
export class SupabaseBudgetRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly householdId: string,
  ) {}

  async load(): Promise<BudgetState> {
    const asOf = todayIsoWarsaw();

    const { data: household, error: hhError } = await this.supabase
      .from("households")
      .select("*")
      .eq("id", this.householdId)
      .single();

    if (hhError || !household) {
      throw new Error(hhError?.message ?? "Nie znaleziono gospodarstwa");
    }

    const [
      accountsRes,
      incomeRes,
      billsRes,
      txRes,
      goalsRes,
    ] = await Promise.all([
      this.supabase.from("accounts").select("*").eq("household_id", this.householdId),
      this.supabase.from("income_sources").select("*").eq("household_id", this.householdId),
      this.supabase.from("recurring_bills").select("*").eq("household_id", this.householdId),
      this.supabase
        .from("transactions")
        .select("*")
        .eq("household_id", this.householdId)
        .order("txn_date", { ascending: false }),
      this.supabase.from("savings_goals").select("*").eq("household_id", this.householdId),
    ]);

    for (const res of [accountsRes, incomeRes, billsRes, txRes, goalsRes]) {
      if (res.error) throw new Error(res.error.message);
    }

    return mapDbToBudgetState({
      household: household as DbHousehold,
      accounts: (accountsRes.data ?? []) as DbAccount[],
      incomeSources: (incomeRes.data ?? []) as DbIncomeSource[],
      recurringBills: (billsRes.data ?? []) as DbRecurringBill[],
      transactions: (txRes.data ?? []) as DbTransaction[],
      savingsGoals: (goalsRes.data ?? []) as DbSavingsGoal[],
      asOfDate: asOf,
    });
  }

  async addTransaction(
    input: Omit<Transaction, "id" | "createdAt" | "updatedAt">,
  ): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();

    const { error } = await this.supabase.from("transactions").insert({
      household_id: this.householdId,
      account_id: input.accountId,
      type: input.type,
      amount_grosze: input.amountGrosze,
      txn_date: input.date,
      description: input.description,
      category_name: input.category,
      person_key: input.person,
      paid_by: input.paidBy,
      is_shared: input.isShared,
      status: input.status,
      income_source_id: input.incomeSourceId ?? null,
      note: input.note ?? null,
      created_by: user?.id ?? null,
    });

    if (error) throw new Error(error.message);
  }

  async updateHouseholdSettings(input: {
    safetyBufferGrosze?: number;
    forecastMode?: ForecastMode;
    horizonDays?: number;
  }): Promise<void> {
    const patch: Record<string, unknown> = {};
    if (input.safetyBufferGrosze !== undefined) {
      patch.safety_buffer_grosze = input.safetyBufferGrosze;
    }
    if (input.forecastMode !== undefined) {
      patch.default_forecast_mode = input.forecastMode;
    }
    if (input.horizonDays !== undefined) {
      patch.default_horizon_days = input.horizonDays;
    }
    if (Object.keys(patch).length === 0) return;

    const { error } = await this.supabase
      .from("households")
      .update(patch)
      .eq("id", this.householdId);

    if (error) throw new Error(error.message);
  }

  /**
   * Wczytuje fikcyjne dane demo do gospodarstwa (nie prawdziwe finanse).
   * Dozwolone tylko gdy nie ma jeszcze transakcji / dochodów / rachunków.
   */
  async seedDemoData(): Promise<void> {
    const demo = createDemoState();

    const [{ count: txCount }, { count: incCount }, { count: billCount }] =
      await Promise.all([
        this.supabase
          .from("transactions")
          .select("*", { count: "exact", head: true })
          .eq("household_id", this.householdId),
        this.supabase
          .from("income_sources")
          .select("*", { count: "exact", head: true })
          .eq("household_id", this.householdId),
        this.supabase
          .from("recurring_bills")
          .select("*", { count: "exact", head: true })
          .eq("household_id", this.householdId),
      ]);

    if ((txCount ?? 0) > 0 || (incCount ?? 0) > 0 || (billCount ?? 0) > 0) {
      throw new Error(
        "Gospodarstwo ma już dane. Użyj pustego gospodarstwa testowego.",
      );
    }

    const { error: hhErr } = await this.supabase
      .from("households")
      .update({
        name: "Paweł i Milena",
        safety_buffer_grosze: demo.household.safetyBufferGrosze,
        default_forecast_mode: demo.household.defaultForecastMode,
        default_horizon_days: demo.household.defaultHorizonDays,
      })
      .eq("id", this.householdId);
    if (hhErr) throw new Error(hhErr.message);

    // Usuń startowe puste konto — wstawimy zestaw demo
    const { error: delAccErr } = await this.supabase
      .from("accounts")
      .delete()
      .eq("household_id", this.householdId);
    if (delAccErr) throw new Error(delAccErr.message);

    const accountIdMap = new Map<string, string>();

    for (const acc of demo.accounts) {
      const { data, error } = await this.supabase
        .from("accounts")
        .insert({
          household_id: this.householdId,
          name: acc.name,
          owner_key: acc.owner,
          account_type: acc.type,
          opening_balance_grosze: acc.openingBalanceGrosze,
          include_in_budget: acc.includeInBudget,
          active: acc.active,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Błąd konta");
      accountIdMap.set(acc.id, data.id);
    }

    for (const s of demo.incomeSources) {
      const { error } = await this.supabase.from("income_sources").insert({
        household_id: this.householdId,
        name: s.name,
        owner_key: s.owner,
        typical_amount_grosze: s.typicalAmountGrosze,
        safe_amount_grosze: s.safeAmountGrosze,
        frequency: s.frequency,
        day_of_month: s.dayOfMonth ?? null,
        next_occurrence_date: s.nextOccurrenceDate,
        end_date: s.endDate ?? null,
        confidence: s.confidence,
        active: s.active,
        note: s.note ?? null,
      });
      if (error) throw new Error(error.message);
    }

    for (const b of demo.recurringBills) {
      const { error } = await this.supabase.from("recurring_bills").insert({
        household_id: this.householdId,
        name: b.name,
        amount_grosze: b.amountGrosze,
        frequency: b.frequency,
        day_of_month: b.dayOfMonth ?? null,
        next_occurrence_date: b.nextOccurrenceDate,
        end_date: b.endDate ?? null,
        active: b.active,
        status: b.status,
        paid_by: b.paidBy,
        category_name: b.category,
      });
      if (error) throw new Error(error.message);
    }

    for (const g of demo.savingsGoals) {
      const { error } = await this.supabase.from("savings_goals").insert({
        household_id: this.householdId,
        name: g.name,
        target_amount_grosze: g.targetAmountGrosze,
        saved_amount_grosze: g.savedAmountGrosze,
        reserved: g.reserved,
        owner_key: g.owner,
        deadline: g.deadline ?? null,
        active: g.active,
      });
      if (error) throw new Error(error.message);
    }

    for (const t of demo.transactions) {
      const accountId = accountIdMap.get(t.accountId);
      if (!accountId) continue;
      const { error } = await this.supabase.from("transactions").insert({
        household_id: this.householdId,
        account_id: accountId,
        type: t.type,
        amount_grosze: t.amountGrosze,
        txn_date: t.date,
        description: t.description,
        category_name: t.category,
        person_key: t.person,
        paid_by: t.paidBy,
        is_shared: t.isShared,
        status: t.status,
        note: "Dane demonstracyjne (fikcyjne)",
      });
      if (error) throw new Error(error.message);
    }
  }
}
