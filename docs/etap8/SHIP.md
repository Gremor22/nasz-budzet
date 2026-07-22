# Etap 8 — wdrożenie „żeby działało”

## Co jest w repo

1. **Migracja SQL:** `supabase/migrations/20260722210000_etap8_data_integrity.sql`
2. **Klient:**
   - `sync_income_source_transactions` przy `refresh` (horizon = ustawienia prognozy)
   - `complete_simple_setup` RPC
   - `reset_household_budget` RPC
   - fallback legacy sync, jeśli RPC jeszcze nie ma na serwerze

## Co musisz zrobić na produkcji (SQL Editor)

1. (Opcjonalnie) preflight: `docs/etap8/01_preflight.sql` — zapisz wyniki.
2. **Uruchom raz** całą treść:
   `supabase/migrations/20260722210000_etap8_data_integrity.sql`
3. Postflight: `docs/etap8/05_postflight.sql`
4. Deploy aplikacji (Vercel) z tymi zmianami klienta.

Bez kroku 2 aplikacja działa na fallbacku sync (stary sposób) — RPC setup/reset wymagają migracji.

## Onboarding

`create_household` / `accept_invitation` z `p_person_key` nadal claimują w tej samej txn.
`set_my_person_key` → `claim_my_person_key` (tylko gdy NULL).
