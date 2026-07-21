import { describe, expect, it } from "vitest";
import { createDemoState } from "@/lib/data/demo-data";
import {
  applyIncomeSourceSync,
  listIncomeOccurrences,
} from "@/lib/income/sync-source-transactions";

describe("listIncomeOccurrences", () => {
  it("monthly_on_day includes past months in window", () => {
    const dates = listIncomeOccurrences(
      {
        id: "inc-1",
        name: "Pensja",
        owner: "pawel",
        typicalAmountGrosze: 210_000,
        safeAmountGrosze: 200_000,
        frequency: "monthly_on_day",
        dayOfMonth: 10,
        nextOccurrenceDate: "2026-08-10",
        confidence: "expected",
        active: true,
      },
      "2026-07-01",
      "2026-07-31",
    );
    expect(dates).toContain("2026-07-10");
  });
});

describe("applyIncomeSourceSync", () => {
  it("creates only current-month salary when starting mid-month", () => {
    const base = createDemoState();
    base.settings.asOfDate = "2026-07-21";
    base.household.budgetStartedDate = "2026-07-01";
    base.incomeSources = [
      {
        id: "inc-1",
        name: "Pensja",
        owner: "pawel",
        typicalAmountGrosze: 250_000,
        safeAmountGrosze: 250_000,
        frequency: "monthly_on_day",
        dayOfMonth: 10,
        nextOccurrenceDate: "2026-08-10",
        confidence: "expected",
        active: true,
      },
    ];
    base.transactions = [];

    const synced = applyIncomeSourceSync(base);
    const linked = synced.transactions.filter(
      (t) => t.incomeSourceId === "inc-1",
    );
    expect(linked).toHaveLength(1);
    expect(linked[0]?.date).toBe("2026-07-10");
    expect(linked[0]?.status).toBe("paid");
    expect(linked[0]?.amountGrosze).toBe(250_000);
  });

  it("dedupes triple paid salary for the same date", () => {
    const base = createDemoState();
    base.settings.asOfDate = "2026-07-21";
    base.household.budgetStartedDate = "2026-07-01";
    base.incomeSources = [
      {
        id: "inc-1",
        name: "Pensja",
        owner: "pawel",
        typicalAmountGrosze: 250_000,
        safeAmountGrosze: 250_000,
        frequency: "monthly_on_day",
        dayOfMonth: 10,
        nextOccurrenceDate: "2026-08-10",
        confidence: "expected",
        active: true,
      },
    ];
    const now = new Date().toISOString();
    base.transactions = [1, 2, 3].map((n) => ({
      id: `tx-dup-${n}`,
      type: "income" as const,
      amountGrosze: 250_000,
      date: "2026-07-10",
      description: "Pensja",
      category: "Wpływ",
      person: "pawel" as const,
      paidBy: "pawel" as const,
      isShared: false,
      status: "paid" as const,
      accountId: base.accounts[0]!.id,
      incomeSourceId: "inc-1",
      createdAt: now,
      updatedAt: now,
    }));

    const synced = applyIncomeSourceSync(base);
    expect(
      synced.transactions.filter((t) => t.incomeSourceId === "inc-1"),
    ).toHaveLength(1);
  });

  it("does not create August/September ahead of time", () => {
    const base = createDemoState();
    base.settings.asOfDate = "2026-07-21";
    base.household.budgetStartedDate = "2026-07-01";
    base.incomeSources = [
      {
        id: "inc-1",
        name: "Pensja",
        owner: "pawel",
        typicalAmountGrosze: 250_000,
        safeAmountGrosze: 250_000,
        frequency: "monthly_on_day",
        dayOfMonth: 10,
        nextOccurrenceDate: "2026-08-10",
        confidence: "expected",
        active: true,
      },
    ];
    base.transactions = [];

    const synced = applyIncomeSourceSync(base);
    const dates = synced.transactions
      .filter((t) => t.incomeSourceId === "inc-1")
      .map((t) => t.date);
    expect(dates).toEqual(["2026-07-10"]);
  });
});
