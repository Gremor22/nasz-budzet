import { describe, expect, it } from "vitest";
import {
  computeAnalytics,
  previousRangeOfSameLength,
  resolvePeriod,
} from "@/lib/analytics/summary";
import type { Transaction } from "@/lib/data/types";
import { zlToGrosze } from "@/lib/money/format";

function tx(
  partial: Partial<Transaction> &
    Pick<Transaction, "id" | "type" | "amountGrosze" | "date">,
): Transaction {
  return {
    description: partial.description ?? "x",
    category: partial.category ?? "Jedzenie",
    person: partial.person ?? "shared",
    paidBy: partial.paidBy ?? "shared",
    isShared: partial.isShared ?? true,
    status: partial.status ?? "paid",
    accountId: partial.accountId ?? "acc",
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("resolvePeriod", () => {
  it("builds last 7 days inclusive", () => {
    const r = resolvePeriod("7d", "2026-07-19");
    expect(r.start).toBe("2026-07-13");
    expect(r.end).toBe("2026-07-19");
  });

  it("builds previous month", () => {
    const r = resolvePeriod("prev_month", "2026-07-19");
    expect(r.start).toBe("2026-06-01");
    expect(r.end).toBe("2026-06-30");
  });
});

describe("previousRangeOfSameLength", () => {
  it("mirrors length before current range", () => {
    const prev = previousRangeOfSameLength({
      start: "2026-07-13",
      end: "2026-07-19",
      label: "x",
    });
    expect(prev.start).toBe("2026-07-06");
    expect(prev.end).toBe("2026-07-12");
  });
});

describe("computeAnalytics", () => {
  it("sums expenses by category with percents and ignores cancelled", () => {
    const range = resolvePeriod("7d", "2026-07-19");
    const summary = computeAnalytics(
      [
        tx({
          id: "1",
          type: "expense",
          amountGrosze: zlToGrosze(100),
          date: "2026-07-18",
          category: "Jedzenie",
        }),
        tx({
          id: "2",
          type: "expense",
          amountGrosze: zlToGrosze(300),
          date: "2026-07-17",
          category: "Transport",
        }),
        tx({
          id: "3",
          type: "expense",
          amountGrosze: zlToGrosze(999),
          date: "2026-07-16",
          category: "Jedzenie",
          status: "cancelled",
        }),
        tx({
          id: "4",
          type: "income",
          amountGrosze: zlToGrosze(500),
          date: "2026-07-15",
        }),
      ],
      range,
    );

    expect(summary.expenseTotalGrosze).toBe(zlToGrosze(400));
    expect(summary.incomeTotalGrosze).toBe(zlToGrosze(500));
    expect(summary.netGrosze).toBe(zlToGrosze(100));
    expect(summary.byCategory[0]?.category).toBe("Transport");
    expect(summary.byCategory[0]?.percent).toBe(75);
    expect(summary.byCategory[1]?.category).toBe("Jedzenie");
    expect(summary.byCategory[1]?.percent).toBe(25);
  });

  it("separates shared and personal expenses", () => {
    const range = resolvePeriod("7d", "2026-07-19");
    const summary = computeAnalytics(
      [
        tx({
          id: "1",
          type: "expense",
          amountGrosze: zlToGrosze(200),
          date: "2026-07-18",
          isShared: true,
          person: "shared",
        }),
        tx({
          id: "2",
          type: "expense",
          amountGrosze: zlToGrosze(50),
          date: "2026-07-18",
          isShared: false,
          person: "pawel",
        }),
      ],
      range,
    );
    expect(summary.sharedExpenseGrosze).toBe(zlToGrosze(200));
    expect(summary.personalExpenseGrosze).toBe(zlToGrosze(50));
  });
});
