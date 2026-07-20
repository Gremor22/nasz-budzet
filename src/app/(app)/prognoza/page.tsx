"use client";

import { useBudget } from "@/lib/data/budget-context";
import { Card, Label, Money } from "@/components/ui";
import { formatDatePl, formatDateShortPl } from "@/lib/dates/calendar";

const HORIZONS = [7, 14, 30, 90] as const;

export default function ForecastPage() {
  const { forecast, changeHorizon, hydrated } = useBudget();

  if (!hydrated) {
    return <p className="text-[var(--ink-muted)]">Ładowanie…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">Prognoza</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Saldo po każdym zdarzeniu w wybranym okresie.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {HORIZONS.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => changeHorizon(days)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              forecast.horizonDays === days
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-accent)]"
            }`}
          >
            {days} dni
          </button>
        ))}
      </div>

      <Card>
        <Label>Bezpiecznie do wydania</Label>
        <Money
          grosze={forecast.safeToSpendGrosze}
          size="xl"
          tone={forecast.safeToSpendGrosze < 0 ? "danger" : "safe"}
        />
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          Najniższe saldo:{" "}
          <Money grosze={forecast.lowestBalanceGrosze} size="sm" />
          {forecast.lowestBalanceDate
            ? ` (${formatDatePl(forecast.lowestBalanceDate)})`
            : ""}
        </p>
        {forecast.deficitGrosze > 0 && forecast.deficitDate && (
          <p className="mt-3 rounded-xl bg-[#fde8e8] px-3 py-2 text-sm text-[var(--danger)]">
            Przy obecnym planie może zabraknąć około{" "}
            <Money grosze={forecast.deficitGrosze} size="sm" tone="danger" />{" "}
            dnia {formatDatePl(forecast.deficitDate)}.
          </p>
        )}
      </Card>

      <Card data-tour="prognoza-timeline">
        <Label>Oś zdarzeń</Label>
        <ul className="mt-2 divide-y divide-[var(--line)]">
          <li className="flex justify-between py-2 text-sm">
            <span>Start ({formatDateShortPl(forecast.asOfDate)})</span>
            <Money
              grosze={forecast.openingForPathGrosze}
              size="sm"
              tone="muted"
            />
          </li>
          {forecast.events.map((event) => (
            <li key={event.id} className="flex justify-between gap-3 py-2.5">
              <div>
                <p className="font-medium">{event.name}</p>
                <p className="text-xs text-[var(--ink-muted)]">
                  {formatDateShortPl(event.date)} ·{" "}
                  {event.appliedAmountGrosze >= 0 ? "+" : ""}
                  {(event.appliedAmountGrosze / 100).toFixed(2)} zł
                  {event.typicalAmountGrosze != null &&
                  event.typicalAmountGrosze !== Math.abs(event.appliedAmountGrosze) &&
                  event.kind === "income"
                    ? ` (typowa ${(event.typicalAmountGrosze / 100).toFixed(0)} zł)`
                    : ""}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="text-[var(--ink-muted)]">saldo</p>
                <Money grosze={event.balanceAfterGrosze} size="sm" />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
