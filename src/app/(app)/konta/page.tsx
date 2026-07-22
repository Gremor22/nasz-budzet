"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useBudget } from "@/lib/data/budget-context";
import { computeAccountBalance } from "@/lib/forecast/engine";
import { Card, Label, Money } from "@/components/ui";
import { parseZlToGrosze } from "@/lib/data/form-options";
import type { Account, AccountType, PersonId } from "@/lib/data/types";

const OWNER_LABEL: Record<PersonId | "shared", string> = {
  pawel: "Paweł",
  milena: "Milena",
  shared: "Wspólne",
};

const emptyForm = {
  name: "",
  owner: "pawel" as PersonId | "shared",
  type: "personal" as AccountType,
  openingZl: "0",
  includeInBudget: true,
  active: true,
};

export default function AccountsPage() {
  const { state, hydrated, saveAccount, removeAccount } = useBudget();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!hydrated) return <p className="text-[var(--ink-muted)]">Ładowanie…</p>;

  function startEdit(acc: Account) {
    setEditingId(acc.id);
    setForm({
      name: acc.name,
      owner: acc.owner,
      type: acc.type,
      openingZl: String(acc.openingBalanceGrosze / 100),
      includeInBudget: acc.includeInBudget,
      active: acc.active,
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
    const opening = parseZlToGrosze(form.openingZl);
    if (!form.name.trim()) {
      setError("Podaj nazwę konta.");
      return;
    }
    if (opening === null) {
      setError("Podaj poprawne saldo początkowe.");
      return;
    }
    setSaving(true);
    try {
      await saveAccount({
        id: editingId ?? undefined,
        name: form.name.trim(),
        owner: form.owner,
        type: form.type,
        openingBalanceGrosze: opening,
        includeInBudget: form.includeInBudget,
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
        <h1 className="mt-1 text-2xl font-semibold">Konta</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Saldo na Pulpicie = start konta + opłacone wpływy − wydatki. Paweł,
          Milena i razem widać osobno.
        </p>
      </header>

      <Card>
        <ul className="divide-y divide-[var(--line)]">
          {state.accounts.map((acc) => {
            const live = computeAccountBalance(state, acc.id);
            return (
            <li key={acc.id} className="flex items-start justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{acc.name}</p>
                <p className="text-xs text-[var(--ink-muted)]">
                  {OWNER_LABEL[acc.owner]} · teraz{" "}
                  <Money grosze={live} size="sm" />
                  {" · "}start{" "}
                  <Money grosze={acc.openingBalanceGrosze} size="sm" />
                  {acc.includeInBudget ? " · w budżecie" : " · poza budżetem"}
                  {!acc.active ? " · nieaktywne" : ""}
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <button type="button" className="text-[var(--accent)]" onClick={() => startEdit(acc)}>
                  Edytuj
                </button>
                <button
                  type="button"
                  className="text-[var(--danger)]"
                  onClick={async () => {
                    if (!window.confirm(`Usunąć konto „${acc.name}”?`)) return;
                    try {
                      await removeAccount(acc.id);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Nie można usunąć (może ma transakcje)");
                    }
                  }}
                >
                  Usuń
                </button>
              </div>
            </li>
            );
          })}
          {state.accounts.length === 0 && (
            <li className="py-3 text-sm text-[var(--ink-muted)]">Brak kont — dodaj pierwsze poniżej.</li>
          )}
        </ul>
      </Card>

      <Card>
        <Label>{editingId ? "Edycja konta" : "Nowe konto"}</Label>
        <form className="mt-2 flex flex-col gap-3" onSubmit={onSubmit}>
          <input
            className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            placeholder="Nazwa"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            value={form.owner}
            onChange={(e) =>
              setForm({ ...form, owner: e.target.value as PersonId | "shared" })
            }
          >
            <option value="shared">Wspólne</option>
            <option value="pawel">Paweł</option>
            <option value="milena">Milena</option>
          </select>
          <select
            className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            value={form.type}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value as AccountType })
            }
          >
            <option value="shared">Wspólne</option>
            <option value="personal">Osobiste</option>
            <option value="savings">Oszczędnościowe</option>
            <option value="cash">Gotówka</option>
            <option value="other">Inne</option>
          </select>
          <div>
            <Label>Saldo początkowe (zł)</Label>
            <input
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              inputMode="decimal"
              value={form.openingZl}
              onChange={(e) => setForm({ ...form, openingZl: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.includeInBudget}
              onChange={(e) =>
                setForm({ ...form, includeInBudget: e.target.checked })
              }
            />
            Uwzględniaj w budżecie wspólnym
          </label>
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
              <button
                type="button"
                className="flex-1 rounded-xl border border-[var(--line)] py-3"
                onClick={startCreate}
              >
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
