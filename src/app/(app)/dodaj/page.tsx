"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useBudget } from "@/lib/data/budget-context";
import { Card, Label } from "@/components/ui";
import type { ExpenseStatus, PersonId } from "@/lib/data/types";

export default function AddPage() {
  const { addExpense, addIncome, state, dataSource } = useBudget();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [description, setDescription] = useState("");
  const [amountZl, setAmountZl] = useState("");
  const [date, setDate] = useState(state.settings.asOfDate);
  const [category, setCategory] = useState("Jedzenie");
  const [person, setPerson] = useState<PersonId | "shared">("shared");
  const [status, setStatus] = useState<ExpenseStatus>("paid");
  const defaultAccount =
    state.accounts.find((a) => a.includeInBudget && a.active)?.id ??
    state.accounts[0]?.id ??
    "";
  const [accountId, setAccountId] = useState(defaultAccount);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const typ = searchParams.get("typ");
    if (typ === "wpływ" || typ === "wplyw" || typ === "income") {
      setKind("income");
    }
  }, [searchParams]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    const zl = Number(amountZl.replace(",", "."));
    if (!description.trim()) {
      setError("Podaj opis.");
      return;
    }
    if (!Number.isFinite(zl) || zl <= 0) {
      setError("Podaj poprawną kwotę większą od zera.");
      return;
    }
    const amountGrosze = Math.round(zl * 100);
    const chosen =
      accountId ||
      state.accounts.find((a) => a.includeInBudget)?.id;
    if (!chosen) {
      setError(
        "Brak konta. Dodaj konto w Więcej → Konta albo wczytaj dane demo.",
      );
      return;
    }

    const base = {
      amountGrosze,
      date,
      description: description.trim(),
      category,
      person,
      paidBy: person,
      isShared: person === "shared",
      status,
      accountId: chosen,
    };

    try {
      setSaving(true);
      if (kind === "expense") {
        await addExpense(base);
      } else {
        await addIncome({
          ...base,
          status: status === "paid" ? "paid" : "planned",
        });
      }
      router.push("/transakcje");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">Dodaj</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Zapis w {dataSource === "supabase" ? "Supabase (wspólny)" : "przeglądarce"}.
        </p>
      </header>

      {dataSource === "supabase" && (
        <Link
          href="/paragon"
          data-tour="scan-receipt"
          className="rounded-xl bg-[var(--accent-soft)] px-3 py-3 text-center text-sm font-medium text-[var(--accent)]"
        >
          Zeskanuj paragon (zdjęcie) →
        </Link>
      )}

      <div className="flex gap-2" data-tour="add-form">
        <button
          type="button"
          className={`flex-1 rounded-xl py-2.5 text-sm font-medium ${
            kind === "expense"
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--bg-accent)]"
          }`}
          onClick={() => setKind("expense")}
        >
          Wydatek
        </button>
        <button
          type="button"
          className={`flex-1 rounded-xl py-2.5 text-sm font-medium ${
            kind === "income"
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--bg-accent)]"
          }`}
          onClick={() => setKind("income")}
        >
          Wpływ
        </button>
      </div>

      <Card>
        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <div>
            <Label>Opis</Label>
            <input
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="np. Zakupy"
            />
          </div>
          <div>
            <Label>Kwota (zł)</Label>
            <input
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              inputMode="decimal"
              value={amountZl}
              onChange={(e) => setAmountZl(e.target.value)}
              placeholder="np. 49,99"
            />
          </div>
          <div>
            <Label>Data</Label>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Kategoria</Label>
            <select
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {[
                "Jedzenie",
                "Dom",
                "Transport",
                "Zdrowie",
                "Rozrywka",
                "Zakupy",
                "Oszczędności",
                "Inne",
              ].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Konto</Label>
            <select
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {state.accounts.filter((a) => a.active).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {!a.includeInBudget ? " (poza budżetem)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Osoba</Label>
            <select
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              value={person}
              onChange={(e) =>
                setPerson(e.target.value as PersonId | "shared")
              }
            >
              <option value="shared">Wspólne</option>
              <option value="pawel">Paweł</option>
              <option value="milena">Milena</option>
            </select>
          </div>
          <div>
            <Label>Status</Label>
            <select
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              value={status}
              onChange={(e) => setStatus(e.target.value as ExpenseStatus)}
            >
              <option value="paid">Opłacony / otrzymany</option>
              <option value="planned">Planowany</option>
              <option value="reserved">Zarezerwowany</option>
              <option value="uncertain">Niepewny</option>
            </select>
          </div>

          {error && (
            <p className="rounded-xl bg-[#fde8e8] px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="mt-2 rounded-xl bg-[var(--accent)] py-3 font-medium text-white disabled:opacity-60"
          >
            {saving ? "Zapisywanie…" : "Zapisz"}
          </button>
        </form>
      </Card>
    </div>
  );
}
