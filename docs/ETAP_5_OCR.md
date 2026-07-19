# Etap 5 — Paragony / OCR (V1)

**Status:** Gemini 2.5 Flash + JSON Schema + obowiązkowa weryfikacja  
**Data:** 19 lipca 2026

## Architektura V1 (zatwierdzona)

```
Zdjęcie → Storage (Supabase)
       → Vercel API Route `/api/receipts/ocr`
       → Gemini 2.5 Flash (structured JSON Schema)
       → Ekran zatwierdzenia (użytkownik poprawia)
       → Dopiero wtedy zapis transakcji w Supabase
```

**Świadomie poza V1:** Tesseract, Google Cloud Vision, Azure.

## Cele jakości (pierwsza wersja)

Po teście **30–50 prawdziwych paragonów**:

| Pole | Cel |
|------|-----|
| Sklep | ≥ 95% |
| Data | ≥ 95% |
| Suma | ≥ 98% |
| Pozycje | na tyle dobre, by max kilka prostych korekt |

## Zestaw testowy (propozycja)

- Lidl, Biedronka, Żabka, Rossmann  
- Restauracja, stacja benzynowa  
- Paragon wyblakły  
- Paragon z dużą liczbą rabatów  
- (opcjonalnie) Glovo / kod odbioru na sumie  

## Konfiguracja Vercel

```
GEMINI_API_KEY=...          # z https://aistudio.google.com/apikey
GEMINI_OCR_MODEL=gemini-2.5-flash   # domyślne
OCR_PROVIDER=gemini
```

**Bez** `NEXT_PUBLIC_` — klucz tylko na serwerze.

Po zmianie zmiennych: **Redeploy**.

## Limit free tier (429)

Przy błędzie limitu aplikacja pokazuje zdjęcie + pusty formularz (ręczne uzupełnienie).  
Nie ma auto-Tesseract. Po chwili: „Popraw odczyt sumy” (fokus na dół paragonu).

## UI

- Aparat + galeria (dwa przyciski)  
- Weryfikacja obowiązkowa przed zapisem  
- Przycisk ponownego odczytu sumy (crop dolnej strefy → Gemini)
