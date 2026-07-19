"use client";

import { useBudget } from "@/lib/data/budget-context";
import { Card, Label, Money } from "@/components/ui";
import { formatDateShortPl } from "@/lib/dates/calendar";

const STATUS_PL: Record<string, string> = {
  paid: "opłacony",
  planned: "planowany",
  reserved: "zarezerwowany",
  cancelled: "anulowany",
  uncertain: "niepewny",
};

export default function TransactionsPage() {
  const { state, hydrated } = useBudget();

  if (!hydrated) {
    return <p className="text-[var(--ink-muted)]">Ładowanie…</p>;
  }

  const sorted = [...state.transactions].sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">Transakcje</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Dane demonstracyjne — możesz dodać własne w „Dodaj”.
        </p>
      </header>

      <Card>
        <ul className="divide-y divide-[var(--line)]">
          {sorted.map((tx) => (
            <li key={tx.id} className="flex justify-between gap-3 py-3">
              <div>
                <p className="font-medium">{tx.description}</p>
                <p className="text-xs text-[var(--ink-muted)]">
                  {formatDateShortPl(tx.date)} · {tx.category} ·{" "}
                  {STATUS_PL[tx.status] ?? tx.status}
                </p>
              </div>
              <Money
                grosze={tx.type === "income" ? tx.amountGrosze : -tx.amountGrosze}
                size="sm"
                tone={tx.type === "income" ? "safe" : "default"}
              />
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <Label>Źródła dochodu (demo)</Label>
        <ul className="mt-2 divide-y divide-[var(--line)]">
          {state.incomeSources.map((s) => (
            <li key={s.id} className="py-2 text-sm">
              <p className="font-medium">{s.name}</p>
              <p className="text-[var(--ink-muted)]">
                typowa <Money grosze={s.typicalAmountGrosze} size="sm" /> ·
                bezpieczna <Money grosze={s.safeAmountGrosze} size="sm" /> ·{" "}
                {s.confidence === "confirmed"
                  ? "potwierdzony"
                  : s.confidence === "expected"
                    ? "oczekiwany"
                    : "prognozowany"}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
