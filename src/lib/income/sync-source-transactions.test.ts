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
  it("creates paid income for past payday in current month", () => {
    const base = createDemoState();
    base.settings.asOfDate = "2026-07-21";
    base.incomeSources = [
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
    ];

    const synced = applyIncomeSourceSync(base);
    const july = synced.transactions.filter(
      (t) => t.incomeSourceId === "inc-1" && t.date === "2026-07-10",
    );
    expect(july).toHaveLength(1);
    expect(july[0]?.status).toBe("paid");
    expect(july[0]?.amountGrosze).toBe(210_000);
  });
});
