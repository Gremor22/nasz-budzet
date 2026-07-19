"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useBudget } from "@/lib/data/budget-context";
import { Card, Label, Money } from "@/components/ui";
import {
  BILL_STATUS_OPTIONS,
  FREQUENCY_OPTIONS,
  parseZlToGrosze,
} from "@/lib/data/form-options";
import type {
  ExpenseStatus,
  IncomeFrequency,
  PersonId,
  RecurringBill,
} from "@/lib/data/types";
import { todayIsoWarsaw } from "@/lib/dates/today";

const emptyForm = {
  name: "",
  amountZl: "",
  frequency: "monthly_on_day" as IncomeFrequency,
  dayOfMonth: "5",
  nextOccurrenceDate: todayIsoWarsaw(),
  status: "planned" as ExpenseStatus,
  paidBy: "shared" as PersonId | "shared",
  category: "Dom",
  active: true,
};

export default function BillsPage() {
  const { state, hydrated, saveRecurringBill, removeRecurringBill } =
    useBudget();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!hydrated) return <p className="text-[var(--ink-muted)]">Ładowanie…</p>;

  function startEdit(b: RecurringBill) {
    setEditingId(b.id);
    setForm({
      name: b.name,
      amountZl: String(b.amountGrosze / 100),
      frequency: b.frequency,
      dayOfMonth: String(b.dayOfMonth ?? 1),
      nextOccurrenceDate: b.nextOccurrenceDate,
      status: b.status,
      paidBy: b.paidBy,
      category: b.category,
      active: b.active,
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
    const amount = parseZlToGrosze(form.amountZl);
    if (!form.name.trim()) {
      setError("Podaj nazwę rachunku.");
      return;
    }
    if (amount === null || amount <= 0) {
      setError("Podaj poprawną kwotę.");
      return;
    }
    setSaving(true);
    try {
      await saveRecurringBill({
        id: editingId ?? undefined,
        name: form.name.trim(),
        amountGrosze: amount,
        frequency: form.frequency,
        dayOfMonth:
          form.frequency === "monthly_on_day"
            ? Number(form.dayOfMonth) || 1
            : undefined,
        nextOccurrenceDate: form.nextOccurrenceDate,
        status: form.status,
        paidBy: form.paidBy,
        category: form.category.trim() || "Dom",
        active: form.active,
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
        <h1 className="mt-1 text-2xl font-semibold">Rachunki cykliczne</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Status „zarezerwowany” zmniejsza środki dostępne w podsumowaniu.
        </p>
      </header>

      <Card>
        <ul className="divide-y divide-[var(--line)]">
          {state.recurringBills.map((b) => (
            <li key={b.id} className="flex justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{b.name}</p>
                <p className="text-xs text-[var(--ink-muted)]">
                  <Money grosze={b.amountGrosze} size="sm" /> · {b.status} ·{" "}
                  {b.nextOccurrenceDate}
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <button type="button" className="text-[var(--accent)]" onClick={() => startEdit(b)}>
                  Edytuj
                </button>
                <button
                  type="button"
                  className="text-[var(--danger)]"
                  onClick={async () => {
                    if (!window.confirm(`Usunąć „${b.name}”?`)) return;
                    await removeRecurringBill(b.id);
                  }}
                >
                  Usuń
                </button>
              </div>
            </li>
          ))}
          {state.recurringBills.length === 0 && (
            <li className="py-3 text-sm text-[var(--ink-muted)]">Brak rachunków — dodaj poniżej.</li>
          )}
        </ul>
      </Card>

      <Card>
        <Label>{editingId ? "Edycja rachunku" : "Nowy rachunek"}</Label>
        <form className="mt-2 flex flex-col gap-3" onSubmit={onSubmit}>
          <input
            className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            placeholder="Nazwa (np. Czynsz)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div>
            <Label>Kwota (zł)</Label>
            <input
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              inputMode="decimal"
              value={form.amountZl}
              onChange={(e) => setForm({ ...form, amountZl: e.target.value })}
            />
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
              value={form.dayOfMonth}
              onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
            />
          )}
          <div>
            <Label>Następny termin</Label>
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
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as ExpenseStatus })
            }
          >
            {BILL_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            value={form.paidBy}
            onChange={(e) =>
              setForm({
                ...form,
                paidBy: e.target.value as PersonId | "shared",
              })
            }
          >
            <option value="shared">Wspólne</option>
            <option value="pawel">Paweł</option>
            <option value="milena">Milena</option>
          </select>
          <input
            className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            placeholder="Kategoria"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
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
