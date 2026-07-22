-- =============================================================================
-- ETAP 8 — PREFLIGHT (wyłącznie SELECT — zero DDL, zero DML)
-- Uruchom w Supabase SQL Editor przed migracją. Zapisz wyniki.
-- =============================================================================

-- A) account_id z innego gospodarstwa
SELECT
  'cross_hh_account' AS issue,
  t.id AS transaction_id,
  t.household_id AS tx_household_id,
  a.household_id AS account_household_id,
  t.account_id,
  a.name AS account_name,
  t.type,
  t.amount_grosze,
  t.txn_date,
  t.description,
  t.status,
  t.income_source_id,
  t.person_key,
  t.paid_by,
  t.is_shared,
  t.created_at
FROM public.transactions t
JOIN public.accounts a ON a.id = t.account_id
WHERE t.household_id IS DISTINCT FROM a.household_id
ORDER BY t.created_at;

-- B) income_source_id z innego gospodarstwa
SELECT
  'cross_hh_income_source' AS issue,
  t.id AS transaction_id,
  t.household_id AS tx_household_id,
  s.household_id AS source_household_id,
  t.income_source_id,
  s.name AS source_name,
  t.type,
  t.amount_grosze,
  t.txn_date,
  t.description,
  t.status,
  t.account_id,
  t.created_at
FROM public.transactions t
JOIN public.income_sources s ON s.id = t.income_source_id
WHERE t.income_source_id IS NOT NULL
  AND t.household_id IS DISTINCT FROM s.household_id
ORDER BY t.created_at;

-- C) Kandydaci legacy auto-sync (fingerprint — wszystkie warunki naraz)
--    WYMAGA RĘCZNEGO PRZEGLĄDU KAŻDEGO WIERSZA przed migracją.
--    Kwota ∈ {typical, safe}. Migracja oznaczy je jako is_auto_generated.
SELECT
  'legacy_auto_fingerprint_candidate' AS issue,
  t.id AS transaction_id,
  t.household_id,
  t.income_source_id,
  s.name AS source_name,
  t.txn_date,
  t.amount_grosze,
  s.typical_amount_grosze,
  s.safe_amount_grosze,
  t.status,
  t.account_id,
  t.description,
  t.person_key,
  t.paid_by,
  t.is_shared,
  t.note,
  t.created_at
FROM public.transactions t
JOIN public.income_sources s ON s.id = t.income_source_id
WHERE t.type = 'income'
  AND t.income_source_id IS NOT NULL
  AND t.category_name = 'Wpływ'
  AND t.is_shared = false
  AND t.description = s.name
  AND t.person_key = s.owner_key
  AND t.paid_by = s.owner_key
  AND (t.note IS NULL OR btrim(t.note) = '')
  AND t.amount_grosze IN (s.typical_amount_grosze, s.safe_amount_grosze)
ORDER BY t.household_id, t.income_source_id, t.txn_date, t.created_at;

-- D) Niejednoznaczne: mają income_source_id, ale NIE spełniają fingerprint
--    → tylko raport; migracja NIE oznacza auto i NIE ustawia occurrence_key
--    (w tym kwota poza typical/safe)
SELECT
  'ambiguous_income_source_link' AS issue,
  t.id AS transaction_id,
  t.household_id,
  t.income_source_id,
  s.name AS source_name,
  t.type,
  t.category_name,
  t.description,
  t.amount_grosze,
  s.typical_amount_grosze,
  s.safe_amount_grosze,
  t.status,
  t.account_id,
  t.person_key,
  t.paid_by,
  t.is_shared,
  t.note,
  t.txn_date,
  t.created_at
FROM public.transactions t
JOIN public.income_sources s ON s.id = t.income_source_id
WHERE t.income_source_id IS NOT NULL
  AND NOT (
    t.type = 'income'
    AND t.category_name = 'Wpływ'
    AND t.is_shared = false
    AND t.description = s.name
    AND t.person_key = s.owner_key
    AND t.paid_by = s.owner_key
    AND (t.note IS NULL OR btrim(t.note) = '')
    AND t.amount_grosze IN (s.typical_amount_grosze, s.safe_amount_grosze)
  )
ORDER BY t.household_id, t.income_source_id, t.txn_date, t.created_at;

-- E) Duplikaty fingerprint (HH + source + txn_date) — pełne szczegóły
WITH fingerprint AS (
  SELECT t.*
  FROM public.transactions t
  JOIN public.income_sources s ON s.id = t.income_source_id
  WHERE t.type = 'income'
    AND t.income_source_id IS NOT NULL
    AND t.category_name = 'Wpływ'
    AND t.is_shared = false
    AND t.description = s.name
    AND t.person_key = s.owner_key
    AND t.paid_by = s.owner_key
    AND (t.note IS NULL OR btrim(t.note) = '')
    AND t.amount_grosze IN (s.typical_amount_grosze, s.safe_amount_grosze)
),
dup_keys AS (
  SELECT household_id, income_source_id, txn_date, COUNT(*) AS cnt
  FROM fingerprint
  GROUP BY household_id, income_source_id, txn_date
  HAVING COUNT(*) > 1
)
SELECT
  'duplicate_legacy_auto_group' AS issue,
  d.cnt AS group_size,
  c.id AS transaction_id,
  c.household_id,
  c.income_source_id,
  c.txn_date,
  c.amount_grosze,
  c.status,
  c.account_id,
  c.description,
  c.person_key,
  c.paid_by,
  c.is_shared,
  c.note,
  c.created_at,
  c.updated_at
FROM dup_keys d
JOIN fingerprint c
  ON c.household_id = d.household_id
 AND c.income_source_id = d.income_source_id
 AND c.txn_date = d.txn_date
ORDER BY c.household_id, c.income_source_id, c.txn_date, c.created_at, c.id;

-- F) Identyczne vs konfliktowe (istotne pola)
WITH fingerprint AS (
  SELECT t.*
  FROM public.transactions t
  JOIN public.income_sources s ON s.id = t.income_source_id
  WHERE t.type = 'income'
    AND t.income_source_id IS NOT NULL
    AND t.category_name = 'Wpływ'
    AND t.is_shared = false
    AND t.description = s.name
    AND t.person_key = s.owner_key
    AND t.paid_by = s.owner_key
    AND (t.note IS NULL OR btrim(t.note) = '')
    AND t.amount_grosze IN (s.typical_amount_grosze, s.safe_amount_grosze)
),
dup_keys AS (
  SELECT household_id, income_source_id, txn_date
  FROM fingerprint
  GROUP BY household_id, income_source_id, txn_date
  HAVING COUNT(*) > 1
),
grouped AS (
  SELECT
    c.household_id,
    c.income_source_id,
    c.txn_date,
    COUNT(*) AS cnt,
    COUNT(DISTINCT (c.amount_grosze, c.account_id, c.status, c.description, c.paid_by, c.is_shared))
      AS distinct_signatures
  FROM fingerprint c
  JOIN dup_keys d
    ON d.household_id = c.household_id
   AND d.income_source_id = c.income_source_id
   AND d.txn_date = c.txn_date
  GROUP BY c.household_id, c.income_source_id, c.txn_date
)
SELECT
  CASE
    WHEN distinct_signatures = 1 THEN 'duplicate_identical_safe_to_auto_dedupe'
    ELSE 'duplicate_conflict_manual_decision'
  END AS issue,
  household_id,
  income_source_id,
  txn_date,
  cnt AS group_size,
  distinct_signatures
FROM grouped
ORDER BY issue, household_id, txn_date;

-- G) Podsumowanie duplikatów fingerprint
WITH fingerprint AS (
  SELECT t.*
  FROM public.transactions t
  JOIN public.income_sources s ON s.id = t.income_source_id
  WHERE t.type = 'income'
    AND t.income_source_id IS NOT NULL
    AND t.category_name = 'Wpływ'
    AND t.is_shared = false
    AND t.description = s.name
    AND t.person_key = s.owner_key
    AND t.paid_by = s.owner_key
    AND (t.note IS NULL OR btrim(t.note) = '')
    AND t.amount_grosze IN (s.typical_amount_grosze, s.safe_amount_grosze)
),
dup_keys AS (
  SELECT household_id, income_source_id, txn_date, COUNT(*) AS cnt
  FROM fingerprint
  GROUP BY household_id, income_source_id, txn_date
  HAVING COUNT(*) > 1
),
grouped AS (
  SELECT
    c.household_id,
    c.income_source_id,
    c.txn_date,
    COUNT(*) AS cnt,
    COUNT(DISTINCT (c.amount_grosze, c.account_id, c.status, c.description, c.paid_by, c.is_shared))
      AS distinct_signatures
  FROM fingerprint c
  JOIN dup_keys d USING (household_id, income_source_id, txn_date)
  GROUP BY c.household_id, c.income_source_id, c.txn_date
)
SELECT
  COUNT(*) FILTER (WHERE distinct_signatures = 1) AS identical_groups_auto_dedupe_ok,
  COALESCE(SUM(cnt - 1) FILTER (WHERE distinct_signatures = 1), 0) AS rows_safe_to_archive_delete,
  COUNT(*) FILTER (WHERE distinct_signatures > 1) AS conflict_groups_block_migration,
  COALESCE(SUM(cnt) FILTER (WHERE distinct_signatures > 1), 0) AS rows_in_conflict_groups
FROM grouped;

-- H) Liczba niejednoznacznych linków
SELECT COUNT(*) AS ambiguous_income_source_links
FROM public.transactions t
JOIN public.income_sources s ON s.id = t.income_source_id
WHERE t.income_source_id IS NOT NULL
  AND NOT (
    t.type = 'income'
    AND t.category_name = 'Wpływ'
    AND t.is_shared = false
    AND t.description = s.name
    AND t.person_key = s.owner_key
    AND t.paid_by = s.owner_key
    AND (t.note IS NULL OR btrim(t.note) = '')
    AND t.amount_grosze IN (s.typical_amount_grosze, s.safe_amount_grosze)
  );

-- I) Potencjalne kolizje UNIQUE auto po occurrence_key = txn_date
--    (tylko wśród kandydatów fingerprint — partial unique dotyczy is_auto_generated)
SELECT
  'unique_key_collision_after_occurrence_key' AS issue,
  household_id,
  income_source_id,
  txn_date AS proposed_occurrence_key,
  COUNT(*) AS cnt
FROM public.transactions t
JOIN public.income_sources s ON s.id = t.income_source_id
WHERE t.type = 'income'
  AND t.income_source_id IS NOT NULL
  AND t.category_name = 'Wpływ'
  AND t.is_shared = false
  AND t.description = s.name
  AND t.person_key = s.owner_key
  AND t.paid_by = s.owner_key
  AND (t.note IS NULL OR btrim(t.note) = '')
  AND t.amount_grosze IN (s.typical_amount_grosze, s.safe_amount_grosze)
GROUP BY household_id, income_source_id, txn_date
HAVING COUNT(*) > 1
ORDER BY cnt DESC, household_id;

-- J) Duplikaty person_key w household_members (pawel/milena)
--    Migracja ABORT przed CREATE UNIQUE INDEX household_members_hh_person_uidx.
SELECT
  'duplicate_household_person_key' AS issue,
  household_id,
  person_key,
  COUNT(*) AS member_count,
  array_agg(user_id ORDER BY created_at, user_id) AS user_ids
FROM public.household_members
WHERE person_key IN ('pawel', 'milena')
GROUP BY household_id, person_key
HAVING COUNT(*) > 1
ORDER BY household_id, person_key;
