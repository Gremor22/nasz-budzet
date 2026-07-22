import { addDaysIso, daysBetween, generateOccurrences } from "@/lib/dates/calendar";
import type {
  BudgetState,
  ForecastEvent,
  ForecastMode,
  ForecastResult,
  IncomeConfidence,
  IncomeSource,
  NextConfirmedIncomeSummary,
  RecurringBill,
  Transaction,
} from "@/lib/data/types";

function incomeAppliedAmount(
  source: IncomeSource,
  mode: ForecastMode,
): { applied: number; typical: number } {
  const typical = source.typicalAmountGrosze;
  const safe = source.safeAmountGrosze;

  if (source.confidence === "confirmed") {
    return { applied: typical, typical };
  }

  if (mode === "cautious") {
    return { applied: 0, typical };
  }

  if (mode === "realistic") {
    if (source.confidence === "expected") {
      return { applied: safe, typical };
    }
    // forecast confidence — not in realistic
    return { applied: 0, typical };
  }

  // full mode
  return { applied: typical, typical };
}

function isActiveExpenseStatus(status: Transaction["status"]): boolean {
  return status === "planned" || status === "reserved" || status === "uncertain";
}

export function computeCurrentBalance(state: BudgetState): number {
  let balance = 0;
  for (const account of state.accounts) {
    if (!account.active || !account.includeInBudget) continue;
    balance += account.openingBalanceGrosze;
  }

  for (const tx of state.transactions) {
    if (tx.status === "cancelled") continue;
    if (tx.status !== "paid") continue;
    const account = state.accounts.find((a) => a.id === tx.accountId);
    if (!account || !account.includeInBudget) continue;
    balance += tx.type === "income" ? tx.amountGrosze : -tx.amountGrosze;
  }

  return balance;
}

export function computeAccountBalance(
  state: BudgetState,
  accountId: string,
): number {
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account || !account.active) return 0;
  let balance = account.openingBalanceGrosze;
  for (const tx of state.transactions) {
    if (tx.accountId !== accountId) continue;
    if (tx.status !== "paid") continue;
    balance += tx.type === "income" ? tx.amountGrosze : -tx.amountGrosze;
  }
  return balance;
}

export type OwnerBalanceRow = {
  owner: "pawel" | "milena" | "shared";
  label: string;
  grosze: number;
};

/** Salda wg właściciela konta + suma „razem”. myPersonId → „Moje” na górze. */
export function computeBalancesByOwner(
  state: BudgetState,
  myPersonId?: "pawel" | "milena" | null,
): {
  rows: OwnerBalanceRow[];
  totalGrosze: number;
  mineGrosze: number | null;
} {
  const labels = {
    pawel: "Paweł",
    milena: "Milena",
    shared: "Wspólne",
  } as const;
  const sums: Record<"pawel" | "milena" | "shared", number> = {
    pawel: 0,
    milena: 0,
    shared: 0,
  };

  for (const account of state.accounts) {
    if (!account.active || !account.includeInBudget) continue;
    const owner =
      account.owner === "pawel" || account.owner === "milena"
        ? account.owner
        : "shared";
    sums[owner] += computeAccountBalance(state, account.id);
  }

  const order: Array<"pawel" | "milena" | "shared"> =
    myPersonId === "milena"
      ? ["milena", "pawel", "shared"]
      : myPersonId === "pawel"
        ? ["pawel", "milena", "shared"]
        : ["pawel", "milena", "shared"];

  const rows: OwnerBalanceRow[] = order
    .filter((owner) =>
      state.accounts.some(
        (a) =>
          a.active &&
          a.includeInBudget &&
          (owner === "shared"
            ? a.owner === "shared"
            : a.owner === owner),
      ),
    )
    .map((owner) => ({
      owner,
      label:
        myPersonId && owner === myPersonId
          ? `Moje (${labels[owner]})`
          : labels[owner],
      grosze: sums[owner],
    }));

  return {
    rows,
    totalGrosze: computeCurrentBalance(state),
    mineGrosze: myPersonId ? sums[myPersonId] : null,
  };
}

export function computeReservedGrosze(state: BudgetState): number {
  let reserved = 0;

  for (const goal of state.savingsGoals) {
    if (goal.active && goal.reserved) {
      reserved += goal.savedAmountGrosze;
    }
  }

  for (const tx of state.transactions) {
    if (tx.type === "expense" && tx.status === "reserved") {
      reserved += tx.amountGrosze;
    }
  }

  for (const bill of state.recurringBills) {
    if (bill.active && bill.status === "reserved") {
      // reserved bills count when their occurrence is in the near term;
      // for the summary card we count the next occurrence amount once
      reserved += bill.amountGrosze;
    }
  }

  return reserved;
}

/**
 * Sum of future income in horizon that is not confirmed
 * (expected/forecast) — for UI transparency.
 * Uses typical amounts so the user sees the "hope" number separately.
 */
export function computeUnconfirmedIncomeTypical(
  state: BudgetState,
  asOfDate: string,
  horizonEnd: string,
): number {
  let total = 0;
  for (const source of state.incomeSources) {
    if (!source.active) continue;
    if (source.confidence === "confirmed") continue;
    const dates = generateOccurrences({
      frequency: source.frequency,
      nextOccurrenceDate: source.nextOccurrenceDate,
      endDate: source.endDate,
      dayOfMonth: source.dayOfMonth,
      horizonStart: asOfDate,
      horizonEnd,
    });
    total += dates.length * source.typicalAmountGrosze;
  }
  return total;
}

function collectEvents(
  state: BudgetState,
  mode: ForecastMode,
  asOfDate: string,
  horizonEnd: string,
): Omit<ForecastEvent, "balanceAfterGrosze">[] {
  const events: Omit<ForecastEvent, "balanceAfterGrosze">[] = [];

  for (const source of state.incomeSources) {
    if (!source.active) continue;
    const { applied, typical } = incomeAppliedAmount(source, mode);
    const dates = generateOccurrences({
      frequency: source.frequency,
      nextOccurrenceDate: source.nextOccurrenceDate,
      endDate: source.endDate,
      dayOfMonth: source.dayOfMonth,
      horizonStart: asOfDate,
      horizonEnd,
    });

    for (const date of dates) {
      // Skip if a paid transaction already recorded for this source on this date
      const alreadyPaid = state.transactions.some(
        (tx) =>
          tx.type === "income" &&
          tx.status === "paid" &&
          tx.incomeSourceId === source.id &&
          tx.date === date,
      );
      if (alreadyPaid) continue;

      events.push({
        id: `income-${source.id}-${date}`,
        date,
        name: source.name,
        amountGrosze: applied,
        kind: "income",
        person: source.owner,
        confidence: source.confidence,
        typicalAmountGrosze: typical,
        appliedAmountGrosze: applied,
        sourceId: source.id,
      });
    }
  }

  for (const bill of state.recurringBills) {
    if (!bill.active || bill.status === "cancelled") continue;
    const dates = generateOccurrences({
      frequency: bill.frequency,
      nextOccurrenceDate: bill.nextOccurrenceDate,
      endDate: bill.endDate,
      dayOfMonth: bill.dayOfMonth,
      horizonStart: asOfDate,
      horizonEnd,
    });
    for (const date of dates) {
      events.push({
        id: `bill-${bill.id}-${date}`,
        date,
        name: bill.name,
        amountGrosze: -bill.amountGrosze,
        kind: "bill",
        person: bill.paidBy,
        appliedAmountGrosze: -bill.amountGrosze,
        sourceId: bill.id,
      });
    }
  }

  for (const tx of state.transactions) {
    if (tx.status === "cancelled" || tx.status === "paid") continue;
    if (!isActiveExpenseStatus(tx.status) && tx.type === "expense") continue;
    // Future planned/reserved/uncertain expenses and planned incomes
    if (tx.date < asOfDate) continue;
    if (tx.date > horizonEnd) continue;

    const signed =
      tx.type === "income" ? tx.amountGrosze : -tx.amountGrosze;

    events.push({
      id: `tx-${tx.id}`,
      date: tx.date,
      name: tx.description,
      amountGrosze: signed,
      kind: tx.type === "income" ? "income" : "expense",
      person: tx.person,
      appliedAmountGrosze: signed,
      sourceId: tx.id,
    });
  }

  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    // expenses/bills before income on same day (pessimistic intraday)
    const rank = (k: string) => (k === "income" ? 1 : 0);
    return rank(a.kind) - rank(b.kind);
  });

  return events;
}

function simulate(
  openingBalance: number,
  rawEvents: Omit<ForecastEvent, "balanceAfterGrosze">[],
): { events: ForecastEvent[]; lowest: number; lowestDate: string | null } {
  let balance = openingBalance;
  let lowest = balance;
  let lowestDate: string | null = null;
  const events: ForecastEvent[] = [];

  for (const e of rawEvents) {
    balance += e.appliedAmountGrosze;
    events.push({ ...e, balanceAfterGrosze: balance });
    if (balance < lowest) {
      lowest = balance;
      lowestDate = e.date;
    }
  }

  return { events, lowest, lowestDate };
}

function findNextConfirmedIncome(
  state: BudgetState,
  asOfDate: string,
  openingBalance: number,
  mode: ForecastMode,
): NextConfirmedIncomeSummary | null {
  // Look up to 120 days ahead for the next confirmed income
  const lookEnd = addDaysIso(asOfDate, 120);
  const raw = collectEvents(state, mode, asOfDate, lookEnd);
  const confirmed = raw.filter(
    (e) => e.kind === "income" && e.confidence === "confirmed" && e.appliedAmountGrosze > 0,
  );
  if (confirmed.length === 0) return null;

  const next = confirmed[0];
  // Simulate until that income (including events on that day: bills first, then incomes)
  const until = raw.filter((e) => e.date <= next.date);
  const { events } = simulate(openingBalance, until);

  const incomeEvent = events.find((e) => e.id === next.id);
  if (!incomeEvent) return null;

  const balanceAfter = incomeEvent.balanceAfterGrosze;
  const balanceBefore = balanceAfter - incomeEvent.appliedAmountGrosze;

  return {
    date: next.date,
    name: next.name,
    amountGrosze: next.appliedAmountGrosze,
    daysUntil: daysBetween(asOfDate, next.date),
    balanceBeforeGrosze: balanceBefore,
    balanceAfterGrosze: balanceAfter,
  };
}

/**
 * Safe-to-spend:
 * If we spend S today, every future point drops by S.
 * We need lowestBalance - S >= safetyBuffer
 * ⇒ S <= lowestBalance - safetyBuffer
 *
 * Opening balance for the path already subtracts reserved funds
 * (reserved goals + reserved one-off expenses), so they are not double-spent.
 *
 * Recurring reserved bills appear as dated outflows (and also in reserved summary);
 * for the path we use dated outflows only — reserved summary is informational
 * and we subtract reserved goals + reserved one-off txs from opening.
 */
export function computeForecast(state: BudgetState): ForecastResult {
  const asOfDate = state.settings.asOfDate;
  const mode = state.settings.forecastMode;
  const horizonDays = state.settings.horizonDays;
  const horizonEnd = addDaysIso(asOfDate, horizonDays);
  const buffer = state.household.safetyBufferGrosze;

  const currentBalance = computeCurrentBalance(state);

  const reservedGoalsAndTx = state.savingsGoals
    .filter((g) => g.active && g.reserved)
    .reduce((s, g) => s + g.savedAmountGrosze, 0)
    + state.transactions
      .filter((t) => t.type === "expense" && t.status === "reserved")
      .reduce((s, t) => s + t.amountGrosze, 0);

  // Reserved recurring bills: counted in reserved display, but path uses dates.
  const reservedBills = state.recurringBills
    .filter((b) => b.active && b.status === "reserved")
    .reduce((s, b) => s + b.amountGrosze, 0);

  const reservedGrosze = reservedGoalsAndTx + reservedBills;

  // Opening for simulation: current minus reserved goals/one-offs (cannot spend those).
  // Reserved bills stay as dated events (status reserved still generates bill events).
  const openingForPath = currentBalance - reservedGoalsAndTx;

  const rawEvents = collectEvents(state, mode, asOfDate, horizonEnd);
  // Exclude reserved one-off txs from path if we already subtracted them from opening
  const pathEvents = rawEvents.filter((e) => {
    if (e.kind !== "expense") return true;
    const tx = state.transactions.find((t) => t.id === e.sourceId);
    return !(tx && tx.status === "reserved");
  });

  const { events, lowest, lowestDate } = simulate(openingForPath, pathEvents);

  const safeToSpendGrosze = lowest - buffer;

  const deficitGrosze = lowest < 0 ? -lowest : 0;
  const deficitDate = lowest < 0 ? lowestDate : null;

  const unconfirmedIncomeInHorizonGrosze = computeUnconfirmedIncomeTypical(
    state,
    asOfDate,
    horizonEnd,
  );

  const nextConfirmedIncome = findNextConfirmedIncome(
    state,
    asOfDate,
    openingForPath,
    mode,
  );

  return {
    mode,
    horizonDays,
    asOfDate,
    horizonEndDate: horizonEnd,
    currentBalanceGrosze: currentBalance,
    openingForPathGrosze: openingForPath,
    reservedGrosze,
    safetyBufferGrosze: buffer,
    unconfirmedIncomeInHorizonGrosze,
    safeToSpendGrosze,
    lowestBalanceGrosze: lowest,
    lowestBalanceDate: lowestDate,
    deficitGrosze,
    deficitDate,
    events,
    nextConfirmedIncome,
  };
}

/** Helpers exported for tests */
export function resolveIncomeAmountForMode(
  confidence: IncomeConfidence,
  typicalGrosze: number,
  safeGrosze: number,
  mode: ForecastMode,
): number {
  const source: IncomeSource = {
    id: "t",
    name: "t",
    owner: "pawel",
    typicalAmountGrosze: typicalGrosze,
    safeAmountGrosze: safeGrosze,
    frequency: "once",
    nextOccurrenceDate: "2026-01-01",
    confidence,
    active: true,
  };
  return incomeAppliedAmount(source, mode).applied;
}

export function generateBillOccurrences(
  bill: Pick<
    RecurringBill,
    "frequency" | "nextOccurrenceDate" | "endDate" | "dayOfMonth"
  >,
  horizonStart: string,
  horizonEnd: string,
): string[] {
  return generateOccurrences({
    frequency: bill.frequency,
    nextOccurrenceDate: bill.nextOccurrenceDate,
    endDate: bill.endDate,
    dayOfMonth: bill.dayOfMonth,
    horizonStart,
    horizonEnd,
  });
}
