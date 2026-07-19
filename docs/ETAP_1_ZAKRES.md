# Zakres Etapu 1 — lokalny prototyp

Mały prototyp w przeglądarce. **Bez** Supabase, logowania, OCR, PWA, Vercel.

## Ekrany

| Ekran | Ścieżka | Co robi |
|-------|---------|---------|
| Pulpit | `/` | Bezpiecznie do wydania, saldo, rezerwacje, niepotwierdzone wpływy, kolejny pewny wpływ, najniższe saldo, zdarzenia |
| Transakcje | `/transakcje` | Lista transakcji + podgląd źródeł dochodu |
| Dodaj | `/dodaj` | Ręczny wydatek / wpływ |
| Prognoza | `/prognoza` | Oś zdarzeń, horyzont 7/14/30/90 |
| Więcej | `/wiecej` | Bufor, horyzont, cele, reset demo |

## Funkcje logiki

- Kwoty w groszach
- Tryby: ostrożny / realistyczny / pełna prognoza
- Realistyczny: oczekiwane wpływy = **kwota bezpieczna**
- Bufor bezpieczeństwa
- Cele: tylko zarezerwowane obniżają bezpieczną kwotę
- Dane w `localStorage` przez warstwę `BudgetRepository`
- Dane wyłącznie demonstracyjne (fikcyjne)

## Testy (Vitest)

- wpływ przed dużym rachunkiem
- 5 tygodniowych wpływów w miesiącu
- kwota bezpieczna < typowa
- rezerwacje, bufor, grosze, ostatni dzień roboczy
