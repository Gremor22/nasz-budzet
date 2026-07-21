"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useBudget } from "@/lib/data/budget-context";
import { Card, Label, Money } from "@/components/ui";
import {
  CONFIDENCE_OPTIONS,
  FREQUENCY_OPTIONS,
  parseZlToGrosze,
} from "@/lib/data/form-options";
import type {
  IncomeConfidence,
  IncomeFrequency,
  IncomeSource,
  PersonId,
} from "@/lib/data/types";
import { todayIsoWarsaw } from "@/lib/dates/today";

const emptyForm = {
  name: "",
  owner: "milena" as PersonId,
  typicalZl: "",
  safeZl: "",
  frequency: "monthly_on_day" as IncomeFrequency,
  dayOfMonth: "1",
  nextOccurrenceDate: todayIsoWarsaw(),
  confidence: "expected" as IncomeConfidence,
  active: true,
  note: "",
};

export default function IncomePage() {
  const { state, hydrated, saveIncomeSource, removeIncomeSource } = useBudget();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!hydrated) return <p className="text-[var(--ink-muted)]">Ładowanie…</p>;

  function startEdit(s: IncomeSource) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      owner: s.owner,
      typicalZl: String(s.typicalAmountGrosze / 100),
      safeZl: String(s.safeAmountGrosze / 100),
      frequency: s.frequency,
      dayOfMonth: String(s.dayOfMonth ?? 1),
      nextOccurrenceDate: s.nextOccurrenceDate,
      confidence: s.confidence,
      active: s.active,
      note: s.note ?? "",
    });
    setError(null);
  }

  function startCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, nextOccurrenceDate: todayIsoWarsaw() });
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const typical = parseZlToGrosze(form.typicalZl);
    const safe = parseZlToGrosze(form.safeZl);
    if (!form.name.trim()) {
      setError("Podaj nazwę źródła.");
      return;
    }
    if (typical === null || safe === null) {
      setError("Podaj poprawne kwoty (typowa i bezpieczna).");
      return;
    }
    if (safe > typical) {
      setError("Kwota bezpieczna nie powinna być większa niż typowa.");
      return;
    }
    setSaving(true);
    try {
      await saveIncomeSource({
        id: editingId ?? undefined,
        name: form.name.trim(),
        owner: form.owner,
        typicalAmountGrosze: typical,
        safeAmountGrosze: safe,
        frequency: form.frequency,
        dayOfMonth:
          form.frequency === "monthly_on_day"
            ? Number(form.dayOfMonth) || 1
            : undefined,
        nextOccurrenceDate: form.nextOccurrenceDate,
        confidence: form.confidence,
        active: form.active,
        note: form.note.trim() || undefined,
      });
      startCreate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <Link href="/wiecej" className="text-sm text-[var(--accent)]">
          ← Więcej
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Źródła dochodu</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Plan przyszłych wpływów (wypłaty, zlecenia). Nie zmienia „Aktualnego
          salda” — ustaw je w Kontach albo dodaj wpływ w „+”.
        </p>
      </header>

      <Card>
        <ul className="divide-y divide-[var(--line)]">
          {state.incomeSources.map((s) => (
            <li key={s.id} className="flex justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-[var(--ink-muted)]">
                  typowa <Money grosze={s.typicalAmountGrosze} size="sm" /> ·
                  bezpieczna <Money grosze={s.safeAmountGrosze} size="sm" /> ·{" "}
                  {s.confidence}
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <button type="button" className="text-[var(--accent)]" onClick={() => startEdit(s)}>
                  Edytuj
                </button>
                <button
                  type="button"
                  className="text-[var(--danger)]"
                  onClick={async () => {
                    if (!window.confirm(`Usunąć „${s.name}”?`)) return;
                    await removeIncomeSource(s.id);
                  }}
                >
                  Usuń
                </button>
              </div>
            </li>
          ))}
          {state.incomeSources.length === 0 && (
            <li className="py-3 text-sm text-[var(--ink-muted)]">Brak źródeł — dodaj poniżej.</li>
          )}
        </ul>
      </Card>

      <Card>
        <Label>{editingId ? "Edycja źródła" : "Nowe źródło"}</Label>
        <form className="mt-2 flex flex-col gap-3" onSubmit={onSubmit}>
          <input
            className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            placeholder="Nazwa (np. Pensja)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            value={form.owner}
            onChange={(e) =>
              setForm({ ...form, owner: e.target.value as PersonId })
            }
          >
            <option value="milena">Milena</option>
            <option value="pawel">Paweł</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Typowa (zł)</Label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                inputMode="decimal"
                value={form.typicalZl}
                onChange={(e) => setForm({ ...form, typicalZl: e.target.value })}
              />
            </div>
            <div>
              <Label>Bezpieczna (zł)</Label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                inputMode="decimal"
                value={form.safeZl}
                onChange={(e) => setForm({ ...form, safeZl: e.target.value })}
              />
            </div>
          </div>
          <select
            className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            value={form.frequency}
            onChange={(e) =>
              setForm({
                ...form,
                frequency: e.target.value as IncomeFrequency,
              })
            }
          >
            {FREQUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {form.frequency === "monthly_on_day" && (
            <input
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              type="number"
              min={1}
              max={31}
              placeholder="Dzień miesiąca"
              value={form.dayOfMonth}
              onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
            />
          )}
          <div>
            <Label>Następny wpływ</Label>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              value={form.nextOccurrenceDate}
              onChange={(e) =>
                setForm({ ...form, nextOccurrenceDate: e.target.value })
              }
            />
          </div>
          <select
            className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            value={form.confidence}
            onChange={(e) =>
              setForm({
                ...form,
                confidence: e.target.value as IncomeConfidence,
              })
            }
          >
            {CONFIDENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Aktywne
          </label>
          {error && (
            <p className="rounded-xl bg-[#fde8e8] px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            {editingId && (
              <button type="button" className="flex-1 rounded-xl border border-[var(--line)] py-3" onClick={startCreate}>
                Anuluj
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-[var(--accent)] py-3 font-medium text-white disabled:opacity-60"
            >
              {saving ? "Zapisywanie…" : "Zapisz"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
