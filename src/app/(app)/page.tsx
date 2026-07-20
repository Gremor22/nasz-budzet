"use client";

import { useBudget } from "@/lib/data/budget-context";
import { Card, Label, Money } from "@/components/ui";
import { formatDatePl, formatDateShortPl } from "@/lib/dates/calendar";
import type { ForecastMode } from "@/lib/data/types";

const MODE_LABELS: Record<ForecastMode, string> = {
  cautious: "Ostrożny",
  realistic: "Realistyczny",
  full: "Pełna prognoza",
};

const MODE_HELP: Record<ForecastMode, string> = {
  cautious: "Tylko potwierdzone wpływy.",
  realistic:
    "Potwierdzone + oczekiwane w kwocie bezpiecznej (nie pełnej typowej).",
  full: "Uwzględnia też wpływy prognozowane i pełne typowe kwoty oczekiwanych.",
};

export default function DashboardPage() {
  const { state, forecast, changeMode, hydrated, dataSource } = useBudget();

  if (!hydrated) {
    return <p className="text-[var(--ink-muted)]">Ładowanie danych demo…</p>;
  }

  const safeTone =
    forecast.safeToSpendGrosze < 0
      ? "danger"
      : forecast.safeToSpendGrosze < forecast.safetyBufferGrosze + 50_000
        ? "warn"
        : "safe";

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-sm text-[var(--ink-muted)]">Prototyp lokalny · demo</p>
        <h1 className="text-2xl font-semibold tracking-tight">Nasz Budżet</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Gospodarstwo: {state.household.name}
          {dataSource === "supabase" ? " · chmura" : " · lokalnie"}
        </p>
      </header>

      <Card className="bg-gradient-to-br from-[#edf7f0] to-[var(--card)]" data-tour="safe-to-spend">
        <Label>Bezpiecznie do wydania</Label>
        <div className="mt-1">
          <Money grosze={forecast.safeToSpendGrosze} size="xl" tone={safeTone} />
        </div>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          Na najbliższe {forecast.horizonDays} dni (do{" "}
          {formatDateShortPl(forecast.horizonEndDate)}), tryb{" "}
          <strong>{MODE_LABELS[forecast.mode]}</strong>.
        </p>

        <div className="mt-3 flex flex-wrap gap-2" data-tour="forecast-mode">
          {(Object.keys(MODE_LABELS) as ForecastMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => changeMode(mode)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                forecast.mode === mode
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--bg-accent)] text-[var(--ink)]"
              }`}
            >
              {MODE_LABELS[mode]}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
          {MODE_HELP[forecast.mode]} Bufor bezpieczeństwa:{" "}
          <Money grosze={forecast.safetyBufferGrosze} size="sm" tone="muted" />.
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <Label>Aktualne saldo</Label>
          <div className="mt-1">
            <Money grosze={forecast.currentBalanceGrosze} size="lg" />
          </div>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Suma kont w budżecie
          </p>
        </Card>
        <Card>
          <Label>Zarezerwowane</Label>
          <div className="mt-1">
            <Money grosze={forecast.reservedGrosze} size="lg" tone="warn" />
          </div>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Cele i rezerwacje
          </p>
        </Card>
      </div>

      <Card>
        <Label>Przyszłe niepotwierdzone wpływy</Label>
        <div className="mt-1">
          <Money
            grosze={forecast.unconfirmedIncomeInHorizonGrosze}
            size="lg"
            tone="muted"
          />
        </div>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          To typowa suma oczekiwanych/prognozowanych wpływów w horyzoncie —{" "}
          <strong>nie jest w pełni wliczana</strong> do „bezpiecznie do wydania”
          w trybie realistycznym (tam bierze się kwotę bezpieczną).
        </p>
      </Card>

      {forecast.nextConfirmedIncome && (
        <Card>
          <Label>Kolejny pewny wpływ</Label>
          <p className="mt-1 text-lg font-semibold">
            {forecast.nextConfirmedIncome.name}
          </p>
          <p className="text-sm text-[var(--ink-muted)]">
            {formatDatePl(forecast.nextConfirmedIncome.date)} · za{" "}
            {forecast.nextConfirmedIncome.daysUntil}{" "}
            {forecast.nextConfirmedIncome.daysUntil === 1 ? "dzień" : "dni"}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-[var(--ink-muted)]">Saldo przed</p>
              <Money
                grosze={forecast.nextConfirmedIncome.balanceBeforeGrosze}
                size="sm"
              />
            </div>
            <div>
              <p className="text-[var(--ink-muted)]">Saldo po</p>
              <Money
                grosze={forecast.nextConfirmedIncome.balanceAfterGrosze}
                size="sm"
                tone="safe"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--ink-muted)]">
            Horyzont pulpitu to nadal 14 dni — duży rachunek może być zaraz po
            wpływie, dlatego patrzymy też dalej w prognozie.
          </p>
        </Card>
      )}

      <Card>
        <Label>Najniższe przewidywane saldo</Label>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <Money
            grosze={forecast.lowestBalanceGrosze}
            size="lg"
            tone={forecast.lowestBalanceGrosze < 0 ? "danger" : "default"}
          />
          {forecast.lowestBalanceDate && (
            <span className="text-sm text-[var(--ink-muted)]">
              {formatDatePl(forecast.lowestBalanceDate)}
            </span>
          )}
        </div>
        {forecast.deficitGrosze > 0 && forecast.deficitDate && (
          <p className="mt-3 rounded-xl bg-[#fde8e8] px-3 py-2 text-sm text-[var(--danger)]">
            Przy obecnym planie może zabraknąć około{" "}
            <Money grosze={forecast.deficitGrosze} size="sm" tone="danger" />{" "}
            dnia {formatDatePl(forecast.deficitDate)}.
          </p>
        )}
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <Label>Najbliższe zdarzenia</Label>
          <span className="text-xs text-[var(--ink-muted)]">
            {forecast.events.length} w {forecast.horizonDays} dniach
          </span>
        </div>
        <ul className="divide-y divide-[var(--line)]">
          {forecast.events.slice(0, 8).map((event) => (
            <li key={event.id} className="flex items-start justify-between gap-3 py-2.5">
              <div>
                <p className="font-medium">{event.name}</p>
                <p className="text-xs text-[var(--ink-muted)]">
                  {formatDateShortPl(event.date)}
                  {event.confidence
                    ? ` · ${
                        event.confidence === "confirmed"
                          ? "potwierdzony"
                          : event.confidence === "expected"
                            ? "oczekiwany"
                            : "prognozowany"
                      }`
                    : ""}
                </p>
              </div>
              <div className="text-right">
                <Money
                  grosze={event.appliedAmountGrosze}
                  size="sm"
                  tone={event.appliedAmountGrosze >= 0 ? "safe" : "default"}
                />
                <p className="text-xs text-[var(--ink-muted)]">
                  po: {formatPlnInline(event.balanceAfterGrosze)}
                </p>
              </div>
            </li>
          ))}
          {forecast.events.length === 0 && (
            <li className="py-3 text-sm text-[var(--ink-muted)]">
              Brak zaplanowanych zdarzeń w tym okresie.
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}

function formatPlnInline(grosze: number): string {
  const sign = grosze < 0 ? "−" : "";
  const abs = Math.abs(grosze);
  const zl = Math.floor(abs / 100);
  const gr = abs % 100;
  return `${sign}${zl},${gr.toString().padStart(2, "0")} zł`;
}
