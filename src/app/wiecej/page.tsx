"use client";

import { useState } from "react";
import { useBudget } from "@/lib/data/budget-context";
import { Card, Label, Money } from "@/components/ui";

export default function MorePage() {
  const { state, changeBufferZl, changeHorizon, resetDemo, hydrated } =
    useBudget();
  const [bufferInput, setBufferInput] = useState(
    String(state.household.safetyBufferGrosze / 100),
  );

  if (!hydrated) {
    return <p className="text-[var(--ink-muted)]">Ładowanie…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">Więcej</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Ustawienia prototypu (bez konta i chmury).
        </p>
      </header>

      <Card>
        <Label>Bufor bezpieczeństwa</Label>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Kwota odejmowana od „bezpiecznie do wydania”. W demo start = 0 zł.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            inputMode="decimal"
            value={bufferInput}
            onChange={(e) => setBufferInput(e.target.value)}
            placeholder="np. 500"
          />
          <button
            type="button"
            className="rounded-xl bg-[var(--accent)] px-4 text-white"
            onClick={() => {
              const zl = Number(bufferInput.replace(",", "."));
              if (Number.isFinite(zl) && zl >= 0) changeBufferZl(zl);
            }}
          >
            Zapisz
          </button>
        </div>
        <div className="mt-2 flex gap-2">
          {[0, 500, 1000].map((zl) => (
            <button
              key={zl}
              type="button"
              className="rounded-full bg-[var(--bg-accent)] px-3 py-1 text-sm"
              onClick={() => {
                setBufferInput(String(zl));
                changeBufferZl(zl);
              }}
            >
              {zl} zł
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm">
          Aktualny bufor:{" "}
          <Money grosze={state.household.safetyBufferGrosze} size="sm" />
        </p>
      </Card>

      <Card>
        <Label>Horyzont pulpitu</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm ${
                state.settings.horizonDays === d
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--bg-accent)]"
              }`}
              onClick={() => changeHorizon(d)}
            >
              {d} dni
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <Label>Cele (demo)</Label>
        <ul className="mt-2 divide-y divide-[var(--line)]">
          {state.savingsGoals.map((g) => (
            <li key={g.id} className="py-2 text-sm">
              <p className="font-medium">{g.name}</p>
              <p className="text-[var(--ink-muted)]">
                zebrane <Money grosze={g.savedAmountGrosze} size="sm" />
                {g.reserved ? " · zarezerwowane (zmniejsza bezpieczną kwotę)" : " · tylko plan (nie zmniejsza)"}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <Label>Dane demonstracyjne</Label>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Przywraca fikcyjne dane startowe i czyści lokalne zmiany.
        </p>
        <button
          type="button"
          className="mt-3 w-full rounded-xl border border-[var(--danger)] py-2.5 text-[var(--danger)]"
          onClick={() => {
            if (
              window.confirm(
                "Przywrócić dane demonstracyjne? Twoje lokalne wpisy znikną.",
              )
            ) {
              resetDemo();
              setBufferInput("0");
            }
          }}
        >
          Resetuj dane demo
        </button>
      </Card>

      <p className="text-center text-xs text-[var(--ink-muted)]">
        Etap 1 · bez logowania · bez Supabase · Nasz Budżet
      </p>
    </div>
  );
}
