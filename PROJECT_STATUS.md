# Status projektu — Nasz Budżet

**Ostatnia aktualizacja:** 19 lipca 2026  
**Obecny etap:** Etap 2 + wdrożenie testowe Vercel (**OK na iPhonie**)  
**URL testowy:** https://nasz-budzet.vercel.app  
**Repozytorium:** https://github.com/Gremor22/nasz-budzet

---

## Funkcje działające

- Prognoza, UI mobilny, testy Vitest
- Rejestracja / logowanie / wylogowanie (Supabase Auth)
- Gospodarstwo + zaproszenia kodem + RLS
- Wspólne dane na dwóch kontach / przeglądarkach
- Wdrożenie testowe Vercel (bez service_role)
- Dostęp z iPhone (Safari) bez lokalnego `npm run dev`

## Funkcje niedziałające / później

- Etap 3: pełniejszy budżet (konta, cykle, ostrzeżenia)
- Etap 4: kategorie i analityka
- Etap 5: paragony / OCR
- Etap 6: PWA (dodaj do ekranu początkowego)
- Etap 7: stabilizacja produkcyjna

## Uruchomienie lokalne

```bash
cd ~/Desktop/BudgetPlanner
cp .env.example .env.local   # jeśli jeszcze nie ma
npm install
npm run dev
```

## Zmienne środowiskowe

Lokalnie (`.env.local`) i na Vercel (Environment Variables):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

**Nie** używaj `service_role` w przeglądarce ani w Git.
