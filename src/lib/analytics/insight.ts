import type { AnalyticsSummary, CategorySlice } from "@/lib/analytics/summary";
import { formatPlnShort } from "@/lib/money/format";

export interface SpendingInsightInput {
  monthLabel: string;
  expenseTotalGrosze: number;
  incomeTotalGrosze: number;
  expenseChangeGrosze: number;
  previousExpenseTotalGrosze: number;
  byCategory: CategorySlice[];
  topExpenses: { description: string; amountGrosze: number; category: string }[];
}

export function toInsightInput(
  summary: AnalyticsSummary,
  monthLabel: string,
): SpendingInsightInput {
  return {
    monthLabel,
    expenseTotalGrosze: summary.expenseTotalGrosze,
    incomeTotalGrosze: summary.incomeTotalGrosze,
    expenseChangeGrosze: summary.expenseChangeGrosze,
    previousExpenseTotalGrosze: summary.previousExpenseTotalGrosze,
    byCategory: summary.byCategory,
    topExpenses: summary.topExpenses.map((t) => ({
      description: t.description,
      amountGrosze: t.amountGrosze,
      category: t.category,
    })),
  };
}

/** Krótkie podsumowanie bez AI — zawsze dostępne. */
export function buildLocalSpendingInsight(input: SpendingInsightInput): string {
  if (input.expenseTotalGrosze <= 0 || input.byCategory.length === 0) {
    return "Brak wydatków w tym miesiącu — dodaj transakcję lub zeskanuj paragon.";
  }

  const top = input.byCategory[0];
  const parts = [
    `W ${input.monthLabel} najwięcej wydaliście na ${top.category} — ${formatPlnShort(top.amountGrosze)} (${top.percent}% wydatków).`,
  ];

  if (input.byCategory.length > 1) {
    const second = input.byCategory[1];
    parts.push(
      `Drugie miejsce: ${second.category} (${formatPlnShort(second.amountGrosze)}, ${second.percent}%).`,
    );
  }

  if (
    input.previousExpenseTotalGrosze > 0 &&
    input.expenseChangeGrosze !== 0
  ) {
    const pct = Math.round(
      (input.expenseChangeGrosze / input.previousExpenseTotalGrosze) * 100,
    );
    if (pct >= 10) {
      parts.push(`To ok. ${pct}% więcej niż w poprzednim miesiącu.`);
    } else if (pct <= -10) {
      parts.push(`To ok. ${Math.abs(pct)}% mniej niż w poprzednim miesiącu.`);
    }
  }

  if (input.incomeTotalGrosze > 0) {
    const spendRatio = Math.round(
      (input.expenseTotalGrosze / input.incomeTotalGrosze) * 100,
    );
    if (spendRatio >= 90) {
      parts.push("Wydajecie prawie całe wpływy — warto zerknąć na największe pozycje.");
    }
  }

  return parts.join(" ");
}
