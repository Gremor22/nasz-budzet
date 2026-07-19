import {
  addDays,
  addMonths,
  addWeeks,
  format,
  getDay,
  isAfter,
  isBefore,
  isWeekend,
  parseISO,
  startOfDay,
} from "date-fns";
import { pl } from "date-fns/locale";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(iso: string): Date {
  if (!DATE_RE.test(iso)) {
    throw new Error(`Invalid date: ${iso}`);
  }
  return startOfDay(parseISO(iso));
}

export function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatDatePl(iso: string): string {
  return format(parseDate(iso), "d MMMM yyyy", { locale: pl });
}

export function formatDateShortPl(iso: string): string {
  return format(parseDate(iso), "dd.MM.yyyy");
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = parseDate(fromIso);
  const to = parseDate(toIso);
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export function addDaysIso(iso: string, days: number): string {
  return toIsoDate(addDays(parseDate(iso), days));
}

/** Last business day of the month containing `date`. */
export function lastBusinessDayOfMonth(date: Date): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  let d = new Date(year, month + 1, 0); // last calendar day
  while (isWeekend(d)) {
    d = addDays(d, -1);
  }
  return startOfDay(d);
}

/**
 * Generate occurrence dates from nextOccurrenceDate inclusive through horizonEnd inclusive.
 */
export function generateOccurrences(options: {
  frequency: string;
  nextOccurrenceDate: string;
  endDate?: string;
  dayOfMonth?: number;
  horizonStart: string;
  horizonEnd: string;
}): string[] {
  const {
    frequency,
    nextOccurrenceDate,
    endDate,
    dayOfMonth,
    horizonStart,
    horizonEnd,
  } = options;

  const start = parseDate(horizonStart);
  const end = parseDate(horizonEnd);
  const hardEnd = endDate ? parseDate(endDate) : null;
  const results: string[] = [];

  let cursor = parseDate(nextOccurrenceDate);

  // Walk forward from nextOccurrence, but also allow regenerating monthly from rules
  // if nextOccurrence is before horizon — still include only dates within [horizonStart, horizonEnd]
  const maxIterations = 400;
  let i = 0;

  while (i < maxIterations && !isAfter(cursor, end)) {
    i += 1;
    if (hardEnd && isAfter(cursor, hardEnd)) break;

    if (!isBefore(cursor, start)) {
      results.push(toIsoDate(cursor));
    }

    if (frequency === "once" || frequency === "irregular") {
      break;
    }

    cursor = nextAfter(cursor, frequency, dayOfMonth);
  }

  return results;
}

function nextAfter(
  current: Date,
  frequency: string,
  dayOfMonth?: number,
): Date {
  switch (frequency) {
    case "weekly":
      return addWeeks(current, 1);
    case "biweekly":
      return addWeeks(current, 2);
    case "monthly":
    case "monthly_on_day": {
      const targetDay = dayOfMonth ?? current.getDate();
      let next = addMonths(current, 1);
      const lastDay = new Date(
        next.getFullYear(),
        next.getMonth() + 1,
        0,
      ).getDate();
      next = new Date(
        next.getFullYear(),
        next.getMonth(),
        Math.min(targetDay, lastDay),
      );
      return startOfDay(next);
    }
    case "last_business_day": {
      const nextMonth = addMonths(current, 1);
      return lastBusinessDayOfMonth(nextMonth);
    }
    default:
      return addMonths(current, 1);
  }
}

/** Count weekly occurrences that fall in a calendar month (for tests). */
export function countWeeklyInMonth(
  firstDateIso: string,
  year: number,
  monthIndex0: number,
): number {
  const monthStart = new Date(year, monthIndex0, 1);
  const monthEnd = new Date(year, monthIndex0 + 1, 0);
  return generateOccurrences({
    frequency: "weekly",
    nextOccurrenceDate: firstDateIso,
    horizonStart: toIsoDate(monthStart),
    horizonEnd: toIsoDate(monthEnd),
  }).length;
}

export function isWeekday(iso: string): boolean {
  const day = getDay(parseDate(iso));
  return day !== 0 && day !== 6;
}
