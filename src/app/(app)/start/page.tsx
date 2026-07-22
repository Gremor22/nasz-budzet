"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useBudget } from "@/lib/data/budget-context";
import { Card, Label } from "@/components/ui";
import { parseZlToGrosze } from "@/lib/data/form-options";
import type { PersonId } from "@/lib/data/types";

export default function SimpleStartPage() {
  const router = useRouter();
  const { completeSimpleSetup, hydrated } = useBudget();
  const [step, setStep] = useState<1 | 2>(1);
  const [pawelZl, setPawelZl] = useState("");
  const [milenaZl, setMilenaZl] = useState("");
  const [incomeName, setIncomeName] = useState("Pensja");
  const [incomeZl, setIncomeZl] = useState("");
  const [incomeDay, setIncomeDay] = useState("10");
  const [incomeOwner, setIncomeOwner] = useState<PersonId>("pawel");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!hydrated) {
    return <p className="text-[var(--ink-muted)]">Ładowanie…</p>;
  }

  function onBalanceNext(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const pawel = parseZlToGrosze(pawelZl || "0");
    const milena = parseZlToGrosze(milenaZl || "0");
    if (pawel === null || pawel < 0 || milena === null || milena < 0) {
      setError("Podaj kwoty na kontach (0 lub więcej).");
      return;
    }
    setStep(2);
  }

  async function finish(withIncome: boolean) {
    setError(null);
    const pawel = parseZlToGrosze(pawelZl || "0");
    const milena = parseZlToGrosze(milenaZl || "0");
    if (pawel === null || pawel < 0 || milena === null || milena < 0) {
      setError("Podaj kwoty na kontach.");
      setStep(1);
      return;
    }

    let incomeAmountGrosze: number | undefined;
    let incomeDayOfMonth: number | undefined;
    if (withIncome) {
      const amount = parseZlToGrosze(incomeZl);
      const day = Number(incomeDay);
      if (!incomeName.trim()) {
        setError("Podaj nazwę dochodu (np. Pensja).");
        return;
      }
      if (amount === null || amount <= 0) {
        setError("Podaj kwotę wypłaty.");
        return;
      }
      if (!Number.isInteger(day) || day < 1 || day > 28) {
        setError("Dzień wypłaty: 1–28.");
        return;
      }
      incomeAmountGrosze = amount;
      incomeDayOfMonth = day;
    }

    setSaving(true);
    try {
      await completeSimpleSetup({
        pawelBalanceGrosze: pawel,
        milenaBalanceGrosze: milena,
        incomeName: withIncome ? incomeName.trim() : undefined,
        incomeAmountGrosze,
        incomeDayOfMonth,
        incomeOwner: withIncome ? incomeOwner : undefined,
      });
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu");
    } finally {
      setSaving(false);
    }
  }

  const pawelPreview = parseZlToGrosze(pawelZl || "0") ?? 0;
  const milenaPreview = parseZlToGrosze(milenaZl || "0") ?? 0;
  const togetherPreview = pawelPreview + milenaPreview;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
          Krok {step} z 2
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Szybki start</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Saldo Pawła, Mileny i razem — potem opcjonalnie pensja.
        </p>
      </header>

      {step === 1 ? (
        <Card>
          <form className="flex flex-col gap-3" onSubmit={onBalanceNext}>
            <div>
              <Label>Ile ma Paweł na koncie?</Label>
              <input
                className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-lg"
                inputMode="decimal"
                placeholder="np. 2000"
                value={pawelZl}
                onChange={(e) => setPawelZl(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label>Ile ma Milena na koncie?</Label>
              <input
                className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-lg"
                inputMode="decimal"
                placeholder="np. 1500"
                value={milenaZl}
                onChange={(e) => setMilenaZl(e.target.value)}
              />
            </div>
            <p className="rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-sm">
              Razem:{" "}
              <strong>
                {(togetherPreview / 100).toLocaleString("pl-PL", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                zł
              </strong>
            </p>
            {error && (
              <p className="rounded-xl bg-[#fde8e8] px-3 py-2 text-sm text-[var(--danger)]">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="rounded-xl bg-[var(--accent)] py-3 font-medium text-white"
            >
              Dalej →
            </button>
          </form>
        </Card>
      ) : (
        <Card>
          <div className="flex flex-col gap-3">
            <div>
              <Label>Główna wypłata (opcjonalnie)</Label>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Żeby prognoza wiedziała, kiedy wpływają pieniądze. Możesz pominąć.
              </p>
            </div>
            <div>
              <Label>Nazwa</Label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                value={incomeName}
                onChange={(e) => setIncomeName(e.target.value)}
              />
            </div>
            <div>
              <Label>Czyja pensja?</Label>
              <div className="mt-1 flex gap-2">
                {(
                  [
                    ["pawel", "Paweł"],
                    ["milena", "Milena"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`flex-1 rounded-xl py-2.5 text-sm font-medium ${
                      incomeOwner === id
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--bg-accent)]"
                    }`}
                    onClick={() => setIncomeOwner(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Kwota (zł)</Label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                inputMode="decimal"
                placeholder="np. 5000"
                value={incomeZl}
                onChange={(e) => setIncomeZl(e.target.value)}
              />
            </div>
            <div>
              <Label>Dzień miesiąca (1–28)</Label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                inputMode="numeric"
                value={incomeDay}
                onChange={(e) => setIncomeDay(e.target.value)}
              />
            </div>
            {error && (
              <p className="rounded-xl bg-[#fde8e8] px-3 py-2 text-sm text-[var(--danger)]">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={saving}
              className="rounded-xl bg-[var(--accent)] py-3 font-medium text-white disabled:opacity-60"
              onClick={() => void finish(true)}
            >
              {saving ? "Zapisywanie…" : "Gotowe"}
            </button>
            <button
              type="button"
              disabled={saving}
              className="rounded-xl border border-[var(--line)] py-2.5 text-sm"
              onClick={() => void finish(false)}
            >
              Pomiń — tylko salda na teraz
            </button>
            <button
              type="button"
              className="text-sm text-[var(--ink-muted)] underline"
              onClick={() => setStep(1)}
            >
              ← Wstecz
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
