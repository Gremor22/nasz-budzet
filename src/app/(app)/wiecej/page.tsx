"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBudget } from "@/lib/data/budget-context";
import { downloadBudgetExport } from "@/lib/data/export-client";
import type { ExportFormat } from "@/lib/data/export";
import { useTour } from "@/lib/tour/context";
import { ThemeSettings } from "@/components/ThemeSettings";
import { Card, Label, Money } from "@/components/ui";
import { parseZlToGrosze } from "@/lib/data/form-options";
import type { PersonId } from "@/lib/data/types";

const PERSON_LABEL: Record<PersonId, string> = {
  pawel: "Paweł",
  milena: "Milena",
};

export default function MorePage() {
  const {
    state,
    changeBufferZl,
    changeHorizon,
    hydrated,
    dataSource,
    userEmail,
    userId,
    myPersonId,
    myRole,
    members,
    createInviteCode,
    joinWithInviteCode,
    removeMember,
    setMyPersonKey,
    signOut,
    setGoalReserved,
    resetHouseholdBudget,
  } = useBudget();
  const router = useRouter();
  const { startTour } = useTour();
  const [bufferInput, setBufferInput] = useState(
    String(state.household.safetyBufferGrosze / 100),
  );
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinPerson, setJoinPerson] = useState<PersonId>("milena");
  const [joinBalanceZl, setJoinBalanceZl] = useState("");
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [resetting, setResetting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isOwner = myRole === "owner";

  async function onResetBudget() {
    const ok = window.confirm(
      "Usunąć WSZYSTKIE transakcje, dochody, rachunki i cele?\n\nKonta wrócą do jednego pustego „Główne konto”. Potem przejdziesz przez szybki start od nowa.",
    );
    if (!ok) return;
    const ok2 = window.confirm(
      "Na pewno? Tej operacji nie cofniesz (możesz wcześniej zrobić backup JSON).",
    );
    if (!ok2) return;
    setResetting(true);
    setError(null);
    setMessage(null);
    try {
      await resetHouseholdBudget();
      router.replace("/start");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zresetować");
    } finally {
      setResetting(false);
    }
  }

  async function onExport(format: ExportFormat) {
    if (dataSource !== "supabase" && dataSource !== "local") return;
    setExporting(format);
    setError(null);
    setMessage(null);
    try {
      await downloadBudgetExport(format, { dataSource, state });
      setMessage(
        format === "csv"
          ? "Pobrano CSV transakcji."
          : "Pobrano pełny backup JSON.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd eksportu");
    } finally {
      setExporting(null);
    }
  }

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
        {dataSource === "supabase" && state.household.name && (
          <p className="mt-1 text-sm">
            Gospodarstwo:{" "}
            <span className="font-medium">{state.household.name}</span>
          </p>
        )}
      </header>

      <Card data-tour="wiecej-budget">
        <Label>Budżet</Label>
        <div className="mt-2 flex flex-col gap-1">
          {[
            { href: "/analityka", label: "Analityka" },
            { href: "/konta", label: "Konta" },
            { href: "/dochody", label: "Źródła dochodu" },
            { href: "/rachunki", label: "Rachunki cykliczne" },
            { href: "/cele", label: "Cele oszczędnościowe" },
            { href: "/pomoc", label: "Instrukcja" },
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

      {dataSource === "supabase" && !myPersonId && (
        <Card>
          <Label>Kim jesteś w budżecie?</Label>
          <div className="mt-2 flex gap-2">
            {(
              [
                ["pawel", "Paweł"],
                ["milena", "Milena"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="flex-1 rounded-xl bg-[var(--accent)] py-2.5 text-sm font-medium text-white"
                onClick={async () => {
                  setError(null);
                  try {
                    await setMyPersonKey(id);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Błąd");
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </Card>
      )}

      {dataSource === "supabase" && (
        <Card>
          <Label>Gospodarstwo</Label>

          {isOwner && (
            <>
              <button
                type="button"
                className="mt-3 w-full rounded-xl bg-[var(--accent)] py-2.5 text-white"
                onClick={async () => {
                  setError(null);
                  setMessage(null);
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

              {members.length > 0 && (
                <ul className="mt-4 divide-y divide-[var(--line)]">
                  {members.map((m) => (
                    <li
                      key={m.userId}
                      className="flex items-center justify-between gap-2 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{m.displayName}</p>
                        <p className="text-xs text-[var(--ink-muted)]">
                          {m.role === "owner" ? "Właściciel" : "Członek"}
                          {m.personKey
                            ? ` · ${PERSON_LABEL[m.personKey]}`
                            : ""}
                          {m.userId === userId ? " · Ty" : ""}
                        </p>
                      </div>
                      {m.role !== "owner" && m.userId !== userId && (
                        <button
                          type="button"
                          disabled={removingId === m.userId}
                          className="text-[var(--danger)] disabled:opacity-60"
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Wyrzucić ${m.displayName} z gospodarstwa?`,
                              )
                            ) {
                              return;
                            }
                            setRemovingId(m.userId);
                            setError(null);
                            try {
                              await removeMember(m.userId);
                            } catch (e) {
                              setError(
                                e instanceof Error ? e.message : "Błąd",
                              );
                            } finally {
                              setRemovingId(null);
                            }
                          }}
                        >
                          Wyrzuć
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <div className={`${isOwner ? "mt-4 border-t border-[var(--line)] pt-4" : "mt-3"}`}>
            <Label>Dołącz kodem</Label>
            <form
              className="mt-2 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void (async () => {
                  setError(null);
                  setMessage(null);
                  const balance = parseZlToGrosze(joinBalanceZl || "0");
                  if (balance === null || balance < 0) {
                    setError("Podaj kwotę na swoim koncie.");
                    return;
                  }
                  setJoining(true);
                  try {
                    await joinWithInviteCode({
                      code: joinCode,
                      personKey: joinPerson,
                      balanceGrosze: balance,
                    });
                    setJoinCode("");
                    setJoinBalanceZl("");
                    setMessage("Dołączono.");
                    router.replace("/");
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Nie udało się dołączyć",
                    );
                  } finally {
                    setJoining(false);
                  }
                })();
              }}
            >
              <input
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 uppercase tracking-widest"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Kod"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
              <div className="flex gap-2">
                {(
                  [
                    ["pawel", "Paweł"],
                    ["milena", "Milena"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`flex-1 rounded-xl py-2 text-sm font-medium ${
                      joinPerson === id
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--bg-accent)]"
                    }`}
                    onClick={() => setJoinPerson(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                inputMode="decimal"
                placeholder="Ile masz na koncie?"
                value={joinBalanceZl}
                onChange={(e) => setJoinBalanceZl(e.target.value)}
              />
              <button
                type="submit"
                disabled={joining || !joinCode.trim()}
                className="w-full rounded-xl border border-[var(--accent)] py-2.5 text-[var(--accent)] disabled:opacity-60"
              >
                {joining ? "Dołączanie…" : "Dołącz"}
              </button>
            </form>
          </div>
        </Card>
      )}

      <Card>
        <Label>Bufor bezpieczeństwa</Label>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Kwota odejmowana od prognozy „bezpiecznie do wydania”.
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

      <Card>
        <ThemeSettings />
      </Card>

      <Card data-tour="wiecej-export">
        <Label>Eksport danych</Label>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Pobierz kopię budżetu na dysk — backup JSON lub transakcje do Excela
          (CSV).
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="flex-1 rounded-xl bg-[var(--accent)] py-2.5 text-white disabled:opacity-60"
            disabled={exporting !== null}
            onClick={() => void onExport("json")}
          >
            {exporting === "json" ? "Pobieranie…" : "Backup JSON"}
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl border border-[var(--accent)] py-2.5 text-[var(--accent)] disabled:opacity-60"
            disabled={exporting !== null}
            onClick={() => void onExport("csv")}
          >
            {exporting === "csv" ? "Pobieranie…" : "Transakcje CSV"}
          </button>
        </div>
      </Card>

      <Card>
        <Label>Przewodnik po aplikacji</Label>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Interaktywny tour ze strzałkami — pokaże, gdzie klikać przy pierwszym
          użyciu.
        </p>
        <button
          type="button"
          className="mt-3 w-full rounded-xl border border-[var(--accent)] py-2.5 text-[var(--accent)]"
          onClick={startTour}
        >
          Pokaż przewodnik ponownie
        </button>
      </Card>

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

      <Card>
        <Label>Zresetuj budżet</Label>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Czyści wszystkie dane i uruchamia szybki start od zera. Przydatne po
          testach albo gdy coś poszło nie tak (np. duplikaty).
        </p>
        <button
          type="button"
          disabled={resetting}
          className="mt-3 w-full rounded-xl border border-[var(--danger)] py-2.5 text-sm text-[var(--danger)] disabled:opacity-60"
          onClick={() => void onResetBudget()}
        >
          {resetting ? "Czyszczenie…" : "Zresetuj wszystko i zacznij od nowa"}
        </button>
      </Card>

      {dataSource === "supabase" && (
        <button
          type="button"
          className="w-full rounded-xl border border-[var(--line)] py-2.5"
          onClick={() => void signOut()}
        >
          Wyloguj
        </button>
      )}
    </div>
  );
}
