"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useBudget } from "@/lib/data/budget-context";
import { Card, Label, Money } from "@/components/ui";
import { parseZlToGrosze } from "@/lib/data/form-options";
import type { PersonId, SavingsGoal } from "@/lib/data/types";

const emptyForm = {
  name: "",
  targetZl: "",
  savedZl: "0",
  reserved: false,
  owner: "shared" as PersonId | "shared",
  deadline: "",
  active: true,
};

export default function GoalsPage() {
  const { state, hydrated, saveSavingsGoal, removeSavingsGoal } = useBudget();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!hydrated) return <p className="text-[var(--ink-muted)]">Ładowanie…</p>;

  function startEdit(g: SavingsGoal) {
    setEditingId(g.id);
    setForm({
      name: g.name,
      targetZl: String(g.targetAmountGrosze / 100),
      savedZl: String(g.savedAmountGrosze / 100),
      reserved: g.reserved,
      owner: g.owner,
      deadline: g.deadline ?? "",
      active: g.active,
    });
    setError(null);
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const target = parseZlToGrosze(form.targetZl);
    const saved = parseZlToGrosze(form.savedZl);
    if (!form.name.trim()) {
      setError("Podaj nazwę celu.");
      return;
    }
    if (target === null || target <= 0) {
      setError("Podaj poprawną kwotę docelową.");
      return;
    }
    if (saved === null) {
      setError("Podaj poprawną kwotę zebraną.");
      return;
    }
    setSaving(true);
    try {
      await saveSavingsGoal({
        id: editingId ?? undefined,
        name: form.name.trim(),
        targetAmountGrosze: target,
        savedAmountGrosze: saved,
        reserved: form.reserved,
        owner: form.owner,
        deadline: form.deadline || undefined,
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
        <h1 className="mt-1 text-2xl font-semibold">Cele oszczędnościowe</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Tylko cele oznaczone jako zarezerwowane zmniejszają „bezpiecznie do
          wydania”.
        </p>
      </header>

      <Card>
        <ul className="divide-y divide-[var(--line)]">
          {state.savingsGoals.map((g) => (
            <li key={g.id} className="flex justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{g.name}</p>
                <p className="text-xs text-[var(--ink-muted)]">
                  <Money grosze={g.savedAmountGrosze} size="sm" /> /{" "}
                  <Money grosze={g.targetAmountGrosze} size="sm" />
                  {g.reserved ? " · zarezerwowane" : ""}
                  {!g.active ? " · nieaktywny" : ""}
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  className="text-[var(--accent)]"
                  onClick={() => startEdit(g)}
                >
                  Edytuj
                </button>
                <button
                  type="button"
                  className="text-[var(--danger)]"
                  onClick={async () => {
                    if (!window.confirm(`Usunąć „${g.name}”?`)) return;
                    await removeSavingsGoal(g.id);
                  }}
                >
                  Usuń
                </button>
              </div>
            </li>
          ))}
          {state.savingsGoals.length === 0 && (
            <li className="py-3 text-sm text-[var(--ink-muted)]">
              Brak celów — dodaj poniżej.
            </li>
          )}
        </ul>
      </Card>

      <Card>
        <Label>{editingId ? "Edycja celu" : "Nowy cel"}</Label>
        <form className="mt-2 flex flex-col gap-3" onSubmit={onSubmit}>
          <input
            className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            placeholder="Nazwa (np. Wakacje)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div>
            <Label>Kwota docelowa (zł)</Label>
            <input
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              inputMode="decimal"
              value={form.targetZl}
              onChange={(e) => setForm({ ...form, targetZl: e.target.value })}
            />
          </div>
          <div>
            <Label>Już zebrane (zł)</Label>
            <input
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              inputMode="decimal"
              value={form.savedZl}
              onChange={(e) => setForm({ ...form, savedZl: e.target.value })}
            />
          </div>
          <div>
            <Label>Właściciel</Label>
            <select
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              value={form.owner}
              onChange={(e) =>
                setForm({
                  ...form,
                  owner: e.target.value as PersonId | "shared",
                })
              }
            >
              <option value="shared">Wspólny</option>
              <option value="pawel">Paweł</option>
              <option value="milena">Milena</option>
            </select>
          </div>
          <div>
            <Label>Termin (opcjonalnie)</Label>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.reserved}
              onChange={(e) =>
                setForm({ ...form, reserved: e.target.checked })
              }
            />
            Zarezerwowane (odejmuj od bezpiecznie do wydania)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Aktywny
          </label>
          {error && (
            <p className="rounded-xl bg-[#fde8e8] px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-[var(--accent)] py-2.5 text-white disabled:opacity-60"
            >
              {saving ? "Zapisywanie…" : editingId ? "Zapisz zmiany" : "Dodaj cel"}
            </button>
            {editingId && (
              <button
                type="button"
                className="rounded-xl bg-[var(--bg-accent)] px-4"
                onClick={startCreate}
              >
                Anuluj
              </button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
