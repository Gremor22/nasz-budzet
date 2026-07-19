# Status projektu — Nasz Budżet

**Ostatnia aktualizacja:** 19 lipca 2026  
**Obecny etap:** Etap 1 — lokalny prototyp (**zakończony**)

---

## Funkcje działające

- Aplikacja Next.js „Nasz Budżet” (UI po polsku)
- Pulpit, transakcje, dodawanie, prognoza, więcej
- Silnik prognozy (tryby ostrożny / realistyczny / pełna)
- Realistyczny: oczekiwane wpływy = kwota bezpieczna
- Bufor bezpieczeństwa (demo = 0 zł)
- Dane demonstracyjne w localStorage (warstwa `BudgetRepository`)
- 14 testów Vitest logiki prognozy

## Funkcje niedziałające

- Logowanie / Supabase
- Zaproszenia do gospodarstwa
- OCR / paragony
- PWA / wdrożenie Vercel
- Pełna analityka i zarządzanie kategoriami

## Kolejne planowane zadanie

**Etap 2 — Supabase i logowanie** (po poleceniu użytkownika)

## Instrukcja uruchomienia

```bash
cd ~/Desktop/BudgetPlanner
npm install
npm run dev
```

Otwórz w przeglądarce adres z terminala (zwykle http://localhost:3000).

Testy: `npm test`  
Build: `npm run build`

## Zmienne środowiskowe

Etap 1: **brak** (prototyp lokalny).

## Dokumentacja

| Plik | Zawartość |
|------|-----------|
| `docs/ETAP_0_PLAN.md` | Plan |
| `docs/DECYZJE.md` | Zatwierdzone decyzje |
| `docs/ETAP_1_ZAKRES.md` | Zakres Etapu 1 |
| `CHANGELOG.md` | Rejestr zmian |
