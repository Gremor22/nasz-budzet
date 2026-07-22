# Etap 8 — plan (poprawiony, wariant B)

**Status:** gotowe do wdrożenia produkcyjnego po Twoim osobnym poleceniu.  
Instrukcja: [`DEPLOY_PRODUCTION.md`](DEPLOY_PRODUCTION.md).  
**Zakaz do hasła:** `uruchom preflight` / `uruchom migrację`. Bez commita / zmian klienta / `supabase/migrations/`.

Skrypt stacku testowego (opcjonalny): `apply_test_stack.sh`.

## Pliki (pełna treść na dysku)

| Plik | Opis |
|------|------|
| `01_preflight.sql` | **Tylko SELECT** — zero DDL/DML. Fingerprint z kwotą typical/safe. Raport duplikatów `person_key`. |
| `02_migration.sql` | Schema + dedupe + RPC (wariant B) + claim + sync horizon. |
| `03_rollback_restore.sql` | Restore dedupe + rollback schematu + restore pre-etap8 funkcji. |
| `05_postflight.sql` | SELECT po migracji: indeksy, sygnatury, luki auto+manual. |
| `definitions_before_etap8.sql` | Exact `create_invitation` / `remove_household_member` / `create_household` / `accept_invitation` / `set_my_person_key` sprzed Etapu 8. |
| `ONBOARDING_FLOW.md` | Owner + partner: create/accept → claim → setup. |
| `etap8.concurrency.integration.test.ts` | JWT: sync×2, setup, spoofing, manual, claim, horizon, kick. |
| `etap8_list_occurrences.test.sql` | Unit: July empty + cross-month Aug window. |
| `apply_test_stack.sh` | Pełny stack na teście: migrations → etap8 → unit SQL → postflight. |

## Onboarding / person_key (pkt 1)

Membership startuje z `person_key = NULL`.  
`claim_my_person_key(hh, key[, opening_balance])` zajmuje slot (własny wiersz, tylko gdy NULL).  
`create_household` / `accept_invitation` nie auto-assignują; opcjonalny `p_person_key` → claim w tej samej txn.  
`complete_simple_setup` wymaga już zajętego membership. Szczegóły: `ONBOARDING_FLOW.md`.

## Reguła statusu (pkt 5)

| Zdarzenie | Status |
|-----------|--------|
| INSERT nowego auto-occurrence | zawsze **`planned`** |
| UPSERT gdy **`sync_locked`** | status **bez zmian** |
| UPSERT gdy istniejący **`paid`** (i nie locked) | zostaje **`paid`** |
| UPSERT gdy istniejący inny | **`planned`** |
| `occurrence_key <= p_as_of` | **nie** powoduje `paid` |

Generator nie wie, czy pensja wpłynęła. `paid` = decyzja użytkownika. Sync utrzymuje plan i chroni istniejące `paid` oraz `sync_locked`.

## Manual blocks auto (pkt 2)

Przed INSERT auto dla occurrence `v_occ`: jeśli istnieje **ręczny** wpływ (`is_auto_generated = false`, ten sam `income_source_id` + `txn_date`) → **CONTINUE** (nie twórz nowego auto).  
Istniejący auto na tę datę nadal może być potwierdzony przez ON CONFLICT (manual blokuje tylko **nowy** auto).

## Occurrence + horizon (pkt 3–4)

Okno bazowe: `[month(budget_started\|as_of), …]`.

```
sync_income_source_transactions(hh, as_of, p_horizon_days, p_window_end)
```

`v_window_end` = `COALESCE(p_window_end, as_of+horizon, EOM(as_of))`, potem `LEAST(..., as_of+365)`.  
Default bez horizon = koniec miesiąca `as_of` (backward compatible).  
Horizon np. 40 dni z `as_of=2026-07-28` obejmuje sierpień — auto sierpniowe **nie** jest kasowane.

Per źródło:

`v_start = max(window_start, source.created_at::date, next_occurrence_date)`  
`v_end = min(window_end, coalesce(end_date, ∞))`

Generacja **tylko do przodu** od `v_start` — bez cofania weekly / biweekly / LBD.

| frequency | zachowanie |
|-----------|------------|
| `irregular` | `[]` — bez auto |
| `once` | tylko `next_occurrence_date` w `[v_start, v_end]` |
| `monthly` / `monthly_on_day` | miesiące od `date_trunc(month, v_start)`, tylko `occ >= v_start` |
| `weekly` / `biweekly` | kursor = `next_occurrence`, kroki tylko do przodu |
| `last_business_day` | pierwszy LBD `>= v_start`, potem miesiące do przodu |

Brak historii sprzed **next_occurrence** / utworzenia źródła.  
Przykład: source created `2026-07-01`, next `2026-08-10`, okno tylko lipiec → `[]`.  
Okno lipiec–sierpień → zawiera `2026-08-10`.

## Legacy / dedupe (pkt 1–2)

Fingerprint → `is_auto_generated` + `occurrence_key` + `generated_by = income_source_sync_legacy`.  
Warunki jak wcześniej **plus** `amount_grosze IN (typical_amount_grosze, safe_amount_grosze)`.  
**Ręczny przegląd WSZYSTKICH kandydatów z preflight C** — nie tylko grup konfliktowych.  
Ambiguous → tylko raport (bez `occurrence_key`, bez auto).  
DELETE dedupe tylko przy identycznych polach istotnych; konflikty → `RAISE EXCEPTION`.  
Partial UNIQUE tylko `WHERE is_auto_generated = true` — dwa ręczne wpisy tego samego dnia/source OK.

## DELETE w sync (pkt 6)

Wymaga łącznie: `generated_by = 'income_source_sync'`, `occurrence_key > p_as_of`, auto, planned, unlocked + poza zestawem/oknem/źródłem.  
Rozszerzone okno (horizon) chroni przyszłe occurrence w zakresie.

## Setup slot (pkt 7)

Konta: `primary_pawel` / `primary_milena` (best-effort pierwsze aktywne).  
Pensja: `primary_income_pawel` / `primary_income_milena` — **tylko** gdy dokładnie jedno aktywne źródło z `note = 'simple_setup'` dla ownera. Brak / niejednoznaczność → `NULL` (bez „pierwszego aktywnego”).  
`complete_simple_setup` bierze `person_key` z **membership** (FOR UPDATE); klient nie może spoofować cudzego slotu.  
Unique `(household_id, person_key)` dla pawel/milena — abort przy duplikatach (preflight J).

## Wariant B (pkt 8)

`create_invitation`, `remove_household_member`, `reset_household_budget` — owner-only.  
Remove: nie siebie, nie ownera, nie ostatniego ownera.  
Sync + CRUD budżetu — member OK.  
Reset ustawia `budget_started_date = NULL`.

## Rollback (pkt 13) — uczciwie

Restore zarchiwizowanych duplikatów + DROP schematu Etapu 8 + restore funkcji z `definitions_before_etap8.sql` (inline w `03_rollback_restore.sql`):  
`create_invitation`, `remove_household_member`, `create_household`, `accept_invitation`, `set_my_person_key`.  
DROP `claim_my_person_key`.  
**Nie** cofa danych powstałych później przez sync/setup/reset — do tego backup zewnętrzny.

## Wdrożenie (później, po Twoim „uruchom”)

1. Preflight → ręczny przegląd **wszystkich** wierszy C + `conflict_groups_block_migration = 0` + brak duplikatów J.  
2. Backup.  
3. `02_migration.sql`.  
4. `05_postflight.sql`.  
5. Osobna akceptacja: klient → RPC, CI.

**Teraz:** czekam na akceptację — bez uruchomienia / commita.
