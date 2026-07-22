"use client";

import { useMemo, useState } from "react";
import { useBudget } from "@/lib/data/budget-context";
import { Card, Label, Money } from "@/components/ui";
import { formatDateShortPl } from "@/lib/dates/calendar";
import type { PersonId } from "@/lib/data/types";

const STATUS_PL: Record<string, string> = {
  paid: "opłacony",
  planned: "planowany",
  reserved: "zarezerwowany",
  cancelled: "anulowany",
  uncertain: "niepewny",
};

const PERSON_PL: Record<PersonId | "shared", string> = {
  pawel: "Paweł",
  milena: "Milena",
  shared: "wspólne",
};

export default function TransactionsPage() {
  const { state, hydrated, removeTransaction } = useBudget();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accountName = useMemo(() => {
    const map = new Map(state.accounts.map((a) => [a.id, a.name]));
    return (id: string) => map.get(id) ?? "konto";
  }, [state.accounts]);

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
      </header>

      {error && (
        <p className="rounded-xl bg-[#fde8e8] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <Card>
        {sorted.length === 0 ? (
          <p className="py-4 text-sm text-[var(--ink-muted)]">
            Brak transakcji.
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
                  <p className="text-xs text-[var(--ink-muted)]">
                    {tx.type === "expense" ? "z konta" : "na konto"}{" "}
                    {accountName(tx.accountId)}
                    {" · "}
                    {tx.type === "expense" ? "kupił/a" : "wpływ"}{" "}
                    {PERSON_PL[tx.person] ?? tx.person}
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
        <ul className="mt-2 divide-y divide-[var(--line)]">
          {state.incomeSources.map((s) => (
            <li key={s.id} className="py-2 text-sm">
              <p className="font-medium">{s.name}</p>
              <p className="text-[var(--ink-muted)]">
                typowa <Money grosze={s.typicalAmountGrosze} size="sm" /> ·{" "}
                {PERSON_PL[s.owner]}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
