-- =============================================================================
-- ETAP 8 — POSTFLIGHT (wyłącznie SELECT — zero DDL, zero DML)
-- Uruchom po 02_migration.sql. Oczekiwane: puste wyniki problemów / ok=true.
-- =============================================================================

-- 1) Partial UNIQUE auto exists
SELECT
  'partial_unique_auto' AS check_name,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'transactions_hh_source_occurrence_uidx'
  ) AS ok;

-- 2) Unique person_key index
SELECT
  'household_members_hh_person_uidx' AS check_name,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'household_members_hh_person_uidx'
  ) AS ok;

-- 3) claim_my_person_key exists (3-arg with default)
SELECT
  'claim_my_person_key' AS check_name,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'claim_my_person_key'
      AND pg_get_function_identity_arguments(p.oid) = 'p_household_id uuid, p_person_key text, p_opening_balance_grosze integer'
  ) AS ok;

-- 4) sync signature (4-arg) — stary 2-arg nie powinien istnieć
SELECT
  'sync_4arg' AS check_name,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'sync_income_source_transactions'
      AND pg_get_function_identity_arguments(p.oid)
        = 'p_household_id uuid, p_as_of date, p_horizon_days integer, p_window_end date'
  ) AS ok;

SELECT
  'sync_old_2arg_gone' AS check_name,
  NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'sync_income_source_transactions'
      AND pg_get_function_identity_arguments(p.oid) = 'p_household_id uuid, p_as_of date'
  ) AS ok;

-- 5) create_household / accept_invitation istnieją
SELECT
  'create_household' AS check_name,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_household'
  ) AS ok;

SELECT
  'accept_invitation' AS check_name,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'accept_invitation'
  ) AS ok;

-- 6) Kolumny Etapu 8
SELECT
  'transactions_etap8_columns' AS check_name,
  COUNT(*) FILTER (
    WHERE column_name IN ('occurrence_key', 'is_auto_generated', 'sync_locked', 'generated_by')
  ) = 4 AS ok
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'transactions';

-- 7) Brak par auto+manual na ten sam source + txn_date
--    (luka sync: manual powinien blokować NOWY auto; istniejące pary = do ręcznego przeglądu)
SELECT
  'auto_and_manual_same_source_date' AS issue,
  a.household_id,
  a.income_source_id,
  a.txn_date,
  a.id AS auto_id,
  m.id AS manual_id
FROM public.transactions a
JOIN public.transactions m
  ON m.household_id = a.household_id
 AND m.income_source_id = a.income_source_id
 AND m.txn_date = a.txn_date
 AND m.is_auto_generated = false
 AND m.type = 'income'
WHERE a.is_auto_generated = true
  AND a.type = 'income'
ORDER BY a.household_id, a.income_source_id, a.txn_date;

-- 8) setup_slot pensji tylko przy simple_setup (sanity)
SELECT
  'primary_income_without_simple_setup' AS issue,
  id,
  household_id,
  owner_key,
  setup_slot,
  note,
  active
FROM public.income_sources
WHERE setup_slot IN ('primary_income_pawel', 'primary_income_milena')
  AND (note IS DISTINCT FROM 'simple_setup' OR active IS NOT TRUE);

-- 9) Duplikaty person_key (powinno być 0 po migracji)
SELECT
  'duplicate_person_key_post' AS issue,
  household_id,
  person_key,
  COUNT(*) AS member_count
FROM public.household_members
WHERE person_key IN ('pawel', 'milena')
GROUP BY household_id, person_key
HAVING COUNT(*) > 1;
