import { describe, expect, it } from "vitest";
import { countWeeklyInMonth, generateOccurrences, lastBusinessDayOfMonth, toIsoDate } from "@/lib/dates/calendar";
import {
  computeForecast,
  resolveIncomeAmountForMode,
} from "@/lib/forecast/engine";
import { createDemoState } from "@/lib/data/demo-data";
import type { BudgetState } from "@/lib/data/types";
import { zlToGrosze } from "@/lib/money/format";

function emptyState(overrides: Partial<BudgetState> = {}): BudgetState {
  const base = createDemoState();
  return {
    ...base,
    accounts: [
      {
        id: "acc",
        name: "Test",
        owner: "shared",
        type: "shared",
        openingBalanceGrosze: zlToGrosze(1000),
        includeInBudget: true,
        active: true,
      },
    ],
    incomeSources: [],
    recurringBills: [],
    transactions: [],
    savingsGoals: [],
    household: {
      ...base.household,
      safetyBufferGrosze: 0,
    },
    settings: {
      asOfDate: "2026-07-01",
      forecastMode: "realistic",
      horizonDays: 14,
    },
    ...overrides,
  };
}

describe("resolveIncomeAmountForMode", () => {
  it("uses safe amount for expected income in realistic mode", () => {
    expect(
      resolveIncomeAmountForMode("expected", 300_000, 200_000, "realistic"),
    ).toBe(200_000);
  });

  it("uses typical amount for expected income in full mode", () => {
    expect(
      resolveIncomeAmountForMode("expected", 300_000, 200_000, "full"),
    ).toBe(300_000);
  });

  it("ignores expected income in cautious mode", () => {
    expect(
      resolveIncomeAmountForMode("expected", 300_000, 200_000, "cautious"),
    ).toBe(0);
  });

  it("includes confirmed at typical in all modes", () => {
    expect(
      resolveIncomeAmountForMode("confirmed", 300_000, 200_000, "cautious"),
    ).toBe(300_000);
    expect(
      resolveIncomeAmountForMode("confirmed", 300_000, 200_000, "realistic"),
    ).toBe(300_000);
  });

  it("includes forecast only in full mode", () => {
    expect(
      resolveIncomeAmountForMode("forecast", 100_000, 0, "realistic"),
    ).toBe(0);
    expect(resolveIncomeAmountForMode("forecast", 100_000, 0, "full")).toBe(
      100_000,
    );
  });
});

describe("income before large bill (no false safety)", () => {
  it("shows risk when a large bill follows a nearer income", () => {
    const state = emptyState({
      accounts: [
        {
          id: "acc",
          name: "Test",
          owner: "shared",
          type: "shared",
          openingBalanceGrosze: zlToGrosze(1000),
          includeInBudget: true,
          active: true,
        },
      ],
      incomeSources: [
        {
          id: "inc",
          name: "Wpływ",
          owner: "pawel",
          typicalAmountGrosze: zlToGrosze(500),
          safeAmountGrosze: zlToGrosze(500),
          frequency: "once",
          nextOccurrenceDate: "2026-07-03",
          confidence: "confirmed",
          active: true,
        },
      ],
      recurringBills: [
        {
          id: "bill",
          name: "Duży rachunek",
          amountGrosze: zlToGrosze(2000),
          frequency: "once",
          nextOccurrenceDate: "2026-07-05",
          active: true,
          status: "planned",
          paidBy: "shared",
          category: "Dom",
        },
      ],
      settings: {
        asOfDate: "2026-07-01",
        forecastMode: "realistic",
        horizonDays: 14,
      },
    });

    const result = computeForecast(state);

    // Path: 1000 → +500 = 1500 → -2000 = -500
    expect(result.lowestBalanceGrosze).toBe(zlToGrosze(-500));
    expect(result.lowestBalanceDate).toBe("2026-07-05");
    expect(result.deficitGrosze).toBe(zlToGrosze(500));
    // Safe to spend must be negative / tight — not falsely based only on income
    expect(result.safeToSpendGrosze).toBe(zlToGrosze(-500));
    expect(result.safeToSpendGrosze).toBeLessThan(zlToGrosze(500));
  });
});

describe("five weekly incomes in one month", () => {
  it("counts five weekly occurrences in a long month", () => {
    // July 2026 has 5 Wednesdays if we start Wed 2026-07-01
    const count = countWeeklyInMonth("2026-07-01", 2026, 6);
    expect(count).toBe(5);

    const dates = generateOccurrences({
      frequency: "weekly",
      nextOccurrenceDate: "2026-07-01",
      horizonStart: "2026-07-01",
      horizonEnd: "2026-07-31",
    });
    expect(dates).toHaveLength(5);
    expect(dates[0]).toBe("2026-07-01");
    expect(dates[4]).toBe("2026-07-29");
  });

  it("includes five weekly incomes in forecast for July 2026", () => {
    const state = emptyState({
      accounts: [
        {
          id: "acc",
          name: "Test",
          owner: "shared",
          type: "shared",
          openingBalanceGrosze: 0,
          includeInBudget: true,
          active: true,
        },
      ],
      incomeSources: [
        {
          id: "weekly",
          name: "Tygodniówka",
          owner: "pawel",
          typicalAmountGrosze: zlToGrosze(1000),
          safeAmountGrosze: zlToGrosze(1000),
          frequency: "weekly",
          nextOccurrenceDate: "2026-07-01",
          confidence: "confirmed",
          active: true,
        },
      ],
      settings: {
        asOfDate: "2026-07-01",
        forecastMode: "realistic",
        horizonDays: 30,
      },
    });

    const result = computeForecast(state);
    const weekly = result.events.filter((e) => e.sourceId === "weekly");
    expect(weekly.length).toBeGreaterThanOrEqual(5);
  });
});

describe("safe amount lower than typical", () => {
  it("realistic uses safe; full uses typical — changes deficit after a bill", () => {
    const base = emptyState({
      accounts: [
        {
          id: "acc",
          name: "Test",
          owner: "shared",
          type: "shared",
          openingBalanceGrosze: zlToGrosze(1000),
          includeInBudget: true,
          active: true,
        },
      ],
      incomeSources: [
        {
          id: "inc",
          name: "Oczekiwany",
          owner: "pawel",
          typicalAmountGrosze: zlToGrosze(3000),
          safeAmountGrosze: zlToGrosze(2000),
          frequency: "once",
          nextOccurrenceDate: "2026-07-05",
          confidence: "expected",
          active: true,
        },
      ],
      recurringBills: [
        {
          id: "bill",
          name: "Rachunek",
          amountGrosze: zlToGrosze(2500),
          frequency: "once",
          nextOccurrenceDate: "2026-07-10",
          active: true,
          status: "planned",
          paidBy: "shared",
          category: "Dom",
        },
      ],
    });

    const realistic = computeForecast({
      ...base,
      settings: { ...base.settings, forecastMode: "realistic" },
    });
    const full = computeForecast({
      ...base,
      settings: { ...base.settings, forecastMode: "full" },
    });
    const cautious = computeForecast({
      ...base,
      settings: { ...base.settings, forecastMode: "cautious" },
    });

    const incomeRealistic = realistic.events.find((e) => e.sourceId === "inc");
    const incomeFull = full.events.find((e) => e.sourceId === "inc");
    const incomeCautious = cautious.events.find((e) => e.sourceId === "inc");

    expect(incomeRealistic?.appliedAmountGrosze).toBe(zlToGrosze(2000));
    expect(incomeFull?.appliedAmountGrosze).toBe(zlToGrosze(3000));
    expect(incomeCautious?.appliedAmountGrosze).toBe(0);

    // realistic: 1000 + 2000 - 2500 = 500
    expect(realistic.lowestBalanceGrosze).toBe(zlToGrosze(500));
    // full: 1000 + 3000 - 2500 = 1500, lowest at start = 1000
    expect(full.lowestBalanceGrosze).toBe(zlToGrosze(1000));
    // cautious: 1000 - 2500 = -1500
    expect(cautious.lowestBalanceGrosze).toBe(zlToGrosze(-1500));

    expect(realistic.safeToSpendGrosze).toBeGreaterThan(cautious.safeToSpendGrosze);
    expect(full.safeToSpendGrosze).toBeGreaterThan(realistic.safeToSpendGrosze);
  });
});

describe("reserved goals and buffer", () => {
  it("reserved goal reduces safe-to-spend; unreserved does not", () => {
    const withReserved = emptyState({
      accounts: [
        {
          id: "acc",
          name: "Test",
          owner: "shared",
          type: "shared",
          openingBalanceGrosze: zlToGrosze(1000),
          includeInBudget: true,
          active: true,
        },
      ],
      savingsGoals: [
        {
          id: "g1",
          name: "Cel",
          targetAmountGrosze: zlToGrosze(5000),
          savedAmountGrosze: zlToGrosze(300),
          reserved: true,
          owner: "shared",
          active: true,
        },
      ],
    });

    const withPlanOnly = emptyState({
      accounts: withReserved.accounts,
      savingsGoals: [
        {
          id: "g1",
          name: "Cel",
          targetAmountGrosze: zlToGrosze(5000),
          savedAmountGrosze: zlToGrosze(300),
          reserved: false,
          owner: "shared",
          active: true,
        },
      ],
    });

    expect(computeForecast(withReserved).safeToSpendGrosze).toBe(
      zlToGrosze(700),
    );
    expect(computeForecast(withPlanOnly).safeToSpendGrosze).toBe(
      zlToGrosze(1000),
    );
  });

  it("subtracts safety buffer from safe-to-spend", () => {
    const state = emptyState({
      accounts: [
        {
          id: "acc",
          name: "Test",
          owner: "shared",
          type: "shared",
          openingBalanceGrosze: zlToGrosze(1000),
          includeInBudget: true,
          active: true,
        },
      ],
      household: {
        id: "hh",
        name: "Test",
        safetyBufferGrosze: zlToGrosze(200),
        defaultForecastMode: "realistic",
        defaultHorizonDays: 14,
      },
    });

    expect(computeForecast(state).safeToSpendGrosze).toBe(zlToGrosze(800));
  });
});

describe("grosze rounding", () => {
  it("keeps integer grosze without float drift", () => {
    const state = emptyState({
      accounts: [
        {
          id: "acc",
          name: "Test",
          owner: "shared",
          type: "shared",
          openingBalanceGrosze: 1001,
          includeInBudget: true,
          active: true,
        },
      ],
      transactions: [
        {
          id: "t1",
          type: "expense",
          amountGrosze: 1,
          date: "2026-06-30",
          description: "1 gr",
          category: "Inne",
          person: "shared",
          paidBy: "shared",
          isShared: true,
          status: "paid",
          accountId: "acc",
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    const result = computeForecast(state);
    expect(result.currentBalanceGrosze).toBe(1000);
    expect(Number.isInteger(result.safeToSpendGrosze)).toBe(true);
  });
});

describe("last business day of month", () => {
  it("skips weekend for end of month", () => {
    // May 2026 ends on Sunday 31 → last business day Friday 29
    const d = lastBusinessDayOfMonth(new Date(2026, 4, 15));
    expect(toIsoDate(d)).toBe("2026-05-29");
  });
});

describe("demo state smoke", () => {
  it("computes forecast for demo without throwing", () => {
    const result = computeForecast(createDemoState());
    expect(result.horizonDays).toBe(14);
    expect(result.mode).toBe("realistic");
    expect(result.nextConfirmedIncome).not.toBeNull();
    expect(result.nextConfirmedIncome?.name).toContain("Mileny");
  });
});

describe("stage 3: cancelled and reserved bills", () => {
  it("ignores cancelled recurring bills in the path", () => {
    const state = emptyState({
      accounts: [
        {
          id: "acc",
          name: "Test",
          owner: "shared",
          type: "shared",
          openingBalanceGrosze: zlToGrosze(2000),
          includeInBudget: true,
          active: true,
        },
      ],
      recurringBills: [
        {
          id: "bill",
          name: "Anulowany",
          amountGrosze: zlToGrosze(1500),
          frequency: "once",
          nextOccurrenceDate: "2026-07-05",
          active: true,
          status: "cancelled",
          paidBy: "shared",
          category: "Dom",
        },
      ],
    });
    const result = computeForecast(state);
    expect(result.events.filter((e) => e.sourceId === "bill")).toHaveLength(0);
    expect(result.safeToSpendGrosze).toBe(zlToGrosze(2000));
  });

  it("counts reserved bill amount in reserved summary and on the path", () => {
    const state = emptyState({
      accounts: [
        {
          id: "acc",
          name: "Test",
          owner: "shared",
          type: "shared",
          openingBalanceGrosze: zlToGrosze(3000),
          includeInBudget: true,
          active: true,
        },
      ],
      recurringBills: [
        {
          id: "bill",
          name: "Czynsz zarezerwowany",
          amountGrosze: zlToGrosze(1000),
          frequency: "once",
          nextOccurrenceDate: "2026-07-10",
          active: true,
          status: "reserved",
          paidBy: "shared",
          category: "Dom",
        },
      ],
    });
    const result = computeForecast(state);
    expect(result.reservedGrosze).toBe(zlToGrosze(1000));
    expect(result.events.some((e) => e.sourceId === "bill")).toBe(true);
    expect(result.lowestBalanceGrosze).toBe(zlToGrosze(2000));
  });
});
