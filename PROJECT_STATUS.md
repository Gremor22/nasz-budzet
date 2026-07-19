# Status projektu — Nasz Budżet

**Ostatnia aktualizacja:** 19 lipca 2026  
**Obecny etap:** Mini-PWA (przed Etapem 3)  
**URL testowy:** https://nasz-budzet.vercel.app  
**Repozytorium:** https://github.com/Gremor22/nasz-budzet

---

## Funkcje działające

- Prognoza, UI mobilny, testy Vitest
- Rejestracja / logowanie / gospodarstwo (Supabase + RLS)
- Wdrożenie testowe Vercel
- **PWA:** manifest, ikony, standalone, podpowiedź instalacji iOS, komunikat offline

## Funkcje niedziałające / później

- Etap 3: pełniejszy budżet
- Etap 4–5: analityka, paragony
- Pełne PWA offline / push (Etap 6 rozszerzony)

## Uruchomienie lokalne

```bash
cd ~/Desktop/BudgetPlanner
npm install
npm run dev
```

## Zmienne środowiskowe

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Bez `service_role` w przeglądarce.
