# Status projektu — Budżet Domowy (BudgetPlanner)

**Ostatnia aktualizacja:** 19 lipca 2026  
**Obecny etap:** Etap 0 zakończony (decyzje zatwierdzone) → start Etapu 1

---

## Funkcje działające

- Dokumentacja planu (wizja, architektura, model danych, ekrany, algorytm, koszty, ryzyka)
- Repozytorium Git zainicjowane lokalnie (jeszcze bez commitów / bez kodu aplikacji)

## Funkcje niedziałające

- Cała aplikacja (nie rozpoczęta — zgodnie z planem etapowym)
- Baza danych Supabase
- Logowanie
- Prognoza
- PWA / wdrożenie

## Kolejne planowane zadanie

**Etap 1 — lokalny prototyp bez kont**  
(tylko po poleceniu użytkownika: „Start Etap 1”)

Zakres Etapu 1:
- projekt Next.js + TypeScript + Tailwind
- interfejs mobilny (pulpit, dodawanie, prognoza)
- dane lokalne (bez Supabase)
- testy logiki prognozy (Vitest)

## Instrukcja uruchomienia

Na razie nie ma aplikacji do uruchomienia.

Po Etapie 1 pojawi się coś w stylu:

```bash
cd ~/Desktop/BudgetPlanner
npm install
npm run dev
```

Potem otwarcie w przeglądarce adresu podanego w terminalu (zwykle `http://localhost:3000`).

## Zmienne środowiskowe

Na Etapie 0 / 1: **brak** (prototyp lokalny).

Od Etapu 2 (przykład — jeszcze nie wymagane):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # tylko na serwerze, nigdy w przeglądarce
```

Sekrety nie trafiają do Git.

## Ważne pliki dokumentacji

| Plik | Zawartość |
|------|-----------|
| `docs/ETAP_0_PLAN.md` | Pełny plan Etapu 0 |
| `docs/KONTA_I_USLUGI.md` | Jak założyć GitHub, Supabase, Vercel |
| `CHANGELOG.md` | Rejestr zmian |
| `PROJECT_STATUS.md` | Ten plik |
