# Status projektu — Nasz Budżet

**Ostatnia aktualizacja:** 19 lipca 2026  
**Obecny etap:** Etap 1 zakończony · **przygotowanie Etapu 2 (plan — bez bazy)**

---

## Funkcje działające

- Aplikacja Next.js „Nasz Budżet” (UI po polsku)
- Pulpit, transakcje, dodawanie, prognoza, więcej
- Silnik prognozy (tryby ostrożny / realistyczny / pełna)
- Realistyczny: oczekiwane wpływy = kwota bezpieczna
- Bufor bezpieczeństwa (demo = 0 zł)
- Dane demonstracyjne w localStorage (warstwa `BudgetRepository`)
- 14 testów Vitest logiki prognozy
- Etap 1 przetestowany ręcznie przez użytkownika

## Funkcje niedziałające

- Logowanie / Supabase (plan gotowy, implementacja nie rozpoczęta)
- Zaproszenia do gospodarstwa
- OCR / paragony
- PWA / wdrożenie Vercel

## Kolejne planowane zadanie

Po akceptacji planu: **Etap 2 — Supabase i logowanie**  
Dokumenty: `docs/ETAP_2_PLAN.md`, `docs/SUPABASE_KONTO.md`

## Instrukcja uruchomienia

```bash
cd ~/Desktop/BudgetPlanner
npm install
npm run dev
```

Otwórz http://localhost:3000 (lub adres z terminala).

```bash
npm test
npm run build
```

## Zmienne środowiskowe

Etap 1: brak.  
Etap 2 (później): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` w `.env.local` (nie w Git).
