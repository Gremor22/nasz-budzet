import type { BudgetState, ForecastMode, PersonId } from "@/lib/data/types";

export type DbHousehold = {
  id: string;
  name: string;
  safety_buffer_grosze: number;
  default_forecast_mode: ForecastMode;
  default_horizon_days: number;
  initial_setup_done?: boolean;
};

export type DbAccount = {
  id: string;
  household_id: string;
  name: string;
  owner_key: PersonId | "shared";
  account_type: string;
  opening_balance_grosze: number;
  include_in_budget: boolean;
  active: boolean;
};

export type DbIncomeSource = {
  id: string;
  household_id: string;
  name: string;
  owner_key: PersonId;
  typical_amount_grosze: number;
  safe_amount_grosze: number;
  frequency: string;
  day_of_month: number | null;
  next_occurrence_date: string;
  end_date: string | null;
  confidence: string;
  active: boolean;
  note: string | null;
};

export type DbRecurringBill = {
  id: string;
  household_id: string;
  name: string;
  amount_grosze: number;
  frequency: string;
  day_of_month: number | null;
  next_occurrence_date: string;
  end_date: string | null;
  active: boolean;
  status: string;
  paid_by: PersonId | "shared";
  category_name: string;
};

export type DbTransaction = {
  id: string;
  household_id: string;
  account_id: string;
  type: "expense" | "income";
  amount_grosze: number;
  txn_date: string;
  description: string;
  category_name: string;
  person_key: PersonId | "shared";
  paid_by: PersonId | "shared";
  is_shared: boolean;
  status: string;
  income_source_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type DbSavingsGoal = {
  id: string;
  household_id: string;
  name: string;
  target_amount_grosze: number;
  saved_amount_grosze: number;
  reserved: boolean;
  owner_key: PersonId | "shared";
  deadline: string | null;
  active: boolean;
};

export function emptyBudgetState(
  household: DbHousehold,
  asOfDate: string,
): BudgetState {
  return {
    version: 1,
    household: {
      id: household.id,
      name: household.name,
      safetyBufferGrosze: household.safety_buffer_grosze,
      defaultForecastMode: household.default_forecast_mode,
      defaultHorizonDays: household.default_horizon_days,
      initialSetupDone: household.initial_setup_done ?? true,
    },
    accounts: [],
    incomeSources: [],
    recurringBills: [],
    transactions: [],
    savingsGoals: [],
    settings: {
      asOfDate,
      forecastMode: household.default_forecast_mode,
      horizonDays: household.default_horizon_days,
    },
  };
}

export function mapDbToBudgetState(input: {
  household: DbHousehold;
  accounts: DbAccount[];
  incomeSources: DbIncomeSource[];
  recurringBills: DbRecurringBill[];
  transactions: DbTransaction[];
  savingsGoals: DbSavingsGoal[];
  asOfDate: string;
}): BudgetState {
  const { household } = input;
  return {
    version: 1,
    household: {
      id: household.id,
      name: household.name,
      safetyBufferGrosze: household.safety_buffer_grosze,
      defaultForecastMode: household.default_forecast_mode,
      defaultHorizonDays: household.default_horizon_days,
      initialSetupDone: household.initial_setup_done ?? true,
    },
    accounts: input.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      owner: a.owner_key,
      type: a.account_type as BudgetState["accounts"][number]["type"],
      openingBalanceGrosze: a.opening_balance_grosze,
      includeInBudget: a.include_in_budget,
      active: a.active,
    })),
    incomeSources: input.incomeSources.map((s) => ({
      id: s.id,
      name: s.name,
      owner: s.owner_key,
      typicalAmountGrosze: s.typical_amount_grosze,
      safeAmountGrosze: s.safe_amount_grosze,
      frequency: s.frequency as BudgetState["incomeSources"][number]["frequency"],
      dayOfMonth: s.day_of_month ?? undefined,
      nextOccurrenceDate: s.next_occurrence_date,
      endDate: s.end_date ?? undefined,
      confidence: s.confidence as BudgetState["incomeSources"][number]["confidence"],
      active: s.active,
      note: s.note ?? undefined,
    })),
    recurringBills: input.recurringBills.map((b) => ({
      id: b.id,
      name: b.name,
      amountGrosze: b.amount_grosze,
      frequency: b.frequency as BudgetState["recurringBills"][number]["frequency"],
      dayOfMonth: b.day_of_month ?? undefined,
      nextOccurrenceDate: b.next_occurrence_date,
      endDate: b.end_date ?? undefined,
      active: b.active,
      status: b.status as BudgetState["recurringBills"][number]["status"],
      paidBy: b.paid_by,
      category: b.category_name,
    })),
    transactions: input.transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amountGrosze: t.amount_grosze,
      date: t.txn_date,
      description: t.description,
      category: t.category_name,
      person: t.person_key,
      paidBy: t.paid_by,
      isShared: t.is_shared,
      status: t.status as BudgetState["transactions"][number]["status"],
      accountId: t.account_id,
      incomeSourceId: t.income_source_id ?? undefined,
      note: t.note ?? undefined,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    })),
    savingsGoals: input.savingsGoals.map((g) => ({
      id: g.id,
      name: g.name,
      targetAmountGrosze: g.target_amount_grosze,
      savedAmountGrosze: g.saved_amount_grosze,
      reserved: g.reserved,
      owner: g.owner_key,
      deadline: g.deadline ?? undefined,
      active: g.active,
    })),
    settings: {
      asOfDate: input.asOfDate,
      forecastMode: household.default_forecast_mode,
      horizonDays: household.default_horizon_days,
    },
  };
}
