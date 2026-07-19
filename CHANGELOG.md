# Changelog — Budżet Domowy

Wszystkie istotne zmiany w projekcie zapisujemy tutaj po każdym etapie.

Format: data, zakres, nowe funkcje, poprawki, baza, ograniczenia.

---

## 2026-07-19 — Etap 0: analiza i przygotowanie

### Zakres

- Analiza wymagań aplikacji budżetu domowego dla Pawła i Mileny
- Przygotowanie dokumentacji bez kodu aplikacji

### Nowe funkcje

- Brak funkcji aplikacyjnych (celowo)

### Dokumentacja

- `docs/ETAP_0_PLAN.md` — wizja MVP, architektura, model danych, ekrany, algorytm prognozy, etapy, koszty, ryzyka, decyzje
- `docs/KONTA_I_USLUGI.md` — instrukcja założenia kont
- `PROJECT_STATUS.md` — status projektu
- `CHANGELOG.md` — ten rejestr
- `README.md` — krótkie wprowadzenie

### Zmiany bazy

- Brak (schemat tylko opisany w planie)

### Poprawione błędy

- Brak

### Znane ograniczenia

- Brak działającej aplikacji
- Model danych jeszcze nie wdrożony w Supabase

### Aktualizacja decyzji (tego samego dnia)

- Zatwierdzono decyzje użytkownika → `docs/DECYZJE.md`
- Doprecyzowano tryb realistyczny: oczekiwane wpływy = kwota bezpieczna
- Horyzont pulpitu: 14 dni + podgląd kolejnego pewnego wpływu
