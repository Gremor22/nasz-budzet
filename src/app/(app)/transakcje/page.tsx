"use client";

import { useState } from "react";
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
  const { state, hydrated, removeTransaction } = useBudget();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!hydrated) {
    return <p className="text-[var(--ink-muted)]">Ładowanie…</p>;
  }

  const sorted = [...state.transactions].sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  async function onDelete(id: string, description: string) {
    if (
      !window.confirm(
        `Usunąć transakcję „${description}”? Saldo na Pulpicie się zaktualizuje.`,
      )
    ) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      await removeTransaction(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się usunąć");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">Transakcje</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Lista wpłat i wydatków. Usuń duplikat przyciskiem „Usuń” po prawej.
        </p>
      </header>

      {error && (
        <p className="rounded-xl bg-[#fde8e8] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <Card>
        {sorted.length === 0 ? (
          <p className="py-4 text-sm text-[var(--ink-muted)]">
            Brak transakcji. Dodaj wydatek lub wpływ w zakładce „+”.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {sorted.map((tx) => (
              <li
                key={tx.id}
                className="flex items-start justify-between gap-2 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{tx.description}</p>
                  <p className="text-xs text-[var(--ink-muted)]">
                    {formatDateShortPl(tx.date)} · {tx.category} ·{" "}
                    {STATUS_PL[tx.status] ?? tx.status}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Money
                    grosze={
                      tx.type === "income" ? tx.amountGrosze : -tx.amountGrosze
                    }
                    size="sm"
                    tone={tx.type === "income" ? "safe" : "default"}
                  />
                  <button
                    type="button"
                    className="text-xs text-[var(--danger)] disabled:opacity-50"
                    disabled={deletingId !== null}
                    onClick={() => void onDelete(tx.id, tx.description)}
                  >
                    {deletingId === tx.id ? "…" : "Usuń"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <Label>Źródła dochodu (plan)</Label>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          To przyszłe wpływy w prognozie — nie zmieniają „Aktualnego salda” na
          Pulpicie.
        </p>
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
