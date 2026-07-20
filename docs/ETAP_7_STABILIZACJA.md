# Etap 7 — stabilizacja i produkcja

**Cel:** bezpieczny backup danych, instrukcja dla użytkowników, checklista wdrożenia.

## Zakres Etapu 7

| Element | Status |
|---------|--------|
| Eksport JSON (pełny backup budżetu) | ✅ |
| Eksport CSV (transakcje → Excel) | ✅ |
| Instrukcja w aplikacji (`/pomoc`) | ✅ |
| Instrukcja w docs (`INSTRUKCJA_UZYTKOWNIKA.md`) | ✅ |
| PWA mini (Etap 6) | ✅ wcześniej |
| Vercel produkcja | ✅ wcześniej |

## Checklista wdrożenia (Vercel + Supabase)

### Supabase

- [ ] Projekt utworzony, region blisko Polski
- [ ] Migracje uruchomione:
  - `supabase/migrations/20260719150000_stage2_core.sql`
  - `supabase/migrations/20260719180000_stage5_receipts.sql`
- [ ] Auth: e-mail + hasło włączone
- [ ] Storage bucket `receipts` (prywatny) — z migracji Etapu 5
- [ ] RLS: tylko członkowie gospodarstwa widzą swoje dane

### Vercel — zmienne środowiskowe

| Zmienna | Wymagana | Opis |
|---------|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | tak | URL projektu Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tak | Klucz anon (publiczny) |
| `GEMINI_API_KEY` | dla paragonów | Klucz Google AI Studio |
| `GEMINI_OCR_MODEL` | opcjonalnie | Domyślnie `gemini-2.5-flash-lite` |

**Po każdej zmianie zmiennych:** Redeploy na Vercel.

**Nigdy nie dodawaj:** `SUPABASE_SERVICE_ROLE_KEY` do Vercel (chyba że osobny backend).

### Test po wdrożeniu

1. Rejestracja dwóch kont (Paweł, Milena)
2. Zaproszenie kodem → oboje widzą te same transakcje
3. Dodanie wydatku → widoczny na Pulpicie i w Transakcjach
4. Paragon → weryfikacja → transakcja
5. Więcej → Backup JSON — plik się pobiera
6. Więcej → Transakcje CSV — otwiera się w Excelu
7. Safari → Dodaj do ekranu początkowego
8. `/pomoc` — instrukcja się wyświetla

### Backup — zalecenia

- **Co miesiąc:** eksport JSON z Więcej
- **Supabase:** w panelu projektu → Database → Backups (plan Free: ograniczone; rozważ eksport JSON jako główny backup użytkownika)
- **Zdjęcia paragonów:** tylko w Storage — nie w JSON; przy pełnym backupie rozważ osobne pobranie z Supabase Storage

### Limity Gemini (paragony)

- Darmowy tier ma limity RPM/TPM/dziennie
- Przy 429: Tesseract wypełnia pola lokalnie; użytkownik weryfikuje ręcznie
- Logi błędów: Vercel → Functions → `/api/receipts/ocr`

## Pliki Etapu 7

- `src/lib/data/export.ts` — serializacja JSON/CSV
- `src/lib/data/export-client.ts` — pobieranie z UI
- `src/app/api/export/route.ts` — endpoint serwerowy
- `src/app/(app)/pomoc/page.tsx` — instrukcja w aplikacji
- `docs/INSTRUKCJA_UZYTKOWNIKA.md` — pełna instrukcja

## Co poza zakresem MVP

- Import danych z pliku
- Usuwanie konta / GDPR erase
- Powiadomienia push
- Pełny offline
- Fine-tuning OCR na własnych paragonach
