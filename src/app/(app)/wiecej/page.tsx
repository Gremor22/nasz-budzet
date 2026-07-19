"use client";

import { useState } from "react";
import Link from "next/link";
import { useBudget } from "@/lib/data/budget-context";
import { Card, Label, Money } from "@/components/ui";

export default function MorePage() {
  const {
    state,
    changeBufferZl,
    changeHorizon,
    hydrated,
    dataSource,
    userEmail,
    seedDemo,
    createInviteCode,
    signOut,
    setGoalReserved,
  } = useBudget();
  const [bufferInput, setBufferInput] = useState(
    String(state.household.safetyBufferGrosze / 100),
  );
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!hydrated) {
    return <p className="text-[var(--ink-muted)]">Ładowanie…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">Więcej</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          {dataSource === "supabase"
            ? `Zalogowano: ${userEmail ?? "—"}`
            : "Tryb lokalny (bez Supabase)"}
        </p>
      </header>

      <Card>
        <Label>Budżet</Label>
        <div className="mt-2 flex flex-col gap-1">
          {[
            { href: "/analityka", label: "Analityka" },
            { href: "/konta", label: "Konta" },
            { href: "/dochody", label: "Źródła dochodu" },
            { href: "/rachunki", label: "Rachunki cykliczne" },
            { href: "/cele", label: "Cele oszczędnościowe" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl bg-[var(--bg-accent)] px-3 py-3 text-sm font-medium"
            >
              {item.label} →
            </Link>
          ))}
        </div>
      </Card>

      {dataSource === "supabase" && (
        <Card>
          <Label>Zaproszenie do gospodarstwa</Label>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Wygeneruj kod dla drugiej osoby (ważny 7 dni).
          </p>
          <button
            type="button"
            className="mt-3 w-full rounded-xl bg-[var(--accent)] py-2.5 text-white"
            onClick={async () => {
              setError(null);
              try {
                const code = await createInviteCode();
                setInviteCode(code);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Błąd");
              }
            }}
          >
            Wygeneruj kod
          </button>
          {inviteCode && (
            <p className="mt-3 rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-center text-lg font-semibold tracking-widest">
              {inviteCode}
            </p>
          )}
        </Card>
      )}

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
              if (Number.isFinite(zl) && zl >= 0) void changeBufferZl(zl);
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
                void changeBufferZl(zl);
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
              onClick={() => void changeHorizon(d)}
            >
              {d} dni
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <Label>Cele</Label>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Dodawaj i edytuj cele w osobnym ekranie. Tu tylko szybki podgląd.
        </p>
        <Link
          href="/cele"
          className="mt-3 block rounded-xl bg-[var(--bg-accent)] px-3 py-3 text-sm font-medium"
        >
          Zarządzaj celami →
        </Link>
        {state.savingsGoals.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--ink-muted)]">Brak celów.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--line)]">
            {state.savingsGoals.slice(0, 3).map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <p className="font-medium">{g.name}</p>
                  <p className="text-[var(--ink-muted)]">
                    zebrane <Money grosze={g.savedAmountGrosze} size="sm" />
                    {g.reserved ? " · zarezerwowane" : ""}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={g.reserved}
                    onChange={(e) =>
                      void setGoalReserved(g.id, e.target.checked)
                    }
                  />
                  Zarezerwowane
                </label>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {dataSource === "supabase" && (
        <Card>
          <Label>Dane demonstracyjne (fikcyjne)</Label>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Wypełnia gospodarstwo przykładowymi kwotami testowymi — nie prawdziwymi
            finansami. Działa tylko gdy nie ma jeszcze kont poza kontem wspólnym
            startowym albo gdy gospodarstwo jest „puste” od kont demo.
          </p>
          <button
            type="button"
            className="mt-3 w-full rounded-xl border border-[var(--accent)] py-2.5 text-[var(--accent)]"
            onClick={async () => {
              setError(null);
              setMessage(null);
              try {
                await seedDemo();
                setMessage("Wczytano dane demonstracyjne.");
                setBufferInput("0");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Błąd");
              }
            }}
          >
            Wczytaj dane demo
          </button>
        </Card>
      )}

      {(message || error) && (
        <p
          className={`rounded-xl px-3 py-2 text-sm ${
            error
              ? "bg-[#fde8e8] text-[var(--danger)]"
              : "bg-[var(--accent-soft)]"
          }`}
        >
          {error ?? message}
        </p>
      )}

      {dataSource === "supabase" && (
        <button
          type="button"
          className="w-full rounded-xl border border-[var(--line)] py-2.5"
          onClick={() => void signOut()}
        >
          Wyloguj
        </button>
      )}

      <p className="text-center text-xs text-[var(--ink-muted)]">
        Etap 3 · Nasz Budżet · źródło: {dataSource}
      </p>
    </div>
  );
}
