# Status projektu — Nasz Budżet

**Ostatnia aktualizacja:** 20 lipca 2026  
**Obecny etap:** Etap 7 — stabilizacja (eksport, instrukcja, produkcja)  

## Funkcje działające

- Etapy 1–5: budżet, auth, prognoza, analityka, paragony (Tesseract + Gemini)
- PWA mini: manifest, instalacja na iPhone, banner offline
- Vercel produkcja: https://nasz-budzet.vercel.app
- **Etap 7:** eksport JSON/CSV, instrukcja `/pomoc`, dokumentacja wdrożenia

## Eksport i backup

1. **Więcej → Backup JSON** — pełna kopia budżetu  
2. **Więcej → Transakcje CSV** — do Excela  
3. Szczegóły: `docs/ETAP_7_STABILIZACJA.md`, `docs/INSTRUKCJA_UZYTKOWNIKA.md`

## OCR — przypomnienie

1. `GEMINI_API_KEY` na Vercel + Redeploy  
2. Przy limicie 429: Tesseract wypełnia pola lokalnie  
3. Testy jakości: `docs/ETAP_5_OCR.md`

## Test Etapu 7

1. Więcej → Backup JSON — plik się pobiera  
2. Więcej → Transakcje CSV — otwiera się w Excelu  
3. Więcej → Instrukcja — przewodnik po aplikacji  
4. Safari → Dodaj do ekranu początkowego  
