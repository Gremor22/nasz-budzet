# Etap 5 — Paragony i OCR

**Status:** wdrożony w kodzie (wymaga migracji SQL w Supabase)  
**Data:** 19 lipca 2026

## Cel

Zdjęcie paragonu → prywatny Storage → opcjonalny OCR (serwer) → **weryfikacja przez użytkownika** → dopiero wtedy wydatek w budżecie.

## Porównanie OCR (przed wyborem)

| Dostawca | Koszt orientacyjny | Paragony PL | Uwagi |
|----------|-------------------|-------------|--------|
| **Manual + reguły** (domyślne) | **0 zł** | — | Zawsze możesz uzupełnić ręcznie; zdjęcie zapisane |
| **OpenAI Vision** (`gpt-4o-mini`) | ok. 0,01–0,03 zł / zdjęcie | Bardzo dobra struktura JSON | Wymaga `OPENAI_API_KEY` tylko na serwerze |
| Google Cloud Vision | ~1,50 USD / 1000 obrazów | Dobra | Konto GCP + billing |
| Azure Document Intelligence | ~1,50 USD / 1000 stron | Dobra na dokumenty | Konto Azure |
| Tesseract (lokalnie) | 0 zł | Słabe na termiczne PL | Ciężkie na Vercel |

### Decyzja MVP

1. Domyślnie `OCR_PROVIDER=manual` — **0 zł**, weryfikacja ręczna na podstawie zdjęcia.
2. Opcjonalnie `OCR_PROVIDER=openai` + `OPENAI_API_KEY` na Vercel (nie w przeglądarce).
3. Interfejs `runOcr()` — łatwa zamiana dostawcy bez przepisywania UI.
4. **Nigdy** nie zapisujemy transakcji bez potwierdzenia na ekranie weryfikacji.

## Co wdrożyć w Supabase

1. Wklej SQL: `supabase/migrations/20260719180000_stage5_receipts.sql`
2. Sprawdź Storage → bucket `receipts` (prywatny, limit 5 MB)

## Zmienne środowiskowe (opcjonalne OCR)

W Vercel / `.env.local` (tylko serwer — **bez** `NEXT_PUBLIC_`):

```
OCR_PROVIDER=manual
# albo:
# OCR_PROVIDER=openai
# OPENAI_API_KEY=sk-...
# OPENAI_OCR_MODEL=gpt-4o-mini
```

## Test ręczny

1. Zaloguj się → Dodaj → Zeskanuj paragon  
2. Zrób / wybierz zdjęcie  
3. Popraw pola na ekranie weryfikacji  
4. Potwierdź → wydatek pojawia się w Transakcjach  
5. (Opcjonalnie) włącz OpenAI i sprawdź, że propozycje się wypełniają  

## Świadomie poza tym slice

- Push notifications  
- Pełny podział jednej transakcji na wiele kategorii w saldzie (pozycje są zapisane; saldo = suma paragonu)  
- Google / Azure jako osobne providery (można dodać później w `ocr.ts`)
