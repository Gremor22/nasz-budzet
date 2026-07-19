"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Label } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (password.length < 8) {
        setError("Hasło powinno mieć co najmniej 8 znaków.");
        return;
      }
      const supabase = createClient();
      const { data, error: signError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: displayName.trim() || undefined },
        },
      });
      if (signError) {
        setError(signError.message);
        return;
      }
      if (data.session) {
        router.replace("/onboarding");
        router.refresh();
        return;
      }
      setInfo(
        "Konto utworzone. Jeśli włączone jest potwierdzenie e-mail, sprawdź skrzynkę. Na czas testów możesz wyłączyć Confirm email w Supabase.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd rejestracji");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h2 className="text-xl font-semibold">Rejestracja</h2>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        Załóż osobne konto (np. dla Pawła i osobne dla Mileny).
      </p>
      <form className="mt-4 flex flex-col gap-3" onSubmit={onSubmit}>
        <div>
          <Label>Imię (opcjonalnie)</Label>
          <input
            className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="np. Paweł (test)"
          />
        </div>
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
          <Label>Hasło (min. 8 znaków)</Label>
          <input
            type="password"
            autoComplete="new-password"
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
        {info && (
          <p className="rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-sm">
            {info}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-[var(--accent)] py-3 font-medium text-white disabled:opacity-60"
        >
          {loading ? "Tworzenie…" : "Utwórz konto"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-[var(--ink-muted)]">
        Masz już konto?{" "}
        <Link href="/logowanie" className="text-[var(--accent)] underline">
          Zaloguj się
        </Link>
      </p>
    </Card>
  );
}
