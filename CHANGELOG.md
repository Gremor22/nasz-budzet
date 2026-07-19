# Changelog — Nasz Budżet

Wszystkie istotne zmiany w projekcie zapisujemy tutaj po każdym etapie.

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
