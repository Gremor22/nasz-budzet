import {
  addMonths,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import { addDaysIso, generateOccurrences } from "@/lib/dates/calendar";
import type { BudgetState, IncomeSource, Transaction } from "@/lib/data/types";

function resolveBudgetWindowStart(state: BudgetState): string {
  const asOf = state.settings.asOfDate;
  if (state.household.budgetStartedDate) {
    return format(
      startOfMonth(parseISO(state.household.budgetStartedDate)),
      "yyyy-MM-dd",
    );
  }
  return format(startOfMonth(parseISO(asOf)), "yyyy-MM-dd");
}

function defaultAccountId(state: BudgetState): string | null {
  return (
    state.accounts.find((a) => a.active && a.includeInBudget)?.id ?? null
  );
}

function monthlyOnDayDates(
  dayOfMonth: number,
  windowStart: string,
  windowEnd: string,
): string[] {
  const start = parseISO(windowStart);
  const end = parseISO(windowEnd);
  const out: string[] = [];
  let cur = startOfMonth(start);
  while (cur <= end) {
    const last = endOfMonth(cur).getDate();
    const day = Math.min(dayOfMonth, last);
    const occ = format(
      new Date(cur.getFullYear(), cur.getMonth(), day),
      "yyyy-MM-dd",
    );
    if (occ >= windowStart && occ <= windowEnd) out.push(occ);
    cur = addMonths(cur, 1);
  }
  return out;
}

/** Daty wpływów ze źródła w oknie (wstecz + naprzód — także bieżący miesiąc). */
export function listIncomeOccurrences(
  source: IncomeSource,
  windowStart: string,
  windowEnd: string,
): string[] {
  if (!source.active) return [];

  if (source.frequency === "monthly_on_day" && source.dayOfMonth) {
    return monthlyOnDayDates(source.dayOfMonth, windowStart, windowEnd);
  }

  if (source.frequency === "monthly") {
    const day = parseISO(source.nextOccurrenceDate).getDate();
    return monthlyOnDayDates(day, windowStart, windowEnd);
  }

  if (source.frequency === "once" || source.frequency === "irregular") {
    const d = source.nextOccurrenceDate;
    return d >= windowStart && d <= windowEnd ? [d] : [];
  }

  // weekly / biweekly / last_business_day — cofnij anchor, żeby objąć wcześniejsze miesiące
  let anchor = source.nextOccurrenceDate;
  let guard = 0;
  while (anchor > windowStart && guard < 120) {
    const prev = generateOccurrences({
      frequency: source.frequency,
      nextOccurrenceDate: addDaysIso(anchor, -400),
      dayOfMonth: source.dayOfMonth,
      endDate: addDaysIso(anchor, -1),
      horizonStart: windowStart,
      horizonEnd: addDaysIso(anchor, -1),
    });
    if (prev.length === 0) break;
    anchor = prev[prev.length - 1] ?? anchor;
    if (anchor <= windowStart) break;
    guard += 1;
  }

  return generateOccurrences({
    frequency: source.frequency,
    nextOccurrenceDate: anchor,
    endDate: source.endDate,
    dayOfMonth: source.dayOfMonth,
    horizonStart: windowStart,
    horizonEnd: windowEnd,
  });
}

function incomeStatus(date: string, asOfDate: string): Transaction["status"] {
  return date <= asOfDate ? "paid" : "planned";
}

function buildIncomeTx(
  source: IncomeSource,
  date: string,
  accountId: string,
  asOfDate: string,
  now: string,
): Omit<Transaction, "id"> {
  return {
    type: "income",
    amountGrosze: source.typicalAmountGrosze,
    date,
    description: source.name,
    category: "Wpływ",
    person: source.owner,
    paidBy: source.owner,
    isShared: false,
    status: incomeStatus(date, asOfDate),
    accountId,
    incomeSourceId: source.id,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Źródła dochodu → transakcje wpływu (planowane / otrzymane).
 * Przeszłe i dzisiejsze daty = opłacone (saldo + wpływy), przyszłe = planowane.
 */
export function applyIncomeSourceSync(state: BudgetState): BudgetState {
  const accountId = defaultAccountId(state);
  if (!accountId) return state;

  const asOf = state.settings.asOfDate;
  const windowStart = resolveBudgetWindowStart(state);
  const windowEnd = format(
    endOfMonth(addMonths(parseISO(asOf), 2)),
    "yyyy-MM-dd",
  );
  const now = new Date().toISOString();
  const activeIds = new Set(state.incomeSources.map((s) => s.id));

  let transactions = [...state.transactions];

  // Usuń wpływy auto-sync sprzed startu budżetu
  transactions = transactions.filter((t) => {
    if (!t.incomeSourceId) return true;
    return t.date >= windowStart;
  });
  transactions = transactions.filter((t) => {
    if (!t.incomeSourceId) return true;
    if (t.status === "paid") return true;
    if (!activeIds.has(t.incomeSourceId)) return false;
    const src = state.incomeSources.find((s) => s.id === t.incomeSourceId);
    return src?.active ?? false;
  });

  for (const source of state.incomeSources) {
    if (!source.active) {
      transactions = transactions.filter(
        (t) =>
          !(t.incomeSourceId === source.id && t.status === "planned"),
      );
      continue;
    }

    const dates = new Set(
      listIncomeOccurrences(source, windowStart, windowEnd),
    );

    transactions = transactions.filter((t) => {
      if (t.incomeSourceId !== source.id) return true;
      if (t.status === "paid") return true;
      return dates.has(t.date);
    });

    for (const date of dates) {
      const existing = transactions.find(
        (t) =>
          t.incomeSourceId === source.id &&
          t.type === "income" &&
          t.date === date,
      );
      const status = incomeStatus(date, asOf);

      if (existing) {
        if (existing.status === "planned") {
          transactions = transactions.map((t) =>
            t.id === existing.id
              ? {
                  ...t,
                  amountGrosze: source.typicalAmountGrosze,
                  description: source.name,
                  status,
                  updatedAt: now,
                }
              : t,
          );
        }
        continue;
      }

      const draft = buildIncomeTx(source, date, accountId, asOf, now);
      transactions.push({
        ...draft,
        id: `tx-${crypto.randomUUID()}`,
      });
    }
  }

  return { ...state, transactions };
}

export function incomeSourceSyncChanged(
  before: BudgetState,
  after: BudgetState,
): boolean {
  if (before.transactions.length !== after.transactions.length) return true;
  const afterById = new Map(after.transactions.map((t) => [t.id, t]));
  for (const t of before.transactions) {
    const n = afterById.get(t.id);
    if (!n) return true;
    if (
      t.amountGrosze !== n.amountGrosze ||
      t.date !== n.date ||
      t.status !== n.status ||
      t.description !== n.description
    ) {
      return true;
    }
  }
  return false;
}
