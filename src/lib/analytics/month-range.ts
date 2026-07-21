import {
  addMonths,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import { pl } from "date-fns/locale";
import type { DateRange } from "@/lib/analytics/summary";

export function monthKeyFromDate(iso: string): string {
  const d = parseISO(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m };
}

export function monthRangeFromKey(key: string): DateRange {
  const { year, month } = parseMonthKey(key);
  const start = startOfMonth(new Date(year, month - 1, 1));
  const end = endOfMonth(start);
  const raw = format(start, "LLLL yyyy", { locale: pl });
  const label = raw.charAt(0).toUpperCase() + raw.slice(1);
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
    label,
  };
}

export function shiftMonthKey(key: string, delta: number): string {
  const { year, month } = parseMonthKey(key);
  const shifted = addMonths(new Date(year, month - 1, 1), delta);
  return monthKeyFromDate(format(shifted, "yyyy-MM-dd"));
}

/** Wpływy / wydatki / oszczędności w danym miesiącu. */
export function savingsExpenseGrosze(
  transactions: import("@/lib/data/types").Transaction[],
  range: DateRange,
): number {
  return transactions
    .filter(
      (t) =>
        t.type === "expense" &&
        t.status !== "cancelled" &&
        t.category === "Oszczędności" &&
        t.date >= range.start &&
        t.date <= range.end,
    )
    .reduce((s, t) => s + t.amountGrosze, 0);
}
