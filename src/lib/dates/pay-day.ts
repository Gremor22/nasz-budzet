import { addMonths, format, parseISO, setDate } from "date-fns";
import { todayIsoWarsaw } from "@/lib/dates/today";

/** Najbliższa data wypłaty (dzień miesiąca) od dziś. */
export function nextMonthlyPayDate(dayOfMonth: number, fromIso?: string): string {
  const from = parseISO(fromIso ?? todayIsoWarsaw());
  const day = Math.min(Math.max(1, dayOfMonth), 28);
  let candidate = setDate(from, day);
  if (candidate <= from) {
    candidate = setDate(addMonths(from, 1), day);
  }
  return format(candidate, "yyyy-MM-dd");
}
