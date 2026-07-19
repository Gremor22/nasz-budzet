# Status projektu — Nasz Budżet

**Ostatnia aktualizacja:** 19 lipca 2026  
**Obecny etap:** Etap 5 — paragony (Gemini 2.5 Flash + weryfikacja)  

## Funkcje działające

- Etapy 1–4 + PWA + Vercel
- **Cele:** CRUD
- **Paragony V1:** zdjęcie → Gemini (JSON Schema) → weryfikacja → wydatek
- Bez Tesseract / Cloud Vision na start

## OCR — Twoja czynność

1. `GEMINI_API_KEY` na Vercel + Redeploy  
2. Model: `gemini-2.5-flash` (domyślnie)  
3. Test 30–50 paragonów wg `docs/ETAP_5_OCR.md`

## Test Etapu 5

1. Dodaj → Zeskanuj paragon (aparat lub galeria)  
2. Sprawdź sklep / datę / sumę  
3. Potwierdź → Transakcje  
