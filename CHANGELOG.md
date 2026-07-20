# Changelog — Nasz Budżet

Wszystkie istotne zmiany w projekcie zapisujemy tutaj po każdym etapie.

---

## 2026-07-20 — Etap 7: stabilizacja

### Zakres

- Eksport pełnego backupu JSON (`GET /api/export?format=json`)
- Eksport transakcji CSV (Excel, UTF-8 z BOM)
- UI eksportu w Więcej + instrukcja w aplikacji (`/pomoc`)
- Dokumentacja: `docs/ETAP_7_STABILIZACJA.md`, `docs/INSTRUKCJA_UZYTKOWNIKA.md`

### Zmiany bazy

- Brak

### Znane ograniczenia

- Brak importu z pliku
- Zdjęcia paragonów nie wchodzą do eksportu JSON
- Brak usuwania konta z poziomu aplikacji

---

## 2026-07-19 — Paragony V1: Gemini 2.5 Flash + JSON Schema

### Zakres

- Domyślny OCR: Gemini 2.5 Flash przez `/api/receipts/ocr` ze structured output
- Usunięty Tesseract ze ścieżki produktu
- Obowiązkowa weryfikacja przed zapisem transakcji
- Cele jakości i plan testów 30–50 paragonów w `docs/ETAP_5_OCR.md`

### Zmiany bazy

- Brak

---

## 2026-07-19 — Cele CRUD + Etap 5: paragony

### Zakres

- Pełne zarządzanie celami (nazwa, kwoty, rezerwacja, właściciel, termin)
- Paragony: upload do prywatnego Storage, OCR (manual / opcjonalnie OpenAI), ekran weryfikacji, zapis wydatku dopiero po potwierdzeniu
- Reguły kategorii + zapamiętywanie po poprawce
- Porównanie dostawców OCR w `docs/ETAP_5_OCR.md`

### Zmiany bazy

- Migracja: `supabase/migrations/20260719180000_stage5_receipts.sql`
  (`receipts`, `receipt_items`, `classification_rules`, bucket `receipts`, `transactions.receipt_id`)

### Znane ograniczenia

- Bez klucza OpenAI OCR jest trybem ręcznym (zdjęcie + formularz)
- Pozycje paragonu są zapisane; w saldzie liczy się suma paragonu jako jedna transakcja

---

## 2026-07-19 — Etap 4: analityka

### Zakres

- Ekran Analityka z okresami, sumami, kategoriami, osobami
- Wykres kołowy (Recharts) + lista z procentami
- Porównanie z poprzednim okresem
- Testy agregacji (5)

### Zmiany bazy

- Brak

### Znane ograniczenia

- Brak zarządzania hierarchią kategorii i limitów
- Brak sprzedawców (pole nie istnieje jeszcze w modelu transakcji)

---

## 2026-07-19 — Etap 3: zarządzanie budżetem (konta, dochody, rachunki)

### Zakres

- CRUD kont, źródeł dochodu i rachunków cyklicznych (Supabase + UI)
- Przełącznik „zarezerwowane” na celach
- Wybór konta przy dodawaniu transakcji
- Testy: anulowany / zarezerwowany rachunek

### Zmiany bazy

- Brak nowej migracji (tabele Etapu 2)

### Znane ograniczenia

- Brak pełnej edycji historii transakcji
- Analityka / kategorie hierarchiczne — Etap 4

---

## 2026-07-19 — Mini-PWA (przed Etapem 3)

### Zakres

- Manifest, ikony, metadane iOS, standalone
- Safe-area dolnej nawigacji
- Podpowiedź „Dodaj do ekranu początkowego” (Safari iPhone)
- Prosty komunikat offline (bez pełnego cache)

### Nowe funkcje

- Instalacja na Spring Boardzie jako „Nasz Budżet” / „Budżet”
- `docs/ETAP_PWA_MINI.md` — instrukcja dla użytkowników

### Zmiany bazy

- Brak

### Znane ograniczenia

- Brak push i pełnego offline
- Podpowiedź instalacji tylko w Safari na iOS

---

## 2026-07-19 — Wdrożenie testowe Vercel

### Zakres

- Publikacja `Gremor22/nasz-budzet` na Vercel (Hobby)
- Zmienne: tylko `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (bez service_role)
- Site URL / Redirect URLs w Supabase pod `https://nasz-budzet.vercel.app`
- Test rejestracji i logowania na iPhonie — potwierdzony przez użytkownika

### Znane ograniczenia

- To wersja testowa (nie pełne PWA / nie Etap 3)
- Adres: https://nasz-budzet.vercel.app

---

## 2026-07-19 — Etap 2: Supabase Auth + RLS (kod)

### Zakres

- Migracja SQL z RLS na wszystkich tabelach aplikacji
- Logowanie, rejestracja, onboarding gospodarstwa, zaproszenia
- Repozytorium Supabase (anon key + sesja; bez service_role w kliencie)

### Nowe funkcje

- Ekrany `/logowanie`, `/rejestracja`, `/onboarding`
- RPC: `create_household`, `create_invitation`, `accept_invitation`
- Wspólne dane po zalogowaniu; seed fikcyjnych danych demo
- Middleware chroniący trasy gdy skonfigurowano `.env.local`

### Zmiany bazy

- Plik: `supabase/migrations/20260719150000_stage2_core.sql`
- Tabele: profiles, households, household_members, household_invitations, accounts, categories, income_sources, recurring_bills, transactions, savings_goals, audit_logs
- RLS + FORCE RLS na każdej z powyższych

### Znane ograniczenia

- Migrację trzeba wkleić ręcznie w SQL Editor (jeszcze nie uruchomiona automatycznie)
- Bez `.env.local` aplikacja nie połączy się z Supabase
- Confirm email warto wyłączyć na czas testów
- Brak automatycznych testów E2E Auth (Playwright w późniejszym etapie)

---

## 2026-07-19 — Przygotowanie Etapu 2 (tylko plan)

### Zakres

- Plan Etapu 2 bez tworzenia bazy i bez kodu Auth
- Instrukcja założenia konta Supabase

### Dokumentacja

- `docs/ETAP_2_PLAN.md` — cel, schemat tabel, RLS, kryteria ukończenia
- `docs/SUPABASE_KONTO.md` — krok po kroku: konto i pusty projekt

### Zmiany bazy

- **Brak** (celowo — czeka na akceptację planu)

### Znane ograniczenia

- Brak implementacji logowania do czasu akceptacji

---

## 2026-07-19 — Etap 1: lokalny prototyp

### Zakres

- Prototyp Next.js bez backendu
- Logika prognozy + UI mobilny + dane demo w localStorage

### Nowe funkcje

- Ekrany: Pulpit, Transakcje, Dodaj, Prognoza, Więcej
- Tryby prognozy; realistyczny używa kwoty bezpiecznej dla oczekiwanych wpływów
- Karta kolejnego pewnego wpływu (data, dni, saldo przed/po)
- Bufor bezpieczeństwa (konfigurowalny; demo = 0 zł)
- Rozróżnienie: saldo / zarezerwowane / bezpiecznie do wydania / niepotwierdzone wpływy
- Reset danych demonstracyjnych

### Testy

- Vitest: 14 testów (m.in. wpływ przed rachunkiem, 5 tygodniówek, safe < typical)

### Zmiany bazy

- Brak (localStorage)

### Znane ograniczenia

- Brak logowania i synchronizacji
- Data „dziś” w demo ustalona na 2026-07-19
- Uproszczone kategorie i brak pełnej listy ekranów docelowych
- shadcn/ui jeszcze niepodłączony (prosty Tailwind)

---

## 2026-07-19 — Etap 0: analiza i przygotowanie

### Zakres

- Analiza wymagań aplikacji budżetu domowego dla Pawła i Mileny
- Przygotowanie dokumentacji bez kodu aplikacji

### Nowe funkcje

- Brak funkcji aplikacyjnych (celowo)

### Dokumentacja

- `docs/ETAP_0_PLAN.md`, `docs/DECYZJE.md`, `docs/KONTA_I_USLUGI.md`
- `PROJECT_STATUS.md`, `CHANGELOG.md`, `README.md`

### Zmiany bazy

- Brak (schemat tylko opisany w planie)

### Aktualizacja decyzji (tego samego dnia)

- Zatwierdzono decyzje użytkownika → `docs/DECYZJE.md`
- Doprecyzowano tryb realistyczny: oczekiwane wpływy = kwota bezpieczna
- Horyzont pulpitu: 14 dni + podgląd kolejnego pewnego wpływu

### Znane ograniczenia

- Brak działającej aplikacji (przed Etapem 1)
- Model danych jeszcze nie wdrożony w Supabase
