"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Label } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signError) {
        setError(signError.message);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd logowania");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h2 className="text-xl font-semibold">Logowanie</h2>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        Osobne konto dla każdej osoby w gospodarstwie.
      </p>
      <form className="mt-4 flex flex-col gap-3" onSubmit={onSubmit}>
        <div>
          <Label>E-mail</Label>
          <input
            type="email"
            autoComplete="email"
            className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Hasło</Label>
          <input
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
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
          {loading ? "Logowanie…" : "Zaloguj się"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-[var(--ink-muted)]">
        Nie masz konta?{" "}
        <Link href="/rejestracja" className="text-[var(--accent)] underline">
          Zarejestruj się
        </Link>
      </p>
    </Card>
  );
}
