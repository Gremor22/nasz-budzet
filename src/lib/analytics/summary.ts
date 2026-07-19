import {
  addDays,
  endOfMonth,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import type { Transaction } from "@/lib/data/types";

export type AnalyticsPeriodKey =
  | "7d"
  | "month"
  | "prev_month"
  | "3m"
  | "6m"
  | "year"
  | "custom";

export interface DateRange {
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
  label: string;
}

export interface CategorySlice {
  category: string;
  amountGrosze: number;
  percent: number;
}

export interface PersonSlice {
  person: string;
  amountGrosze: number;
}

export interface AnalyticsSummary {
  range: DateRange;
  previousRange: DateRange;
  expenseTotalGrosze: number;
  incomeTotalGrosze: number;
  netGrosze: number;
  previousExpenseTotalGrosze: number;
  expenseChangeGrosze: number;
  byCategory: CategorySlice[];
  byPerson: PersonSlice[];
  sharedExpenseGrosze: number;
  personalExpenseGrosze: number;
  topExpenses: Transaction[];
}

function toIso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function resolvePeriod(
  key: AnalyticsPeriodKey,
  asOfIso: string,
  custom?: { start: string; end: string },
): DateRange {
  const asOf = startOfDay(parseISO(asOfIso));

  switch (key) {
    case "7d": {
      const start = addDays(asOf, -6);
      return {
        start: toIso(start),
        end: toIso(asOf),
        label: "Ostatnie 7 dni",
      };
    }
    case "month": {
      const start = startOfMonth(asOf);
      const end = endOfMonth(asOf);
      return {
        start: toIso(start),
        end: toIso(end > asOf ? asOf : end),
        label: "Bieżący miesiąc",
      };
    }
    case "prev_month": {
      const prev = subMonths(asOf, 1);
      return {
        start: toIso(startOfMonth(prev)),
        end: toIso(endOfMonth(prev)),
        label: "Poprzedni miesiąc",
      };
    }
    case "3m": {
      const start = startOfMonth(subMonths(asOf, 2));
      return {
        start: toIso(start),
        end: toIso(asOf),
        label: "3 miesiące",
      };
    }
    case "6m": {
      const start = startOfMonth(subMonths(asOf, 5));
      return {
        start: toIso(start),
        end: toIso(asOf),
        label: "6 miesięcy",
      };
    }
    case "year": {
      const start = startOfMonth(subMonths(asOf, 11));
      return {
        start: toIso(start),
        end: toIso(asOf),
        label: "12 miesięcy",
      };
    }
    case "custom": {
      if (!custom?.start || !custom?.end) {
        throw new Error("Podaj zakres własny");
      }
      return {
        start: custom.start,
        end: custom.end,
        label: "Własny zakres",
      };
    }
  }
}

/** Previous period of the same length ending day before current start. */
export function previousRangeOfSameLength(range: DateRange): DateRange {
  const start = parseISO(range.start);
  const end = parseISO(range.end);
  const days =
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  return {
    start: toIso(prevStart),
    end: toIso(prevEnd),
    label: "Poprzedni okres",
  };
}

function inRange(dateIso: string, range: DateRange): boolean {
  return dateIso >= range.start && dateIso <= range.end;
}

function isCountedExpense(tx: Transaction): boolean {
  return (
    tx.type === "expense" &&
    tx.status !== "cancelled" &&
    (tx.status === "paid" ||
      tx.status === "planned" ||
      tx.status === "reserved" ||
      tx.status === "uncertain")
  );
}

function isCountedIncome(tx: Transaction): boolean {
  return (
    tx.type === "income" &&
    tx.status !== "cancelled" &&
    (tx.status === "paid" || tx.status === "planned")
  );
}

export function computeAnalytics(
  transactions: Transaction[],
  range: DateRange,
): AnalyticsSummary {
  const previousRange = previousRangeOfSameLength(range);

  const inCurrent = transactions.filter((t) => inRange(t.date, range));
  const inPrev = transactions.filter((t) => inRange(t.date, previousRange));

  const expenses = inCurrent.filter(isCountedExpense);
  const incomes = inCurrent.filter(isCountedIncome);
  const prevExpenses = inPrev.filter(isCountedExpense);

  const expenseTotalGrosze = expenses.reduce((s, t) => s + t.amountGrosze, 0);
  const incomeTotalGrosze = incomes.reduce((s, t) => s + t.amountGrosze, 0);
  const previousExpenseTotalGrosze = prevExpenses.reduce(
    (s, t) => s + t.amountGrosze,
    0,
  );

  const categoryMap = new Map<string, number>();
  for (const t of expenses) {
    const key = t.category || "Inne";
    categoryMap.set(key, (categoryMap.get(key) ?? 0) + t.amountGrosze);
  }
  const byCategory: CategorySlice[] = [...categoryMap.entries()]
    .map(([category, amountGrosze]) => ({
      category,
      amountGrosze,
      percent:
        expenseTotalGrosze > 0
          ? Math.round((amountGrosze / expenseTotalGrosze) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.amountGrosze - a.amountGrosze);

  const personMap = new Map<string, number>();
  for (const t of expenses) {
    const key =
      t.person === "shared"
        ? "Wspólne"
        : t.person === "pawel"
          ? "Paweł"
          : "Milena";
    personMap.set(key, (personMap.get(key) ?? 0) + t.amountGrosze);
  }
  const byPerson: PersonSlice[] = [...personMap.entries()]
    .map(([person, amountGrosze]) => ({ person, amountGrosze }))
    .sort((a, b) => b.amountGrosze - a.amountGrosze);

  const sharedExpenseGrosze = expenses
    .filter((t) => t.isShared || t.person === "shared")
    .reduce((s, t) => s + t.amountGrosze, 0);
  const personalExpenseGrosze = expenseTotalGrosze - sharedExpenseGrosze;

  const topExpenses = [...expenses]
    .sort((a, b) => b.amountGrosze - a.amountGrosze)
    .slice(0, 5);

  return {
    range,
    previousRange,
    expenseTotalGrosze,
    incomeTotalGrosze,
    netGrosze: incomeTotalGrosze - expenseTotalGrosze,
    previousExpenseTotalGrosze,
    expenseChangeGrosze: expenseTotalGrosze - previousExpenseTotalGrosze,
    byCategory,
    byPerson,
    sharedExpenseGrosze,
    personalExpenseGrosze,
    topExpenses,
  };
}
