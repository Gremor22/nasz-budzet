# Etap 5 — Paragony i OCR

**Status:** wdrożony w kodzie (wymaga migracji SQL w Supabase)  
**Data:** 19 lipca 2026

## Cel

Zdjęcie paragonu → prywatny Storage → opcjonalny OCR (serwer) → **weryfikacja przez użytkownika** → dopiero wtedy wydatek w budżecie.

## Porównanie OCR (przed wyborem)

| Dostawca | Koszt orientacyjny | Paragony PL | Uwagi |
|----------|-------------------|-------------|--------|
| **Manual + reguły** | **0 zł** | — | Zawsze możesz uzupełnić ręcznie |
| **Tesseract w telefonie** | **0 zł** | Średnia | Działa bez konta; słabsze przy zmiętych / zasłoniętych |
| **Google Gemini Flash** | **0 zł w limicie free** | Bardzo dobra | Klucz z AI Studio; zalecane |
| **OpenAI Vision** | ok. 0,01–0,03 zł / zdjęcie | Bardzo dobra | Płatne |
| Google Cloud Vision | ~1,50 USD / 1000 | Dobra | Billing GCP |

### Decyzja MVP

1. **Galeria + aparat** — dwa przyciski (iPhone nie łączy ich w jednym polu).
2. Domyślnie: **Gemini** (jeśli `GEMINI_API_KEY` na Vercel) → inaczej **Tesseract** w telefonie.
3. Zawsze weryfikacja przed zapisem wydatku.
4. Heurystyki: ignoruj kody typu „727”, sumuj pozycje gdy SUMA zasłonięta.

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
