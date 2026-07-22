# Etap 8 — instrukcja wdrożenia produkcyjnego

**Status:** gotowe do wdrożenia po Twoim osobnym poleceniu.  
**Teraz:** NIE uruchamiać. Komendy startowe tylko po:
- `uruchom preflight` albo
- `uruchom migrację`

**Zakaz:** commit, zmiany klienta, automatyczne uruchomienie SQL.

---

## 0. Wynik kontroli statycznej (2026-07-22)

### Parser (libpg-query) — wszystkie pliki OK

| Plik | Stmts | Wynik |
|------|------:|--------|
| `01_preflight.sql` | 10 | OK (SELECT) |
| `02_migration.sql` | 82 | OK (BEGIN…COMMIT; walidacja z COMMIT→ROLLBACK) |
| `03_rollback_restore.sql` | 44 | OK (BEGIN…COMMIT) |
| `05_postflight.sql` | 11 | OK (SELECT) |
| `definitions_before_etap8.sql` | 15 | OK |
| `etap8_list_occurrences.test.sql` | 5 | OK (BEGIN…ROLLBACK) |

### Spójność nazw (migracja ↔ rollback ↔ postflight)

| Obiekt | Migracja | Rollback | Uwaga |
|--------|----------|----------|--------|
| Indeksy (4) | tworzone | DROP wszystkie 4 | OK |
| CHECK (5) | ADD | DROP wszystkie 5 | OK |
| Kolumny etap8 | +4 na `transactions`, +1 `setup_slot` na accounts/income_sources | DROP | OK |
| `claim_my_person_key(uuid,text,int)` | CREATE + GRANT | DROP | OK |
| `sync_…(uuid,date,int,date)` | DROP stare 2-arg + CREATE 4-arg | DROP 2-arg i 4-arg | OK |
| `create_household` / `accept_invitation` / `set_my_person_key` | REPLACE (NULL claim flow) | DROP + restore z pre-etap8 | OK |
| `create_invitation` / `remove_household_member` | REPLACE (wariant B) | CREATE OR REPLACE pre-etap8 (bez osobnego DROP — wystarczy) | OK |
| `complete_simple_setup` / `reset_household_budget` | CREATE OR REPLACE | **DROP bez restore** | **Luka rollbacku** — po rollbacku te RPC znikają; trzeba je przywrócić z kopii sprzed Etapu 8 (backup funkcji / wcześniejszy SQL z panelu), albo zaakceptować brak do ręcznego wklejenia |

Fingerprint preflight C i UPDATE w migracji: te same warunki + `amount_grosze IN (typical, safe)`.

Partial UNIQUE: `transactions_hh_source_occurrence_uidx WHERE is_auto_generated = true` — zgodne z ON CONFLICT predicate.

---

## 1. Kolejność wdrożenia (produkcja)

### A) Backup (obowiązkowy, przed wszystkim)

W Supabase Dashboard → **Project Settings → Database**:

1. **Physical backup / PITR** — upewnij się, że masz punkt przywrócenia (Pro: PITR; Free: daily backup + ewentualnie ręczny dump).
2. Opcjonalnie lokalny dump (jeśli masz connection string `postgres`):

```bash
pg_dump "$PROD_DATABASE_URL" \
  --format=custom --no-owner --no-acl \
  -f "nasz-budzet-pre-etap8-$(date +%Y%m%d-%H%M).dump"
```

3. Zapisz osobno definicje RPC sprzed migracji (SQL Editor):

```sql
-- skopiuj wynik / definicje do pliku lokalnego
SELECT p.proname, pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_household', 'accept_invitation', 'create_invitation',
    'remove_household_member', 'set_my_person_key',
    'complete_simple_setup', 'reset_household_budget'
  );
```

### B) Preflight (tylko SELECT)

1. SQL Editor → New query.
2. Wklej **cały** `docs/etap8/01_preflight.sql`.
3. Run. **Zapisz wszystkie wyniki** (CSV / screenshot / notatka).

### C) Interpretacja preflight — GO / NO-GO

| Wynik | Decyzja |
|-------|---------|
| `cross_hh_account` / `cross_hh_income_source` — **jakikolwiek wiersz** | **NO-GO** — napraw ręcznie |
| `duplicate_conflict_manual_decision` / `conflict_groups_block_migration > 0` | **NO-GO** — rozstrzygnij ręcznie |
| `duplicate_household_person_key` — wiersze | **NO-GO** — rozstrzygnij (unikalność person_key) |
| `legacy_auto_fingerprint_candidate` (C) | **Nie wystarczy zero konfliktów** — **ręcznie przejrzyj KAŻDY wiersz C** przed GO |
| `ambiguous_income_source_link` (D) | Raport informacyjny — nie blokuje, ale świadomie zostaw |
| `duplicate_identical_safe_to_auto_dedupe` | OK — migracja zarchiwizuje/usuwa nadmiar |
| Wszystkie blokerów = 0 + przegląd C zakończony | **GO** → migracja |

### D) Migracja

1. Okno niskiego ruchu (np. wieczór).
2. SQL Editor → New query.
3. Wklej **cały** `docs/etap8/02_migration.sql` (zaczyna się `BEGIN;`, kończy `COMMIT;`).
4. Run **raz**.
5. Sukces = brak błędu + `COMMIT` przeszedł.
6. Błąd = patrz §5 (awaria). Transakcja powinna się wycofać (`BEGIN`… wyjątek → brak `COMMIT`).

### E) Postflight

1. Uruchom `docs/etap8/05_postflight.sql` **oraz** zestaw z §4 poniżej.
2. Wszystkie `ok = true`; wyniki `issue` puste (0 wierszy).

### F) Testy RPC (ręcznie w SQL Editor / aplikacji, konta testowe)

Kolejność sugerowana (nie niszcz danych produkcyjnych — użyj osobnego HH testowego w tym samym projekcie, jeśli masz):

1. `claim_my_person_key` — idempotent ten sam klucz; cudzy klucz → błąd.
2. `sync_income_source_transactions(hh)` — bez błędu.
3. `sync_income_source_transactions(hh, '2026-07-28', 40, NULL)` — horizon; sierpniowa pensja nie znika.
4. Ręczny wpływ na source+datę → sync → nadal 1 wiersz (nie auto+manual).
5. `complete_simple_setup` ze spoofowanym `p_person_key` → błąd.
6. Owner: `create_invitation`; member: nie może.
7. (Ostrożnie) kick tylko na HH testowym.

Opcjonalnie później (osobna decyzja):  
`ETAP8_INTEGRATION=1 npx vitest run docs/etap8/etap8.concurrency.integration.test.ts`

### G) Plan rollbacku

1. **Preferowany:** restore z backupu/PITR do punktu sprzed migracji (pełny stan biznesowy).
2. **Częściowy schemat:** `docs/etap8/03_rollback_restore.sql`  
   - przywraca zarchiwizowane duplikaty + cofa kolumny/indeksy/RPC Etapu 8 + restore pre-etap8 create/accept/invite/remove/set_my_person_key  
   - **NIE** przywraca `complete_simple_setup` / `reset_household_budget` — wklej z dumpa funkcji z §A.3  
   - **NIE** cofa danych powstałych później przez sync/setup po migracji
3. Po rollbacku: smoke logowania + create household + dashboard.

---

## 2. Krótki zestaw postflight (skopiuj do SQL Editor)

```sql
-- A) Brak duplikatów auto (partial unique key)
SELECT household_id, income_source_id, occurrence_key, COUNT(*) AS cnt
FROM public.transactions
WHERE is_auto_generated = true
  AND income_source_id IS NOT NULL
  AND occurrence_key IS NOT NULL
GROUP BY 1, 2, 3
HAVING COUNT(*) > 1;
-- oczekiwane: 0 wierszy

-- B) Indeksy Etapu 8
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'transactions_hh_source_occurrence_uidx',
    'household_members_hh_person_uidx',
    'accounts_hh_setup_slot_uidx',
    'income_sources_hh_setup_slot_uidx'
  )
ORDER BY 1;
-- oczekiwane: 4 wiersze

-- C) CHECK-i
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.transactions'::regclass
  AND conname IN (
    'transactions_auto_occurrence_pair_chk',
    'transactions_generated_by_chk',
    'transactions_auto_generated_pair_chk'
  )
UNION ALL
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.accounts'::regclass
  AND conname = 'accounts_setup_slot_chk'
UNION ALL
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.income_sources'::regclass
  AND conname = 'income_sources_setup_slot_chk';
-- oczekiwane: 5 nazw

-- D) Funkcje + EXECUTE dla authenticated
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'claim_my_person_key',
    'sync_income_source_transactions',
    'complete_simple_setup',
    'create_household',
    'accept_invitation',
    'create_invitation',
    'remove_household_member',
    'reset_household_budget',
    'set_my_person_key'
  )
ORDER BY 1, 2;
-- oczekiwane: auth_exec = true; sync ma 4 argumenty (uuid, date, int, date)
-- oczekiwane: BRAK overloadu sync (uuid, date) samego

-- E) Brak cross-household
SELECT 'account' AS kind, t.id
FROM public.transactions t
JOIN public.accounts a ON a.id = t.account_id
WHERE t.household_id IS DISTINCT FROM a.household_id
UNION ALL
SELECT 'income_source', t.id
FROM public.transactions t
JOIN public.income_sources s ON s.id = t.income_source_id
WHERE t.income_source_id IS NOT NULL
  AND t.household_id IS DISTINCT FROM s.household_id;
-- oczekiwane: 0 wierszy

-- F) Spójność auto / generated_by (powinno być puste przy CHECK)
SELECT id, is_auto_generated, generated_by, income_source_id, occurrence_key
FROM public.transactions
WHERE (is_auto_generated = true AND (generated_by IS NULL OR income_source_id IS NULL OR occurrence_key IS NULL))
   OR (is_auto_generated = false AND generated_by IS NOT NULL);
-- oczekiwane: 0 wierszy
```

Pełniejszy pakiet: `docs/etap8/05_postflight.sql`.

---

## 3. Instrukcja awaryjna (błąd w trakcie migracji)

Migracja jest w **jednej transakcji** (`BEGIN` … `COMMIT`).

### Jeśli Run zwróci błąd **przed** sukcesem

1. **Nie panikuj** — przy wyjątku Postgres **nie robi COMMIT**; zmiany z tej sesji powinny być wycofane.
2. W SQL Editor sprawdź:

```sql
SELECT txid_current_if_assigned(); -- zwykle NULL poza otwartą txn
-- szybki smoke: czy kolumna już istnieje?
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'transactions'
  AND column_name IN ('occurrence_key', 'is_auto_generated', 'sync_locked', 'generated_by');
```

3. **Jeśli kolumn Etapu 8 NIE MA** → stan sprzed migracji; napraw przyczynę (np. konflikt duplikatów z komunikatu EXCEPTION), powtórz preflight, potem migrację od zera.
4. **Jeśli kolumny / indeksy JUŻ SĄ** (częściowy apply poza transakcją — rzadkie, np. ręczne uruchamianie fragmentów) → **STOP**:
   - nie uruchamiaj migracji drugi raz „na ślepo”;
   - użyj backupu/PITR **albo** ostrożnie `03_rollback_restore.sql` na świadomie skopiowanym stanie;
   - dopiero potem pełna migracja od czystego stanu.
5. Typowe komunikaty z migracji:
   - `Etap 8 abort: N konfliktowych grup duplikatów` → wróć do preflight F, rozstrzygnij ręcznie.
   - `Etap 8 abort: N kolizji UNIQUE auto` → preflight I / ręczne dedupe.
   - `Etap 8 abort: N duplikatów (household_id, person_key)` → preflight J.
6. **Po udanym COMMIT, ale zły postflight** → traktuj jak awarię po wdrożeniu: PITR/backup preferowany; `03_rollback_restore.sql` tylko ze świadomością luk (brak restore `complete_simple_setup` / `reset_household_budget`).

### Czego nie robić

- Nie mieszać ręcznych `COMMIT` w środku pliku.
- Nie uruchamiać migracji kawałkami bez rozumienia kolejności.
- Nie uruchamiać rollbacku „dla pewności”, jeśli migracja w ogóle nie weszła.
- Nie zmieniać klienta / nie commitować w tym samym kroku.

---

## 4. Pliki do wklejenia (kolejność)

1. `docs/etap8/01_preflight.sql` — po Twoim „uruchom preflight”
2. `docs/etap8/02_migration.sql` — po Twoim „uruchom migrację” (i GO z preflight)
3. `docs/etap8/05_postflight.sql` + zapytania z §2
4. Awaria po COMMIT: `docs/etap8/03_rollback_restore.sql` (+ restore RPC z dumpa §A.3)

Onboarding po migracji (klient jeszcze bez zmian):  
`docs/etap8/ONBOARDING_FLOW.md` — claim wymagany przed setup, jeśli create nie przekaże `p_person_key`.

---

## 5. Co dalej

Czekam wyłącznie na:
- **`uruchom preflight`** — wtedy wkleję/uruchomię tylko SELECT preflight na prod (jeśli dasz dostęp), albo poprowadzę Cię krok po kroku w SQL Editor;
- **`uruchom migrację`** — dopiero po Twoim GO z interpretacji preflight.

Bez tych haseł: zero SQL na produkcji.
