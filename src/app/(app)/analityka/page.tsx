"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useBudget } from "@/lib/data/budget-context";
import { Card, Label, Money } from "@/components/ui";
import {
  computeAnalytics,
  resolvePeriod,
  type AnalyticsPeriodKey,
} from "@/lib/analytics/summary";
import { formatDateShortPl } from "@/lib/dates/calendar";

const PERIODS: { key: AnalyticsPeriodKey; label: string }[] = [
  { key: "7d", label: "7 dni" },
  { key: "month", label: "Ten miesiąc" },
  { key: "prev_month", label: "Poprzedni" },
  { key: "3m", label: "3 mies." },
  { key: "6m", label: "6 mies." },
  { key: "year", label: "12 mies." },
];

const COLORS = [
  "#2d6a4f",
  "#40916c",
  "#52b788",
  "#74c69d",
  "#95d5b2",
  "#1b4332",
  "#081c15",
  "#d8f3dc",
];

export default function AnalyticsPage() {
  const { state, hydrated } = useBudget();
  const [period, setPeriod] = useState<AnalyticsPeriodKey>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const summary = useMemo(() => {
    try {
      const range = resolvePeriod(
        period,
        state.settings.asOfDate,
        period === "custom"
          ? { start: customStart, end: customEnd }
          : undefined,
      );
      return computeAnalytics(state.transactions, range);
    } catch {
      return null;
    }
  }, [state.transactions, state.settings.asOfDate, period, customStart, customEnd]);

  if (!hydrated) {
    return <p className="text-[var(--ink-muted)]">Ładowanie…</p>;
  }

  const chartData =
    summary?.byCategory.map((c) => ({
      name: c.category,
      value: c.amountGrosze / 100,
      grosze: c.amountGrosze,
      percent: c.percent,
    })) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <header>
        <Link href="/wiecej" className="text-sm text-[var(--accent)]">
          ← Więcej
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Analityka</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Podsumowanie wydatków i wpływów w wybranym okresie.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              period === p.key
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-accent)]"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPeriod("custom")}
          className={`rounded-full px-3 py-1.5 text-sm ${
            period === "custom"
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--bg-accent)]"
          }`}
        >
          Własny
        </button>
      </div>

      {period === "custom" && (
        <Card>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Od</Label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div>
              <Label>Do</Label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          </div>
        </Card>
      )}

      {!summary ? (
        <p className="text-sm text-[var(--ink-muted)]">
          Wybierz poprawny zakres dat.
        </p>
      ) : (
        <>
          <p className="text-xs text-[var(--ink-muted)]">
            {summary.range.label}: {formatDateShortPl(summary.range.start)} –{" "}
            {formatDateShortPl(summary.range.end)}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Card>
              <Label>Wydatki</Label>
              <div className="mt-1">
                <Money grosze={summary.expenseTotalGrosze} size="lg" />
              </div>
            </Card>
            <Card>
              <Label>Wpływy</Label>
              <div className="mt-1">
                <Money
                  grosze={summary.incomeTotalGrosze}
                  size="lg"
                  tone="safe"
                />
              </div>
            </Card>
            <Card>
              <Label>Wynik okresu</Label>
              <div className="mt-1">
                <Money
                  grosze={summary.netGrosze}
                  size="lg"
                  tone={summary.netGrosze >= 0 ? "safe" : "danger"}
                />
              </div>
            </Card>
            <Card>
              <Label>vs poprzedni okres</Label>
              <div className="mt-1">
                <Money
                  grosze={summary.expenseChangeGrosze}
                  size="lg"
                  tone={
                    summary.expenseChangeGrosze > 0
                      ? "warn"
                      : summary.expenseChangeGrosze < 0
                        ? "safe"
                        : "muted"
                  }
                />
              </div>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                zmiana wydatków (poprzednio{" "}
                <Money
                  grosze={summary.previousExpenseTotalGrosze}
                  size="sm"
                  tone="muted"
                />
                )
              </p>
            </Card>
          </div>

          <Card>
            <Label>Wydatki według kategorii</Label>
            {chartData.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--ink-muted)]">
                Brak wydatków w tym okresie.
              </p>
            ) : (
              <>
                <div className="mt-2 h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={2}
                      >
                        {chartData.map((_, i) => (
                          <Cell
                            key={chartData[i].name}
                            fill={COLORS[i % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) =>
                          `${Number(value).toLocaleString("pl-PL", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} zł`
                        }
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-2 divide-y divide-[var(--line)]">
                  {summary.byCategory.map((c, i) => (
                    <li
                      key={c.category}
                      className="flex items-center justify-between gap-2 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-sm"
                          style={{
                            background: COLORS[i % COLORS.length],
                          }}
                        />
                        {c.category}
                      </span>
                      <span className="text-right">
                        <Money grosze={c.amountGrosze} size="sm" /> ·{" "}
                        {c.percent}%
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card>
            <Label>Według osób</Label>
            <ul className="mt-2 divide-y divide-[var(--line)]">
              {summary.byPerson.length === 0 ? (
                <li className="py-2 text-sm text-[var(--ink-muted)]">Brak danych</li>
              ) : (
                summary.byPerson.map((p) => (
                  <li
                    key={p.person}
                    className="flex justify-between py-2 text-sm"
                  >
                    <span>{p.person}</span>
                    <Money grosze={p.amountGrosze} size="sm" />
                  </li>
                ))
              )}
            </ul>
          </Card>

          <Card>
            <Label>Wspólne vs osobiste</Label>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[var(--ink-muted)]">Wspólne</p>
                <Money grosze={summary.sharedExpenseGrosze} size="sm" />
              </div>
              <div>
                <p className="text-[var(--ink-muted)]">Osobiste</p>
                <Money grosze={summary.personalExpenseGrosze} size="sm" />
              </div>
            </div>
          </Card>

          <Card>
            <Label>Największe wydatki</Label>
            <ul className="mt-2 divide-y divide-[var(--line)]">
              {summary.topExpenses.length === 0 ? (
                <li className="py-2 text-sm text-[var(--ink-muted)]">Brak</li>
              ) : (
                summary.topExpenses.map((t) => (
                  <li
                    key={t.id}
                    className="flex justify-between gap-2 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{t.description}</p>
                      <p className="text-xs text-[var(--ink-muted)]">
                        {formatDateShortPl(t.date)} · {t.category}
                      </p>
                    </div>
                    <Money grosze={-t.amountGrosze} size="sm" />
                  </li>
                ))
              )}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
