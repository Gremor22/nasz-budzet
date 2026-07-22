"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useBudget } from "@/lib/data/budget-context";
import { computeAnalytics } from "@/lib/analytics/summary";
import { computeBalancesByOwner } from "@/lib/forecast/engine";
import {
  monthKeyFromDate,
  monthRangeFromKey,
  savingsExpenseGrosze,
  shiftMonthKey,
} from "@/lib/analytics/month-range";
import { CategorySpendingChart } from "@/components/CategorySpendingChart";
import { SpendingInsight } from "@/components/SpendingInsight";
import { Card, Label, Money } from "@/components/ui";
import { formatDateShortPl } from "@/lib/dates/calendar";

export default function DashboardPage() {
  const { state, hydrated, dataSource, myPersonId } = useBudget();
  const [monthKey, setMonthKey] = useState(() =>
    monthKeyFromDate(state.settings.asOfDate),
  );

  const range = useMemo(() => monthRangeFromKey(monthKey), [monthKey]);

  const summary = useMemo(
    () => computeAnalytics(state.transactions, range),
    [state.transactions, range],
  );

  const savingsGrosze = useMemo(
    () => savingsExpenseGrosze(state.transactions, range),
    [state.transactions, range],
  );

  const monthTransactions = useMemo(
    () =>
      [...state.transactions]
        .filter((t) => t.date >= range.start && t.date <= range.end)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, 8),
    [state.transactions, range],
  );

  const balances = useMemo(
    () => computeBalancesByOwner(state, myPersonId),
    [state, myPersonId],
  );

  const accountLabel = useMemo(() => {
    const map = new Map(state.accounts.map((a) => [a.id, a.name]));
    return (id: string) => map.get(id) ?? "";
  }, [state.accounts]);

  if (!hydrated) {
    return <p className="text-[var(--ink-muted)]">Ładowanie…</p>;
  }

  const netTone =
    summary.netGrosze < 0
      ? "danger"
      : summary.netGrosze > 0
        ? "safe"
        : "default";

  const mineRow = balances.rows[0];
  const otherRows = balances.rows.slice(1);

  return (
    <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Nasz Budżet</h1>
        <p className="text-sm text-[var(--ink-muted)]">{state.household.name}</p>
      </header>

      <div
        className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2"
        data-tour="month-nav"
      >
        <button
          type="button"
          className="rounded-xl bg-[var(--bg-accent)] px-3 py-2 text-lg leading-none"
          onClick={() => setMonthKey((k) => shiftMonthKey(k, -1))}
          aria-label="Poprzedni miesiąc"
        >
          ‹
        </button>
        <p className="text-center text-lg font-semibold capitalize">
          {range.label}
        </p>
        <button
          type="button"
          className="rounded-xl bg-[var(--bg-accent)] px-3 py-2 text-lg leading-none"
          onClick={() => setMonthKey((k) => shiftMonthKey(k, 1))}
          aria-label="Następny miesiąc"
        >
          ›
        </button>
      </div>

      <Card>
        {mineRow && (
          <div className="flex items-end justify-between gap-3">
            <Label>{mineRow.label}</Label>
            <Money grosze={mineRow.grosze} size="xl" />
          </div>
        )}
        {otherRows.length > 0 && (
          <ul className="mt-3 space-y-2 border-t border-[var(--line)] pt-3">
            {otherRows.map((row) => (
              <li
                key={row.owner}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-[var(--ink-muted)]">{row.label}</span>
                <Money grosze={row.grosze} size="sm" />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex items-end justify-between gap-3 border-t border-[var(--line)] pt-3">
          <span className="text-sm font-medium">Razem</span>
          <Money grosze={balances.totalGrosze} size="lg" />
        </div>
        <Link
          href="/konta"
          className="mt-3 block text-center text-sm text-[var(--accent)]"
        >
          Konta →
        </Link>
      </Card>

      <Card
        className="bg-gradient-to-br from-[#edf7f0] to-[var(--card)]"
        data-tour="month-summary"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--ink-muted)]">Wpływy</span>
            <Money grosze={summary.incomeTotalGrosze} size="sm" tone="safe" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--ink-muted)]">Wydatki</span>
            <Money grosze={-summary.expenseTotalGrosze} size="sm" />
          </div>
          {savingsGrosze > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--ink-muted)]">
                Oszczędności
              </span>
              <Money grosze={-savingsGrosze} size="sm" tone="warn" />
            </div>
          )}
          <div className="border-t border-[var(--line)] pt-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <Label>Zostało w miesiącu</Label>
                <p className="text-xs text-[var(--ink-muted)]">
                  Wpływy − wydatki w {range.label}
                </p>
              </div>
              <Money grosze={summary.netGrosze} size="xl" tone={netTone} />
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-2" data-tour="quick-add">
        {dataSource === "supabase" && (
          <Link
            href="/paragon"
            className="rounded-xl bg-[var(--accent)] py-3 text-center text-sm font-medium text-white"
          >
            Zeskanuj paragon →
          </Link>
        )}
        <div className="flex gap-2">
          <Link
            href="/dodaj"
            className="flex-1 rounded-xl bg-[var(--bg-accent)] py-3 text-center text-sm font-medium"
          >
            + Wydatek
          </Link>
          <Link
            href="/dodaj?typ=wpływ"
            className="flex-1 rounded-xl bg-[var(--bg-accent)] py-3 text-center text-sm font-medium"
          >
            + Wpływ
          </Link>
        </div>
      </div>

      <Card data-tour="month-chart">
        <Label>Na co poszło</Label>
        <div className="mt-3">
          <CategorySpendingChart slices={summary.byCategory} />
        </div>
      </Card>

      <SpendingInsight
        summary={summary}
        monthLabel={range.label}
        monthKey={monthKey}
        enabled={dataSource === "supabase"}
      />

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <Label>W tym miesiącu</Label>
          <Link href="/transakcje" className="text-xs text-[var(--accent)]">
            Wszystkie →
          </Link>
        </div>
        {monthTransactions.length === 0 ? (
          <p className="py-3 text-sm text-[var(--ink-muted)]">
            Nic jeszcze nie dodano. Użyj + lub zeskanuj paragon.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {monthTransactions.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{tx.description}</p>
                  <p className="truncate text-xs text-[var(--ink-muted)]">
                    {formatDateShortPl(tx.date)} · {tx.category}
                    {accountLabel(tx.accountId)
                      ? ` · ${accountLabel(tx.accountId)}`
                      : ""}
                  </p>
                </div>
                <div className="shrink-0">
                  <Money
                    grosze={
                      tx.type === "income" ? tx.amountGrosze : -tx.amountGrosze
                    }
                    size="sm"
                    tone={tx.type === "income" ? "safe" : "default"}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Link
        href="/prognoza"
        className="block rounded-xl border border-[var(--line)] px-3 py-3 text-center text-sm text-[var(--ink-muted)]"
      >
        Prognoza na przyszłość (zaawansowane) →
      </Link>
    </div>
  );
}
