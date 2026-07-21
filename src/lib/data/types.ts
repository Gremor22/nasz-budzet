/** Amounts are always integer grosze (1 zł = 100). */

export type PersonId = "pawel" | "milena";

export type ForecastMode = "cautious" | "realistic" | "full";

export type IncomeConfidence = "confirmed" | "expected" | "forecast";

export type IncomeFrequency =
  | "once"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "monthly_on_day"
  | "last_business_day"
  | "irregular";

export type ExpenseStatus =
  | "planned"
  | "reserved"
  | "paid"
  | "cancelled"
  | "uncertain";

export type AccountType =
  | "shared"
  | "personal"
  | "savings"
  | "cash"
  | "other";

export interface Household {
  id: string;
  name: string;
  safetyBufferGrosze: number;
  defaultForecastMode: ForecastMode;
  defaultHorizonDays: number;
  /** false = pokaż prosty kreator startu */
  initialSetupDone: boolean;
}

export interface Account {
  id: string;
  name: string;
  owner: PersonId | "shared";
  type: AccountType;
  openingBalanceGrosze: number;
  includeInBudget: boolean;
  active: boolean;
}

export interface IncomeSource {
  id: string;
  name: string;
  owner: PersonId;
  typicalAmountGrosze: number;
  /** Minimal / safe amount used in realistic mode for non-confirmed income. */
  safeAmountGrosze: number;
  frequency: IncomeFrequency;
  /** Day of month for monthly_on_day (1–31). */
  dayOfMonth?: number;
  nextOccurrenceDate: string; // YYYY-MM-DD
  endDate?: string;
  confidence: IncomeConfidence;
  active: boolean;
  note?: string;
}

export interface RecurringBill {
  id: string;
  name: string;
  amountGrosze: number;
  frequency: IncomeFrequency;
  dayOfMonth?: number;
  nextOccurrenceDate: string;
  endDate?: string;
  active: boolean;
  status: ExpenseStatus;
  paidBy: PersonId | "shared";
  category: string;
}

export interface Transaction {
  id: string;
  type: "expense" | "income";
  amountGrosze: number;
  date: string; // YYYY-MM-DD
  description: string;
  category: string;
  person: PersonId | "shared";
  paidBy: PersonId | "shared";
  isShared: boolean;
  status: ExpenseStatus;
  accountId: string;
  /** Links a one-off income confirmation; optional. */
  incomeSourceId?: string;
  /** Linked receipt (Etap 5); optional. */
  receiptId?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmountGrosze: number;
  savedAmountGrosze: number;
  /** When true, savedAmount reduces safe-to-spend. */
  reserved: boolean;
  owner: PersonId | "shared";
  deadline?: string;
  active: boolean;
}

export interface AppSettings {
  asOfDate: string; // YYYY-MM-DD — "today" for demo/tests
  forecastMode: ForecastMode;
  horizonDays: number;
}

export interface BudgetState {
  version: 1;
  household: Household;
  accounts: Account[];
  incomeSources: IncomeSource[];
  recurringBills: RecurringBill[];
  transactions: Transaction[];
  savingsGoals: SavingsGoal[];
  settings: AppSettings;
}

export type ForecastEventKind = "income" | "expense" | "bill" | "opening";

export interface ForecastEvent {
  id: string;
  date: string;
  name: string;
  amountGrosze: number; // signed: + income, - expense
  kind: ForecastEventKind;
  person: PersonId | "shared";
  confidence?: IncomeConfidence;
  /** Amount that would be used in full mode (for UI comparison). */
  typicalAmountGrosze?: number;
  /** Amount used in this forecast run. */
  appliedAmountGrosze: number;
  balanceAfterGrosze: number;
  sourceId?: string;
}

export interface NextConfirmedIncomeSummary {
  date: string;
  name: string;
  amountGrosze: number;
  daysUntil: number;
  balanceBeforeGrosze: number;
  balanceAfterGrosze: number;
}

export interface ForecastResult {
  mode: ForecastMode;
  horizonDays: number;
  asOfDate: string;
  horizonEndDate: string;
  currentBalanceGrosze: number;
  /** Balance used as path start (current minus reserved goals / one-off reservations). */
  openingForPathGrosze: number;
  reservedGrosze: number;
  safetyBufferGrosze: number;
  /** Future expected/forecast income totals (not fully counted in realistic safe-to-spend). */
  unconfirmedIncomeInHorizonGrosze: number;
  safeToSpendGrosze: number;
  lowestBalanceGrosze: number;
  lowestBalanceDate: string | null;
  deficitGrosze: number;
  deficitDate: string | null;
  events: ForecastEvent[];
  nextConfirmedIncome: NextConfirmedIncomeSummary | null;
}
