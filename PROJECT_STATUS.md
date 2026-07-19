# Status projektu — Nasz Budżet

**Ostatnia aktualizacja:** 19 lipca 2026  
**Obecny etap:** Etap 2 — Supabase i logowanie (**kod gotowy; czekamy na wklejenie migracji + .env.local**)

---

## Funkcje działające (lokalnie / po konfiguracji)

- Etap 1: prognoza, UI, testy
- Etap 2 (po migracji + kluczach):
  - rejestracja / logowanie / wylogowanie
  - utworzenie gospodarstwa / dołączenie kodem
  - wspólne dane przez Supabase + RLS
  - zaproszenia, seed danych demo (fikcyjnych)

## Funkcje niedziałające

- OCR / paragony
- PWA / Vercel
- Pełna analityka

## Co musisz zrobić Ty

1. Wkleić SQL z `supabase/migrations/20260719150000_stage2_core.sql` w SQL Editor
2. Wyłączyć Confirm email (na czas testów)
3. Skopiować `.env.example` → `.env.local` i uzupełnić URL + **anon** key
4. `npm run dev` i przetestować dwa konta

## Instrukcja uruchomienia

```bash
cd ~/Desktop/BudgetPlanner
cp .env.example .env.local   # uzupełnij klucze
npm install
npm run dev
```

## Zmienne środowiskowe

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

**Nie** dodawaj `service_role` do przeglądarki ani do Gita.
