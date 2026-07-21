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
import type {
  BudgetState,
  ForecastMode,
  Transaction,
  Account,
  IncomeSource,
  RecurringBill,
  SavingsGoal,
} from "@/lib/data/types";
import { todayIsoWarsaw } from "@/lib/dates/today";
import { nextMonthlyPayDate } from "@/lib/dates/pay-day";

function monthStartIso(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}
import type { SimpleSetupInput } from "@/lib/data/simple-setup";

export type AccountInput = Omit<Account, "id">;
export type IncomeSourceInput = Omit<IncomeSource, "id">;
export type RecurringBillInput = Omit<RecurringBill, "id">;
export type SavingsGoalInput = Omit<SavingsGoal, "id">;

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
  ): Promise<string> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();

    const { data, error } = await this.supabase
      .from("transactions")
      .insert({
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
        receipt_id: input.receiptId ?? null,
        note: input.note ?? null,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return data.id as string;
  }

  async deleteTransaction(id: string): Promise<void> {
    const { error } = await this.supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("household_id", this.householdId);
    if (error) throw new Error(error.message);
  }

  /** Zapisuje różnicę transakcji po synchronizacji ze źródłami dochodu. */
  async persistIncomeSourceSync(
    before: import("@/lib/data/types").BudgetState,
    after: import("@/lib/data/types").BudgetState,
  ): Promise<void> {
    const beforeById = new Map(before.transactions.map((t) => [t.id, t]));
    const afterById = new Map(after.transactions.map((t) => [t.id, t]));

    for (const t of after.transactions) {
      const old = beforeById.get(t.id);
      if (!old) {
        await this.addTransaction({
          type: t.type,
          amountGrosze: t.amountGrosze,
          date: t.date,
          description: t.description,
          category: t.category,
          person: t.person,
          paidBy: t.paidBy,
          isShared: t.isShared,
          status: t.status,
          accountId: t.accountId,
          incomeSourceId: t.incomeSourceId,
          receiptId: t.receiptId,
          note: t.note,
        });
        continue;
      }
      if (
        t.incomeSourceId &&
        old.status === "planned" &&
        (old.amountGrosze !== t.amountGrosze ||
          old.status !== t.status ||
          old.description !== t.description ||
          old.date !== t.date)
      ) {
        await this.deleteTransaction(t.id);
        await this.addTransaction({
          type: t.type,
          amountGrosze: t.amountGrosze,
          date: t.date,
          description: t.description,
          category: t.category,
          person: t.person,
          paidBy: t.paidBy,
          isShared: t.isShared,
          status: t.status,
          accountId: t.accountId,
          incomeSourceId: t.incomeSourceId,
          receiptId: t.receiptId,
          note: t.note,
        });
      }
    }

    for (const t of before.transactions) {
      if (!afterById.has(t.id) && t.incomeSourceId && t.status === "planned") {
        await this.deleteTransaction(t.id);
      }
    }
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

  async upsertAccount(input: AccountInput & { id?: string }): Promise<void> {
    const row = {
      household_id: this.householdId,
      name: input.name,
      owner_key: input.owner,
      account_type: input.type,
      opening_balance_grosze: input.openingBalanceGrosze,
      include_in_budget: input.includeInBudget,
      active: input.active,
    };
    if (input.id) {
      const { error } = await this.supabase
        .from("accounts")
        .update(row)
        .eq("id", input.id)
        .eq("household_id", this.householdId);
      if (error) throw new Error(error.message);
      return;
    }
    const { error } = await this.supabase.from("accounts").insert(row);
    if (error) throw new Error(error.message);
  }

  async deleteAccount(id: string): Promise<void> {
    const { error } = await this.supabase
      .from("accounts")
      .delete()
      .eq("id", id)
      .eq("household_id", this.householdId);
    if (error) throw new Error(error.message);
  }

  async upsertIncomeSource(
    input: IncomeSourceInput & { id?: string },
  ): Promise<void> {
    const row = {
      household_id: this.householdId,
      name: input.name,
      owner_key: input.owner,
      typical_amount_grosze: input.typicalAmountGrosze,
      safe_amount_grosze: input.safeAmountGrosze,
      frequency: input.frequency,
      day_of_month: input.dayOfMonth ?? null,
      next_occurrence_date: input.nextOccurrenceDate,
      end_date: input.endDate ?? null,
      confidence: input.confidence,
      active: input.active,
      note: input.note ?? null,
    };
    if (input.id) {
      const { error } = await this.supabase
        .from("income_sources")
        .update(row)
        .eq("id", input.id)
        .eq("household_id", this.householdId);
      if (error) throw new Error(error.message);
      return;
    }
    const { error } = await this.supabase.from("income_sources").insert(row);
    if (error) throw new Error(error.message);
  }

  async deleteIncomeSource(id: string): Promise<void> {
    const { error } = await this.supabase
      .from("income_sources")
      .delete()
      .eq("id", id)
      .eq("household_id", this.householdId);
    if (error) throw new Error(error.message);
  }

  async upsertRecurringBill(
    input: RecurringBillInput & { id?: string },
  ): Promise<void> {
    const row = {
      household_id: this.householdId,
      name: input.name,
      amount_grosze: input.amountGrosze,
      frequency: input.frequency,
      day_of_month: input.dayOfMonth ?? null,
      next_occurrence_date: input.nextOccurrenceDate,
      end_date: input.endDate ?? null,
      active: input.active,
      status: input.status,
      paid_by: input.paidBy,
      category_name: input.category,
    };
    if (input.id) {
      const { error } = await this.supabase
        .from("recurring_bills")
        .update(row)
        .eq("id", input.id)
        .eq("household_id", this.householdId);
      if (error) throw new Error(error.message);
      return;
    }
    const { error } = await this.supabase.from("recurring_bills").insert(row);
    if (error) throw new Error(error.message);
  }

  async deleteRecurringBill(id: string): Promise<void> {
    const { error } = await this.supabase
      .from("recurring_bills")
      .delete()
      .eq("id", id)
      .eq("household_id", this.householdId);
    if (error) throw new Error(error.message);
  }

  async setGoalReserved(id: string, reserved: boolean): Promise<void> {
    const { error } = await this.supabase
      .from("savings_goals")
      .update({ reserved })
      .eq("id", id)
      .eq("household_id", this.householdId);
    if (error) throw new Error(error.message);
  }

  async upsertSavingsGoal(
    input: SavingsGoalInput & { id?: string },
  ): Promise<void> {
    const row = {
      household_id: this.householdId,
      name: input.name,
      target_amount_grosze: input.targetAmountGrosze,
      saved_amount_grosze: input.savedAmountGrosze,
      reserved: input.reserved,
      owner_key: input.owner,
      deadline: input.deadline ?? null,
      active: input.active,
    };
    if (input.id) {
      const { error } = await this.supabase
        .from("savings_goals")
        .update(row)
        .eq("id", input.id)
        .eq("household_id", this.householdId);
      if (error) throw new Error(error.message);
      return;
    }
    const { error } = await this.supabase.from("savings_goals").insert(row);
    if (error) throw new Error(error.message);
  }

  async deleteSavingsGoal(id: string): Promise<void> {
    const { error } = await this.supabase
      .from("savings_goals")
      .delete()
      .eq("id", id)
      .eq("household_id", this.householdId);
    if (error) throw new Error(error.message);
  }

  async ensureBudgetStartedDate(): Promise<void> {
    const { data, error } = await this.supabase
      .from("households")
      .select("budget_started_date")
      .eq("id", this.householdId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.budget_started_date) return;

    const { error: updErr } = await this.supabase
      .from("households")
      .update({ budget_started_date: monthStartIso(todayIsoWarsaw()) })
      .eq("id", this.householdId);
    if (updErr) throw new Error(updErr.message);
  }

  /**
   * Usuwa fikcyjne dane demo (po testach / przed realnym użytkowaniem).
   */
  async purgeDemoData(): Promise<boolean> {
    let changed = false;

    const { data: demoTx } = await this.supabase
      .from("transactions")
      .select("id")
      .eq("household_id", this.householdId)
      .or("note.ilike.%demonstracyjne%,description.ilike.%(demo)%");

    if (demoTx?.length) {
      const ids = demoTx.map((t) => t.id as string);
      const { error } = await this.supabase
        .from("transactions")
        .delete()
        .in("id", ids);
      if (error) throw new Error(error.message);
      changed = true;
    }

    for (const table of [
      "income_sources",
      "recurring_bills",
      "savings_goals",
    ] as const) {
      const { data: rows } = await this.supabase
        .from(table)
        .select("id")
        .eq("household_id", this.householdId)
        .ilike("name", "%(demo)%");
      if (rows?.length) {
        const ids = rows.map((r) => r.id as string);
        const { error } = await this.supabase.from(table).delete().in("id", ids);
        if (error) throw new Error(error.message);
        changed = true;
      }
    }

    const { data: demoAccounts } = await this.supabase
      .from("accounts")
      .select("id")
      .eq("household_id", this.householdId)
      .ilike("name", "%(demo)%");

    if (demoAccounts?.length) {
      const ids = demoAccounts.map((a) => a.id as string);
      const { error } = await this.supabase
        .from("accounts")
        .delete()
        .in("id", ids);
      if (error) throw new Error(error.message);
      changed = true;
    }

    return changed;
  }

  /**
   * Wczytuje fikcyjne dane demo do gospodarstwa (nie prawdziwe finanse).
   * @deprecated Usunięte z UI — tylko do testów developerskich.
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

  /**
   * Prosty start: jedno konto + opcjonalna pensja. Oznacza setup jako ukończony.
   */
  async completeSimpleSetup(input: SimpleSetupInput): Promise<void> {
    const { data: accounts, error: accListErr } = await this.supabase
      .from("accounts")
      .select("id")
      .eq("household_id", this.householdId)
      .eq("include_in_budget", true)
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(1);

    if (accListErr) throw new Error(accListErr.message);

    let accountId = accounts?.[0]?.id as string | undefined;

    if (accountId) {
      const { error } = await this.supabase
        .from("accounts")
        .update({
          name: "Główne konto",
          opening_balance_grosze: input.balanceGrosze,
        })
        .eq("id", accountId)
        .eq("household_id", this.householdId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await this.supabase
        .from("accounts")
        .insert({
          household_id: this.householdId,
          name: "Główne konto",
          owner_key: "shared",
          account_type: "shared",
          opening_balance_grosze: input.balanceGrosze,
          include_in_budget: true,
          active: true,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Błąd konta");
      accountId = data.id as string;
    }

    if (
      input.incomeName?.trim() &&
      input.incomeAmountGrosze &&
      input.incomeAmountGrosze > 0
    ) {
      const day = input.incomeDayOfMonth ?? 1;
      const { error: incErr } = await this.supabase.from("income_sources").insert({
        household_id: this.householdId,
        name: input.incomeName.trim(),
        owner_key: "pawel",
        typical_amount_grosze: input.incomeAmountGrosze,
        safe_amount_grosze: input.incomeAmountGrosze,
        frequency: "monthly_on_day",
        day_of_month: day,
        next_occurrence_date: nextMonthlyPayDate(day),
        confidence: "expected",
        active: true,
      });
      if (incErr) throw new Error(incErr.message);
    }

    const { error: hhErr } = await this.supabase
      .from("households")
      .update({
        initial_setup_done: true,
        budget_started_date: monthStartIso(todayIsoWarsaw()),
      })
      .eq("id", this.householdId);
    if (hhErr) throw new Error(hhErr.message);
  }

  /**
   * Usuwa wszystkie dane budżetu i wraca do pustego startu (kreator od nowa).
   */
  async resetHouseholdBudget(): Promise<void> {
    const tables = [
      "transactions",
      "income_sources",
      "recurring_bills",
      "savings_goals",
      "classification_rules",
      "receipts",
    ] as const;

    for (const table of tables) {
      const { error } = await this.supabase
        .from(table)
        .delete()
        .eq("household_id", this.householdId);
      if (error) throw new Error(error.message);
    }

    const { error: delAccErr } = await this.supabase
      .from("accounts")
      .delete()
      .eq("household_id", this.householdId);
    if (delAccErr) throw new Error(delAccErr.message);

    const { error: insAccErr } = await this.supabase.from("accounts").insert({
      household_id: this.householdId,
      name: "Główne konto",
      owner_key: "shared",
      account_type: "shared",
      opening_balance_grosze: 0,
      include_in_budget: true,
      active: true,
    });
    if (insAccErr) throw new Error(insAccErr.message);

    const { error: hhErr } = await this.supabase
      .from("households")
      .update({
        safety_buffer_grosze: 0,
        initial_setup_done: false,
      })
      .eq("id", this.householdId);
    if (hhErr) throw new Error(hhErr.message);
  }
}
