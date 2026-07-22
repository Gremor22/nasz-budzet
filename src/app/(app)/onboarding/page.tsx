"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useBudget } from "@/lib/data/budget-context";
import { Card, Label } from "@/components/ui";
import { parseZlToGrosze } from "@/lib/data/form-options";
import type { PersonId } from "@/lib/data/types";

export default function OnboardingPage() {
  const router = useRouter();
  const { refresh, signOut, joinWithInviteCode } = useBudget();
  const [mode, setMode] = useState<"create" | "join">("join");
  const [name, setName] = useState("Paweł i Milena");
  const [personKey, setPersonKey] = useState<PersonId>("pawel");
  const [code, setCode] = useState("");
  const [balanceZl, setBalanceZl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        setError("Sesja wygasła. Zaloguj się ponownie.");
        return;
      }

      const { data, error: rpcError } = await supabase.rpc("create_household", {
        p_name: name.trim(),
        p_person_key: personKey,
      });
      if (rpcError) {
        setError(rpcError.message);
        return;
      }
      if (!data) {
        setError("Nie udało się utworzyć gospodarstwa.");
        return;
      }

      await refresh();
      router.replace("/start");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    } finally {
      setLoading(false);
    }
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const balance = parseZlToGrosze(balanceZl || "0");
      if (balance === null || balance < 0) {
        setError("Podaj kwotę na swoim koncie.");
        return;
      }
      await joinWithInviteCode({
        code,
        personKey,
        balanceGrosze: balance,
      });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">Gospodarstwo</h1>
      </header>

      <div className="flex gap-2">
        <button
          type="button"
          className={`flex-1 rounded-xl py-2.5 text-sm font-medium ${
            mode === "create"
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--bg-accent)]"
          }`}
          onClick={() => setMode("create")}
        >
          Utwórz
        </button>
        <button
          type="button"
          className={`flex-1 rounded-xl py-2.5 text-sm font-medium ${
            mode === "join"
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--bg-accent)]"
          }`}
          onClick={() => setMode("join")}
        >
          Dołącz kodem
        </button>
      </div>

      <Card>
        {mode === "create" ? (
          <form className="flex flex-col gap-3" onSubmit={onCreate}>
            <div>
              <Label>Nazwa gospodarstwa</Label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Kim jesteś?</Label>
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
                      personKey === id
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--bg-accent)]"
                    }`}
                    onClick={() => setPersonKey(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <p className="rounded-xl bg-[#fde8e8] px-3 py-2 text-sm text-[var(--danger)]">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[var(--accent)] py-3 font-medium text-white disabled:opacity-60"
            >
              {loading ? "Tworzenie…" : "Utwórz gospodarstwo"}
            </button>
          </form>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={onJoin}>
            <div>
              <Label>Kod zaproszenia</Label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 uppercase tracking-widest"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="NP. A1B2C3D4"
                required
              />
            </div>
            <div>
              <Label>Kim jesteś?</Label>
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
                      personKey === id
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--bg-accent)]"
                    }`}
                    onClick={() => setPersonKey(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Ile masz na swoim koncie?</Label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                inputMode="decimal"
                placeholder="np. 2000"
                value={balanceZl}
                onChange={(e) => setBalanceZl(e.target.value)}
              />
            </div>
            {error && (
              <p className="rounded-xl bg-[#fde8e8] px-3 py-2 text-sm text-[var(--danger)]">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[var(--accent)] py-3 font-medium text-white disabled:opacity-60"
            >
              {loading ? "Dołączanie…" : "Dołącz"}
            </button>
          </form>
        )}
      </Card>

      <button
        type="button"
        className="w-full rounded-xl border border-[var(--line)] py-2.5 text-sm text-[var(--ink-muted)]"
        onClick={() => void signOut()}
      >
        Wyloguj
      </button>
    </div>
  );
}
