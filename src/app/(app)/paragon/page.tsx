"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBudget } from "@/lib/data/budget-context";
import { Card, Label } from "@/components/ui";
import { parseZlToGrosze } from "@/lib/data/form-options";
import type { PersonId } from "@/lib/data/types";
import { todayIsoWarsaw } from "@/lib/dates/today";
import { suggestCategory, ruleFromMerchantCorrection } from "@/lib/receipts/categorize";
import type { OcrSuggestion, OcrFailureKind } from "@/lib/receipts/types";
import {
  getReceiptImageUrl,
  loadHouseholdRules,
  markReceiptConfirmed,
  replaceReceiptItems,
  requestOcr,
  updateReceiptReview,
  uploadReceiptPhoto,
  upsertCategoryRule,
} from "@/lib/receipts/client";
import {
  CROP_TOTAL_ZONE,
  blobToBase64,
  cropImageToBlob,
} from "@/lib/receipts/crop-image";
import { isTechnicalOcrNote } from "@/lib/receipts/ocr-notes";

function messageForFailure(kind: OcrFailureKind): string {
  if (kind === "quota") {
    return "Limit darmowego Gemini chwilowo wyczerpany (to nie wina zdjęcia). Odczekaj 1–15 min albo wpisz sumę ręcznie (~63 zł na tym paragonie).";
  }
  if (kind === "config") {
    return "Brak lub zły klucz GEMINI_API_KEY na Vercel. Sprawdź Environment Variables i zrób Redeploy.";
  }
  return "Odczyt AI nie wyszedł. Uzupełnij pola ze zdjęcia i potwierdź — albo spróbuj za chwilę „Popraw odczyt sumy”.";
}

function inferFailureFromNote(note?: string): OcrFailureKind {
  if (!note) return null;
  if (note === "manual_after_quota") return "quota";
  if (note === "manual_after_config" || /Brak klucza|GEMINI_API_KEY/i.test(note)) {
    return "config";
  }
  if (
    note === "manual_after_error" ||
    isTechnicalOcrNote(note) ||
    note.startsWith("Nie udało")
  ) {
    return "api";
  }
  return null;
}

const CATEGORIES = [
  "Jedzenie",
  "Transport",
  "Dom",
  "Zdrowie",
  "Rozrywka",
  "Ubrania",
  "Inne",
];

type Step = "pick" | "review";

type LineItem = {
  name: string;
  totalZl: string;
  category: string;
};

export default function ReceiptPage() {
  const { state, hydrated, dataSource, householdId, addExpense } = useBudget();
  const router = useRouter();
  const [step, setStep] = useState<Step>("pick");
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrNote, setOcrNote] = useState<string | null>(null);

  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(todayIsoWarsaw());
  const [totalZl, setTotalZl] = useState("");
  const [category, setCategory] = useState("Jedzenie");
  const [person, setPerson] = useState<PersonId | "shared">("shared");
  const [accountId, setAccountId] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [learnRule, setLearnRule] = useState(true);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const def =
      state.accounts.find((a) => a.includeInBudget && a.active)?.id ??
      state.accounts[0]?.id ??
      "";
    setAccountId((prev) => prev || def);
  }, [state.accounts]);

  if (!hydrated) {
    return <p className="text-[var(--ink-muted)]">Ładowanie…</p>;
  }

  if (dataSource !== "supabase" || !householdId) {
    return (
      <div className="flex flex-col gap-4">
        <header>
          <Link href="/dodaj" className="text-sm text-[var(--accent)]">
            ← Dodaj
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Paragon</h1>
        </header>
        <Card>
          <p className="text-sm text-[var(--ink-muted)]">
            Zdjęcia paragonów działają po zalogowaniu i utworzeniu gospodarstwa
            (Supabase). W trybie lokalnym dodaj wydatek ręcznie w Dodaj.
          </p>
        </Card>
      </div>
    );
  }

  async function onFileChosen(file: File | null) {
    if (!file || !householdId) return;
    setError(null);
    setOcrNote(null);
    setBusy(true);
    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Zdjęcie może mieć max 5 MB.");
      }
      const localUrl = URL.createObjectURL(file);
      setPreviewUrl(localUrl);
      setSourceFile(file);

      const { receiptId: id, storagePath } = await uploadReceiptPhoto({
        householdId,
        file,
      });
      setReceiptId(id);

      // V1: tylko Gemini → ekran zatwierdzenia
      let suggestion: OcrSuggestion;
      try {
        suggestion = await requestOcr(id);
      } catch {
        suggestion = {
          provider: "manual",
          merchantName: null,
          receiptDate: null,
          totalGrosze: null,
          suggestedCategory: null,
          items: [],
          note: "manual_after_error",
          failureKind: "api",
        };
      }

      const kind = suggestion.failureKind ?? inferFailureFromNote(suggestion.note);
      if (suggestion.provider === "manual" || kind) {
        suggestion = {
          ...suggestion,
          note: messageForFailure(kind ?? "api"),
          failureKind: kind ?? "api",
        };
      }

      applySuggestion(suggestion, householdId);

      await updateReceiptReview({
        receiptId: id,
        merchantName: suggestion.merchantName ?? "",
        receiptDate: suggestion.receiptDate ?? todayIsoWarsaw(),
        totalGrosze: suggestion.totalGrosze ?? 0,
        suggestedCategory: suggestion.suggestedCategory ?? "Inne",
      }).catch(() => {
        /* nie blokuj UI */
      });

      const signed = await getReceiptImageUrl(storagePath).catch(() => localUrl);
      setPreviewUrl(signed);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd wczytywania");
      setStep("pick");
    } finally {
      setBusy(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  }

  function applySuggestion(suggestion: OcrSuggestion, hhId: string) {
    setOcrNote(
      suggestion.note ??
        "Sprawdź sklep, datę i sumę — wydatek zapisze się dopiero po potwierdzeniu.",
    );
    if (suggestion.merchantName) setMerchant(suggestion.merchantName);
    if (suggestion.receiptDate) setDate(suggestion.receiptDate);
    if (suggestion.totalGrosze != null) {
      setTotalZl((suggestion.totalGrosze / 100).toFixed(2));
    }
    if (suggestion.suggestedCategory) {
      setCategory(suggestion.suggestedCategory);
    } else if (suggestion.merchantName) {
      void loadHouseholdRules(hhId).then((rules) => {
        setCategory(suggestCategory(suggestion.merchantName!, rules));
      });
    }
    setItems(
      suggestion.items.map((i) => ({
        name: i.name,
        totalZl: (i.totalGrosze / 100).toFixed(2),
        category: i.categoryName ?? suggestion.suggestedCategory ?? "Inne",
      })),
    );
  }

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    if (!receiptId || !householdId) return;
    setError(null);
    const total = parseZlToGrosze(totalZl);
    if (!merchant.trim()) {
      setError("Podaj nazwę sklepu / opis.");
      return;
    }
    if (total === null || total <= 0) {
      setError("Podaj poprawną kwotę.");
      return;
    }
    if (!accountId) {
      setError("Wybierz konto.");
      return;
    }

    setBusy(true);
    try {
      await updateReceiptReview({
        receiptId,
        merchantName: merchant.trim(),
        receiptDate: date,
        totalGrosze: total,
        suggestedCategory: category,
      });

      const parsedItems = items
        .map((i) => {
          const g = parseZlToGrosze(i.totalZl);
          if (!i.name.trim() || g === null) return null;
          return {
            name: i.name.trim(),
            totalGrosze: g,
            categoryName: i.category,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      await replaceReceiptItems({
        householdId,
        receiptId,
        items: parsedItems,
      });

      if (learnRule) {
        const rule = ruleFromMerchantCorrection(merchant, category);
        if (rule) {
          await upsertCategoryRule({
            householdId,
            pattern: rule.pattern,
            categoryName: rule.categoryName,
          });
        }
      }

      const txId = await addExpense({
        amountGrosze: total,
        date,
        description: merchant.trim(),
        category,
        person,
        paidBy: person,
        isShared: person === "shared",
        status: "paid",
        accountId,
        receiptId,
        note: "Z paragonu",
      });

      await markReceiptConfirmed(receiptId, txId);
      router.push("/transakcje");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu");
    } finally {
      setBusy(false);
    }
  }

  async function rereadTotalFocus() {
    if (!sourceFile || !receiptId) {
      setError("Brak zdjęcia do ponownego odczytu.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const crop = await cropImageToBlob(sourceFile, CROP_TOTAL_ZONE);
      const focusTotalBase64 = await blobToBase64(crop);
      const again = await requestOcr(receiptId, {
        focusTotalBase64,
        focusMimeType: "image/jpeg",
      });

      if (
        again.note === "manual_after_quota" ||
        again.provider === "manual" ||
        again.totalGrosze == null
      ) {
        setError(
          "AI nie odczytało sumy (limit lub błąd). Wpisz kwotę ręcznie ze zdjęcia.",
        );
        return;
      }

      setTotalZl((again.totalGrosze / 100).toFixed(2));
      if (again.merchantName) setMerchant(again.merchantName);
      if (again.receiptDate) setDate(again.receiptDate);
      setOcrNote(
        "Ponowny odczyt Gemini ze skupieniem na dolnym fragmencie. Sprawdź sumę przed zapisem.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd odczytu sumy");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <Link href="/dodaj" className="text-sm text-[var(--accent)]">
          ← Dodaj
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Paragon</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Zdjęcie → Gemini → Twoja weryfikacja → dopiero potem wydatek.
        </p>
      </header>

      {step === "pick" && (
        <Card>
          <Label>Zdjęcie paragonu</Label>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Aparat albo galeria (max 5 MB). Na iPhonie to dwa osobne przyciski.
          </p>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={busy}
            onChange={(e) => void onFileChosen(e.target.files?.[0] ?? null)}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => void onFileChosen(e.target.files?.[0] ?? null)}
          />
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-xl bg-[var(--accent)] py-3 font-medium text-white disabled:opacity-60"
              onClick={() => cameraInputRef.current?.click()}
            >
              Zrób zdjęcie
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-xl bg-[var(--bg-accent)] py-3 font-medium disabled:opacity-60"
              onClick={() => galleryInputRef.current?.click()}
            >
              Wybierz z galerii
            </button>
          </div>
          {busy && (
            <p className="mt-3 text-sm text-[var(--ink-muted)]">
              Wysyłanie i odczyt AI… To może chwilę potrwać.
            </p>
          )}
        </Card>
      )}

      {step === "review" && (
        <>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Paragon"
              className="max-h-64 w-full rounded-2xl object-contain bg-[var(--bg-accent)]"
            />
          )}

          {ocrNote && (
            <p className="rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-sm">
              {ocrNote}
            </p>
          )}

          <Card>
            <form className="flex flex-col gap-3" onSubmit={onConfirm}>
              <div>
                <Label>Sklep / opis</Label>
                <input
                  className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                  value={merchant}
                  onChange={(e) => {
                    setMerchant(e.target.value);
                    setCategory(suggestCategory(e.target.value));
                  }}
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
                <Label>Suma (zł)</Label>
                <input
                  className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                  inputMode="decimal"
                  value={totalZl}
                  onChange={(e) => setTotalZl(e.target.value)}
                />
                <button
                  type="button"
                  disabled={busy || !sourceFile}
                  className="mt-2 w-full rounded-xl bg-[var(--bg-accent)] py-2 text-sm font-medium disabled:opacity-60"
                  onClick={() => void rereadTotalFocus()}
                >
                  Popraw odczyt sumy (skupienie na dole paragonu)
                </button>
              </div>
              <div>
                <Label>Kategoria</Label>
                <select
                  className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
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
                  {state.accounts
                    .filter((a) => a.active)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <Label>Kto</Label>
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

              {items.length > 0 && (
                <div>
                  <Label>Pozycje (opcjonalnie)</Label>
                  <ul className="mt-2 space-y-2">
                    {items.map((item, idx) => (
                      <li
                        key={idx}
                        className="grid grid-cols-[1fr_5rem_6rem] gap-2"
                      >
                        <input
                          className="rounded-lg border border-[var(--line)] px-2 py-1.5 text-sm"
                          value={item.name}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx] = { ...item, name: e.target.value };
                            setItems(next);
                          }}
                        />
                        <input
                          className="rounded-lg border border-[var(--line)] px-2 py-1.5 text-sm"
                          inputMode="decimal"
                          value={item.totalZl}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx] = { ...item, totalZl: e.target.value };
                            setItems(next);
                          }}
                        />
                        <select
                          className="rounded-lg border border-[var(--line)] px-1 py-1.5 text-xs"
                          value={item.category}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx] = { ...item, category: e.target.value };
                            setItems(next);
                          }}
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={learnRule}
                  onChange={(e) => setLearnRule(e.target.checked)}
                />
                Zapamiętaj kategorię dla tego sklepu
              </label>

              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-[var(--accent)] py-3 font-medium text-white disabled:opacity-60"
              >
                {busy ? "Zapisywanie…" : "Potwierdź i dodaj wydatek"}
              </button>
              <button
                type="button"
                className="text-sm text-[var(--ink-muted)]"
                onClick={() => {
                  setStep("pick");
                  setReceiptId(null);
                  setItems([]);
                }}
              >
                Wybierz inne zdjęcie
              </button>
            </form>
          </Card>
        </>
      )}

      {error && (
        <p className="rounded-xl bg-[#fde8e8] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
