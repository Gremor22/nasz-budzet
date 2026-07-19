# Status projektu — Nasz Budżet

**Ostatnia aktualizacja:** 19 lipca 2026  
**Obecny etap:** Etap 5 — paragony / OCR (wymaga migracji SQL)  
**URL testowy:** https://nasz-budzet.vercel.app  
**Repozytorium:** https://github.com/Gremor22/nasz-budzet

---

## Funkcje działające

- Etapy 1–4 + PWA + Vercel
- **Cele:** pełne dodawanie / edycja / usuwanie (Więcej → Cele)
- **Paragony:** zdjęcie → Storage → OCR (manual lub OpenAI) → weryfikacja → wydatek
- Reguły kategorii (domyślne + uczenie z poprawek)

## Twoja czynność teraz

1. Wklej w Supabase SQL Editor plik  
   `supabase/migrations/20260719180000_stage5_receipts.sql`
2. (Opcjonalnie) na Vercel dodaj `OCR_PROVIDER=openai` + `OPENAI_API_KEY`

## Test Etapu 5

1. Dodaj → Zeskanuj paragon  
2. Wybierz zdjęcie → popraw pola → Potwierdź  
3. Sprawdź Transakcje  

Szczegóły: `docs/ETAP_5_OCR.md`
