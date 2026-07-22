-- =============================================================================
-- ETAP 8 — integralność danych (claim, sync RPC, partial unique, wariant B)
-- Źródło: docs/etap8/02_migration.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Schemat maintenance (archiwum poza Data API / RLS appki)
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS maintenance;

REVOKE ALL ON SCHEMA maintenance FROM PUBLIC;
REVOKE ALL ON SCHEMA maintenance FROM anon;
REVOKE ALL ON SCHEMA maintenance FROM authenticated;
-- Dostęp tylko przez role z uprawnieniami owners/postgres (SQL Editor)

CREATE TABLE IF NOT EXISTS maintenance.etap8_deleted_duplicate_transactions (
  archive_id BIGSERIAL PRIMARY KEY,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archive_reason TEXT NOT NULL,
  id UUID NOT NULL,
  household_id UUID,
  account_id UUID,
  type TEXT,
  amount_grosze INTEGER,
  txn_date DATE,
  description TEXT,
  category_name TEXT,
  person_key TEXT,
  paid_by TEXT,
  is_shared BOOLEAN,
  status TEXT,
  income_source_id UUID,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  receipt_id UUID,
  occurrence_key DATE,
  is_auto_generated BOOLEAN,
  sync_locked BOOLEAN,
  generated_by TEXT
);

REVOKE ALL ON TABLE maintenance.etap8_deleted_duplicate_transactions FROM PUBLIC;
REVOKE ALL ON TABLE maintenance.etap8_deleted_duplicate_transactions FROM anon;
REVOKE ALL ON TABLE maintenance.etap8_deleted_duplicate_transactions FROM authenticated;

-- ---------------------------------------------------------------------------
-- 1) Kolumny transactions
-- ---------------------------------------------------------------------------
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS occurrence_key DATE,
  ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sync_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS generated_by TEXT;

COMMENT ON COLUMN public.transactions.occurrence_key IS
  'Data wystąpienia auto-wpływu. Wymagana tylko gdy is_auto_generated = true '
  '(razem z income_source_id). Ręczne wiersze mogą mieć income_source_id bez occurrence_key.';
COMMENT ON COLUMN public.transactions.is_auto_generated IS
  'true tylko dla rekordów utworzonych przez generator sync / oznaczonych bezpiecznie jako legacy auto.';
COMMENT ON COLUMN public.transactions.sync_locked IS
  'true = ręczna edycja kwoty/daty/konta — sync nie nadpisuje tych pól (ani statusu).';
COMMENT ON COLUMN public.transactions.generated_by IS
  'Dozwolone: income_source_sync | NULL (ręczne). Legacy: income_source_sync_legacy.';

-- ---------------------------------------------------------------------------
-- 2) Legacy fingerprint → is_auto_generated + occurrence_key
--    occurrence_key ustawiane TYLKO przy oznaczeniu jako auto (nie dla wszystkich
--    wierszy z income_source_id). Niejednoznaczne linki: bez zmian.
--    Kwota musi być typical LUB safe (ściślejszy fingerprint).
-- ---------------------------------------------------------------------------
UPDATE public.transactions t
SET
  is_auto_generated = true,
  generated_by = 'income_source_sync_legacy',
  occurrence_key = COALESCE(t.occurrence_key, t.txn_date)
FROM public.income_sources s
WHERE t.income_source_id = s.id
  AND t.type = 'income'
  AND t.category_name = 'Wpływ'
  AND t.is_shared = false
  AND t.description = s.name
  AND t.person_key = s.owner_key
  AND t.paid_by = s.owner_key
  AND (t.note IS NULL OR btrim(t.note) = '')
  AND t.amount_grosze IN (s.typical_amount_grosze, s.safe_amount_grosze)
  AND t.is_auto_generated = false;

-- ---------------------------------------------------------------------------
-- 3) CHECK: is_auto_generated ⇒ income_source_id + occurrence_key NOT NULL
--    Ręczne: income_source_id może być ustawione przy occurrence_key NULL.
-- ---------------------------------------------------------------------------
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_auto_occurrence_pair_chk;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_auto_occurrence_pair_chk
  CHECK (
    is_auto_generated = false
    OR (
      is_auto_generated = true
      AND income_source_id IS NOT NULL
      AND occurrence_key IS NOT NULL
    )
  );

-- ---------------------------------------------------------------------------
-- 4) CHECK: spójność is_auto_generated / generated_by + dozwolone wartości
-- ---------------------------------------------------------------------------
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_generated_by_chk;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_generated_by_chk
  CHECK (
    generated_by IS NULL
    OR generated_by IN ('income_source_sync', 'income_source_sync_legacy')
  );

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_auto_generated_pair_chk;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_auto_generated_pair_chk
  CHECK (
    (is_auto_generated = false AND generated_by IS NULL)
    OR
    (is_auto_generated = true AND generated_by IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- 5) Deduplikacja: TYLKO grupy identyczne w istotnych polach.
--    Konfliktowe grupy → ABORT migracji (EXCEPTION).
-- ---------------------------------------------------------------------------

-- 5a) Abort jeśli są konflikty wśród bezpiecznych kandydatów
DO $$
DECLARE
  v_conflicts INT;
BEGIN
  WITH candidates AS (
    SELECT t.*
    FROM public.transactions t
    JOIN public.income_sources s ON s.id = t.income_source_id
    WHERE t.is_auto_generated = true
      AND t.generated_by = 'income_source_sync_legacy'
      AND t.income_source_id IS NOT NULL
      AND t.occurrence_key IS NOT NULL
  ),
  dup_keys AS (
    SELECT household_id, income_source_id, occurrence_key
    FROM candidates
    GROUP BY household_id, income_source_id, occurrence_key
    HAVING COUNT(*) > 1
  ),
  grouped AS (
    SELECT
      c.household_id,
      c.income_source_id,
      c.occurrence_key,
      COUNT(DISTINCT (c.amount_grosze, c.account_id, c.status, c.description, c.paid_by, c.is_shared)) AS sigs
    FROM candidates c
    JOIN dup_keys d
      ON d.household_id = c.household_id
     AND d.income_source_id = c.income_source_id
     AND d.occurrence_key = c.occurrence_key
    GROUP BY c.household_id, c.income_source_id, c.occurrence_key
  )
  SELECT COUNT(*) INTO v_conflicts FROM grouped WHERE sigs > 1;

  IF v_conflicts > 0 THEN
    RAISE EXCEPTION
      'Etap 8 abort: % konfliktowych grup duplikatów (różne kwoty/konto/status/opis/paid_by/is_shared). Rozstrzygnij ręcznie — patrz preflight F.',
      v_conflicts;
  END IF;
END $$;

-- 5b) Archiwum + DELETE tylko identycznych (rn > 1)
--     COUNT(DISTINCT ...) OVER nie jest wspierane — agregacja w group_stats.
WITH candidates AS (
  SELECT t.*
  FROM public.transactions t
  WHERE t.is_auto_generated = true
    AND t.generated_by = 'income_source_sync_legacy'
    AND t.income_source_id IS NOT NULL
    AND t.occurrence_key IS NOT NULL
),
group_stats AS (
  SELECT
    household_id, income_source_id, occurrence_key,
    COUNT(*) AS grp_cnt,
    COUNT(DISTINCT (amount_grosze, account_id, status, description, paid_by, is_shared)) AS sigs
  FROM candidates
  GROUP BY household_id, income_source_id, occurrence_key
),
ranked AS (
  SELECT
    c.*,
    gs.grp_cnt,
    gs.sigs,
    ROW_NUMBER() OVER (
      PARTITION BY c.household_id, c.income_source_id, c.occurrence_key
      ORDER BY c.created_at ASC NULLS LAST, c.id ASC
    ) AS rn
  FROM candidates c
  JOIN group_stats gs USING (household_id, income_source_id, occurrence_key)
),
to_delete AS (
  SELECT * FROM ranked
  WHERE grp_cnt > 1 AND sigs = 1 AND rn > 1
),
archived AS (
  INSERT INTO maintenance.etap8_deleted_duplicate_transactions (
    archive_reason,
    id, household_id, account_id, type, amount_grosze, txn_date,
    description, category_name, person_key, paid_by, is_shared, status,
    income_source_id, note, created_by, created_at, updated_at, receipt_id,
    occurrence_key, is_auto_generated, sync_locked, generated_by
  )
  SELECT
    'etap8_dedupe_identical_legacy_auto',
    id, household_id, account_id, type, amount_grosze, txn_date,
    description, category_name, person_key, paid_by, is_shared, status,
    income_source_id, note, created_by, created_at, updated_at, receipt_id,
    occurrence_key, is_auto_generated, sync_locked, generated_by
  FROM to_delete
  RETURNING id
)
DELETE FROM public.transactions t
USING archived a
WHERE t.id = a.id;

-- ---------------------------------------------------------------------------
-- 6) Abort jeśli wśród auto zostały kolizje UNIQUE
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_collisions INT;
BEGIN
  SELECT COUNT(*) INTO v_collisions
  FROM (
    SELECT 1
    FROM public.transactions
    WHERE is_auto_generated = true
      AND income_source_id IS NOT NULL
      AND occurrence_key IS NOT NULL
    GROUP BY household_id, income_source_id, occurrence_key
    HAVING COUNT(*) > 1
  ) x;

  IF v_collisions > 0 THEN
    RAISE EXCEPTION
      'Etap 8 abort: % kolizji UNIQUE auto (household_id, income_source_id, occurrence_key). Rozstrzygnij ręcznie (preflight I / F).',
      v_collisions;
  END IF;
END $$;

-- Partial UNIQUE: tylko auto-generated (ręczne mogą mieć ten sam source+dzień)
CREATE UNIQUE INDEX IF NOT EXISTS transactions_hh_source_occurrence_uidx
  ON public.transactions (household_id, income_source_id, occurrence_key)
  WHERE is_auto_generated = true;

-- ---------------------------------------------------------------------------
-- 6b) Unique person_key per household (pawel/milena) — abort przy duplikatach
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_dup INT;
BEGIN
  SELECT COUNT(*) INTO v_dup
  FROM (
    SELECT 1
    FROM public.household_members
    WHERE person_key IN ('pawel', 'milena')
    GROUP BY household_id, person_key
    HAVING COUNT(*) > 1
  ) x;

  IF v_dup > 0 THEN
    RAISE EXCEPTION
      'Etap 8 abort: % duplikatów (household_id, person_key) w household_members. Rozstrzygnij ręcznie — patrz preflight J.',
      v_dup;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS household_members_hh_person_uidx
  ON public.household_members (household_id, person_key)
  WHERE person_key IN ('pawel', 'milena');

-- ---------------------------------------------------------------------------
-- 7) setup_slot na accounts + income_sources
-- ---------------------------------------------------------------------------
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS setup_slot TEXT;

ALTER TABLE public.income_sources
  ADD COLUMN IF NOT EXISTS setup_slot TEXT;

COMMENT ON COLUMN public.accounts.setup_slot IS
  'primary_pawel | primary_milena | NULL — slot onboardingu, nie ogranicza liczby kont.';
COMMENT ON COLUMN public.income_sources.setup_slot IS
  'primary_income_pawel | primary_income_milena | NULL — pensja ze startu (note=simple_setup), nie po nazwie.';

-- Oznacz istniejące pierwsze aktywne konta osobiste (best-effort, bez kasowania nadmiaru)
UPDATE public.accounts a
SET setup_slot = 'primary_pawel'
WHERE a.setup_slot IS NULL
  AND a.owner_key = 'pawel'
  AND a.active = true
  AND a.id = (
    SELECT a2.id FROM public.accounts a2
    WHERE a2.household_id = a.household_id AND a2.owner_key = 'pawel' AND a2.active
    ORDER BY a2.created_at, a2.id LIMIT 1
  );

UPDATE public.accounts a
SET setup_slot = 'primary_milena'
WHERE a.setup_slot IS NULL
  AND a.owner_key = 'milena'
  AND a.active = true
  AND a.id = (
    SELECT a2.id FROM public.accounts a2
    WHERE a2.household_id = a.household_id AND a2.owner_key = 'milena' AND a2.active
    ORDER BY a2.created_at, a2.id LIMIT 1
  );

-- Pensje: TYLKO gdy dokładnie jedno aktywne źródło z note='simple_setup' dla ownera.
-- Brak albo niejednoznaczność → zostaw setup_slot NULL (nie przypisuj „pierwszego aktywnego”).
UPDATE public.income_sources s
SET setup_slot = 'primary_income_pawel'
WHERE s.setup_slot IS NULL
  AND s.owner_key = 'pawel'
  AND s.active = true
  AND s.note = 'simple_setup'
  AND (
    SELECT COUNT(*)
    FROM public.income_sources s2
    WHERE s2.household_id = s.household_id
      AND s2.owner_key = 'pawel'
      AND s2.active = true
      AND s2.note = 'simple_setup'
  ) = 1;

UPDATE public.income_sources s
SET setup_slot = 'primary_income_milena'
WHERE s.setup_slot IS NULL
  AND s.owner_key = 'milena'
  AND s.active = true
  AND s.note = 'simple_setup'
  AND (
    SELECT COUNT(*)
    FROM public.income_sources s2
    WHERE s2.household_id = s.household_id
      AND s2.owner_key = 'milena'
      AND s2.active = true
      AND s2.note = 'simple_setup'
  ) = 1;

CREATE UNIQUE INDEX IF NOT EXISTS accounts_hh_setup_slot_uidx
  ON public.accounts (household_id, setup_slot)
  WHERE setup_slot IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS income_sources_hh_setup_slot_uidx
  ON public.income_sources (household_id, setup_slot)
  WHERE setup_slot IS NOT NULL;

ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_setup_slot_chk;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_setup_slot_chk
  CHECK (setup_slot IS NULL OR setup_slot IN ('primary_pawel', 'primary_milena'));

ALTER TABLE public.income_sources DROP CONSTRAINT IF EXISTS income_sources_setup_slot_chk;
ALTER TABLE public.income_sources ADD CONSTRAINT income_sources_setup_slot_chk
  CHECK (
    setup_slot IS NULL
    OR setup_slot IN ('primary_income_pawel', 'primary_income_milena')
  );

-- ---------------------------------------------------------------------------
-- 8) Trigger spójności household
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transactions_enforce_same_household()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_acc_hh UUID;
  v_src_hh UUID;
BEGIN
  SELECT household_id INTO v_acc_hh FROM public.accounts WHERE id = NEW.account_id;
  IF v_acc_hh IS NULL OR v_acc_hh IS DISTINCT FROM NEW.household_id THEN
    RAISE EXCEPTION 'account_id does not belong to transaction household';
  END IF;

  IF NEW.income_source_id IS NOT NULL THEN
    SELECT household_id INTO v_src_hh FROM public.income_sources WHERE id = NEW.income_source_id;
    IF v_src_hh IS NULL OR v_src_hh IS DISTINCT FROM NEW.household_id THEN
      RAISE EXCEPTION 'income_source_id does not belong to transaction household';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_same_household ON public.transactions;
CREATE TRIGGER transactions_same_household
  BEFORE INSERT OR UPDATE OF household_id, account_id, income_source_id
  ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.transactions_enforce_same_household();

-- ---------------------------------------------------------------------------
-- 9) Helper: last business day of month
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.etap8_last_business_day(p_month DATE)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  d DATE := (date_trunc('month', p_month) + INTERVAL '1 month - 1 day')::date;
BEGIN
  WHILE EXTRACT(ISODOW FROM d) IN (6, 7) LOOP
    d := d - 1;
  END LOOP;
  RETURN d;
END;
$$;

REVOKE ALL ON FUNCTION public.etap8_last_business_day(DATE) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 10) Helper: lista occurrence dla jednego źródła w oknie
--     v_start = GREATEST(window_start, source_created, next_occurrence).
--     Generuje TYLKO do przodu od v_start — bez cofania weekly/biweekly/LBD.
--     irregular → zawsze [].
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.etap8_list_occurrences(
  p_frequency TEXT,
  p_next_occurrence DATE,
  p_end_date DATE,
  p_day_of_month INT,
  p_source_created DATE,
  p_window_start DATE,
  p_window_end DATE
)
RETURNS DATE[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_start DATE := GREATEST(p_window_start, p_source_created, p_next_occurrence);
  v_end DATE := LEAST(p_window_end, COALESCE(p_end_date, '9999-12-31'::date));
  v_cursor DATE;
  v_out DATE[] := ARRAY[]::DATE[];
  v_day INT;
  v_month DATE;
  v_occ DATE;
  v_guard INT := 0;
  v_step INT;
BEGIN
  IF p_frequency IS NULL OR p_frequency = 'irregular' THEN
    RETURN v_out;
  END IF;

  IF p_next_occurrence IS NULL OR v_start > v_end THEN
    RETURN v_out;
  END IF;

  -- once: wyłącznie next_occurrence_date w [v_start, v_end]
  IF p_frequency = 'once' THEN
    IF p_next_occurrence >= v_start AND p_next_occurrence <= v_end THEN
      v_out := array_append(v_out, p_next_occurrence);
    END IF;
    RETURN v_out;
  END IF;

  -- monthly / monthly_on_day: miesiące od date_trunc(month, v_start), tylko occ >= v_start
  IF p_frequency IN ('monthly_on_day', 'monthly') THEN
    v_day := COALESCE(p_day_of_month, EXTRACT(DAY FROM p_next_occurrence)::int);
    v_month := date_trunc('month', v_start)::date;

    WHILE v_month <= date_trunc('month', v_end)::date AND v_guard < 240 LOOP
      v_guard := v_guard + 1;
      v_occ := make_date(
        EXTRACT(YEAR FROM v_month)::int,
        EXTRACT(MONTH FROM v_month)::int,
        LEAST(
          v_day,
          EXTRACT(DAY FROM (date_trunc('month', v_month) + INTERVAL '1 month - 1 day'))::int
        )
      );

      IF v_occ >= v_start AND v_occ <= v_end THEN
        v_out := array_append(v_out, v_occ);
      END IF;

      v_month := (v_month + INTERVAL '1 month')::date;
    END LOOP;

    RETURN v_out;
  END IF;

  -- last_business_day: pierwszy LBD >= v_start, potem tylko do przodu miesiąc po miesiącu
  IF p_frequency = 'last_business_day' THEN
    v_cursor := public.etap8_last_business_day(v_start);
    IF v_cursor < v_start THEN
      v_cursor := public.etap8_last_business_day(
        (date_trunc('month', v_start) + INTERVAL '1 month')::date
      );
    END IF;

    WHILE v_cursor <= v_end AND v_guard < 240 LOOP
      v_guard := v_guard + 1;
      IF v_cursor >= v_start THEN
        v_out := array_append(v_out, v_cursor);
      END IF;
      v_cursor := public.etap8_last_business_day(
        (date_trunc('month', v_cursor) + INTERVAL '1 month')::date
      );
    END LOOP;

    RETURN v_out;
  END IF;

  -- weekly / biweekly: kursor = next_occurrence, tylko kroki do przodu (bez cofania)
  IF p_frequency IN ('weekly', 'biweekly') THEN
    v_step := CASE WHEN p_frequency = 'weekly' THEN 7 ELSE 14 END;
    v_cursor := p_next_occurrence;

    WHILE v_cursor < v_start AND v_guard < 520 LOOP
      v_guard := v_guard + 1;
      v_cursor := v_cursor + v_step;
    END LOOP;

    v_guard := 0;
    WHILE v_cursor <= v_end AND v_guard < 520 LOOP
      v_guard := v_guard + 1;
      IF v_cursor >= v_start THEN
        v_out := array_append(v_out, v_cursor);
      END IF;
      v_cursor := v_cursor + v_step;
    END LOOP;

    RETURN v_out;
  END IF;

  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.etap8_list_occurrences(TEXT, DATE, DATE, INT, DATE, DATE, DATE) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 10b) claim_my_person_key — bezpieczne zajęcie slotu pawel/milena
--      Tylko własny wiersz, tylko gdy person_key IS NULL (idempotent przy tym samym).
--      Opcjonalnie tworzy/aktualizuje konto osobiste przy p_opening_balance_grosze.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_my_person_key(
  p_household_id UUID,
  p_person_key TEXT,
  p_opening_balance_grosze INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_person TEXT := lower(trim(p_person_key));
  v_current TEXT;
  v_updated UUID;
  v_acc_name TEXT;
  v_acc_slot TEXT;
  v_acc_id UUID;
  v_balance INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_person IS NULL OR v_person NOT IN ('pawel', 'milena') THEN
    RAISE EXCEPTION 'person_key must be pawel or milena';
  END IF;

  IF NOT public.is_household_member(p_household_id) THEN
    RAISE EXCEPTION 'Not a household member';
  END IF;

  SELECT person_key INTO v_current
  FROM public.household_members
  WHERE household_id = p_household_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a household member';
  END IF;

  -- Idempotent: już ten sam klucz
  IF v_current IS NOT NULL AND v_current = v_person THEN
    NULL; -- fall through to optional opening balance below
  ELSIF v_current IS NOT NULL AND v_current IS DISTINCT FROM v_person THEN
    RAISE EXCEPTION 'person_key already set';
  ELSE
    -- Slot zajęty przez kogoś innego (czytelny błąd przed race)
    IF EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_id = p_household_id
        AND person_key = v_person
        AND user_id <> v_uid
    ) THEN
      RAISE EXCEPTION 'Person slot already taken: %', v_person;
    END IF;

    BEGIN
      UPDATE public.household_members
      SET person_key = v_person
      WHERE household_id = p_household_id
        AND user_id = v_uid
        AND person_key IS NULL
      RETURNING user_id INTO v_updated;

      IF v_updated IS NULL THEN
        -- Concurrent claim na ten sam wiersz albo stan się zmienił
        SELECT person_key INTO v_current
        FROM public.household_members
        WHERE household_id = p_household_id AND user_id = v_uid;

        IF v_current = v_person THEN
          NULL; -- idempotent po race
        ELSIF v_current IS NOT NULL THEN
          RAISE EXCEPTION 'person_key already set';
        ELSE
          RAISE EXCEPTION 'Failed to claim person_key';
        END IF;
      END IF;
    EXCEPTION
      WHEN unique_violation THEN
        RAISE EXCEPTION 'Person slot already taken: %', v_person;
    END;
  END IF;

  -- Opening balance: utwórz/zaktualizuj konto osobiste gdy podano
  IF p_opening_balance_grosze IS NOT NULL THEN
    v_balance := GREATEST(0, p_opening_balance_grosze);
    v_acc_name := CASE WHEN v_person = 'pawel' THEN 'Konto Pawła' ELSE 'Konto Mileny' END;
    v_acc_slot := CASE WHEN v_person = 'pawel' THEN 'primary_pawel' ELSE 'primary_milena' END;

    SELECT id INTO v_acc_id
    FROM public.accounts
    WHERE household_id = p_household_id
      AND (
        setup_slot = v_acc_slot
        OR (owner_key = v_person AND active = true AND setup_slot IS NULL)
      )
    ORDER BY
      CASE WHEN setup_slot = v_acc_slot THEN 0 ELSE 1 END,
      created_at
    LIMIT 1;

    IF v_acc_id IS NOT NULL THEN
      UPDATE public.accounts
      SET name = v_acc_name,
          owner_key = v_person,
          account_type = 'personal',
          opening_balance_grosze = v_balance,
          include_in_budget = true,
          active = true,
          setup_slot = COALESCE(setup_slot, v_acc_slot),
          updated_at = now()
      WHERE id = v_acc_id;
    ELSE
      INSERT INTO public.accounts (
        household_id, name, owner_key, account_type,
        opening_balance_grosze, include_in_budget, active, setup_slot
      ) VALUES (
        p_household_id, v_acc_name, v_person, 'personal',
        v_balance, true, true, v_acc_slot
      )
      ON CONFLICT (household_id, setup_slot) WHERE setup_slot IS NOT NULL
      DO UPDATE SET
        opening_balance_grosze = EXCLUDED.opening_balance_grosze,
        name = EXCLUDED.name,
        include_in_budget = true,
        active = true,
        updated_at = now();
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_my_person_key(UUID, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_my_person_key(UUID, TEXT, INTEGER) TO authenticated;

-- set_my_person_key → ten sam claim (bez opening balance)
CREATE OR REPLACE FUNCTION public.set_my_person_key(
  p_household_id UUID,
  p_person_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.claim_my_person_key(p_household_id, p_person_key, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_person_key(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_person_key(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 10c) create_household — membership z person_key NULL; claim opcjonalnie w txn
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_household(TEXT);
DROP FUNCTION IF EXISTS public.create_household(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_household(
  p_name TEXT,
  p_person_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id UUID;
  v_uid UUID := auth.uid();
  v_claim TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Household name required';
  END IF;

  INSERT INTO public.households (name, created_by, initial_setup_done)
  VALUES (trim(p_name), v_uid, false)
  RETURNING id INTO v_household_id;

  -- Zawsze NULL — claim wymagany przed complete_simple_setup (chyba że p_person_key poniżej)
  INSERT INTO public.household_members (household_id, user_id, role, person_key)
  VALUES (v_household_id, v_uid, 'owner', NULL);

  -- Shared starter account (jak wcześniej w simple_setup)
  INSERT INTO public.accounts (
    household_id, name, owner_key, account_type,
    opening_balance_grosze, include_in_budget, active
  ) VALUES (
    v_household_id, 'Główne konto', 'shared', 'shared', 0, true, true
  );

  IF p_person_key IS NOT NULL AND length(trim(p_person_key)) > 0 THEN
    v_claim := lower(trim(p_person_key));
    IF v_claim NOT IN ('pawel', 'milena') THEN
      RAISE EXCEPTION 'person_key must be pawel or milena';
    END IF;
    PERFORM public.claim_my_person_key(v_household_id, v_claim, NULL);
  END IF;

  INSERT INTO public.audit_logs (household_id, user_id, action, entity_type, entity_id, details)
  VALUES (
    v_household_id, v_uid, 'create', 'household', v_household_id,
    jsonb_build_object(
      'name', trim(p_name),
      'person_key', CASE
        WHEN p_person_key IS NOT NULL AND length(trim(p_person_key)) > 0
          THEN lower(trim(p_person_key))
        ELSE NULL
      END
    )
  );

  RETURN v_household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_household(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_household(TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 10d) accept_invitation — membership NULL; claim + konto tylko gdy podano klucz
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.accept_invitation(TEXT);
DROP FUNCTION IF EXISTS public.accept_invitation(TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_code TEXT,
  p_person_key TEXT DEFAULT NULL,
  p_opening_balance_grosze INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_inv public.household_invitations%ROWTYPE;
  v_claim TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_inv
  FROM public.household_invitations
  WHERE code = upper(trim(p_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invitation code';
  END IF;

  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation already used';
  END IF;

  IF v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'Invitation expired';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = v_inv.household_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Already a member';
  END IF;

  -- Join z person_key NULL — claim osobno (lub poniżej w tej samej txn)
  INSERT INTO public.household_members (household_id, user_id, role, person_key)
  VALUES (v_inv.household_id, v_uid, 'member', NULL);

  DELETE FROM public.household_members
  WHERE user_id = v_uid
    AND household_id <> v_inv.household_id;

  IF p_person_key IS NOT NULL AND length(trim(p_person_key)) > 0 THEN
    v_claim := lower(trim(p_person_key));
    IF v_claim NOT IN ('pawel', 'milena') THEN
      RAISE EXCEPTION 'person_key must be pawel or milena';
    END IF;
    -- Claim + opcjonalne konto z opening balance (NULL = bez konta)
    PERFORM public.claim_my_person_key(
      v_inv.household_id,
      v_claim,
      p_opening_balance_grosze
    );
  END IF;
  -- Gdy p_person_key NULL: brak konta osobistego — opening balance przy claim później

  UPDATE public.household_invitations
  SET accepted_at = now(), accepted_by = v_uid
  WHERE id = v_inv.id;

  INSERT INTO public.audit_logs (household_id, user_id, action, entity_type, entity_id, details)
  VALUES (
    v_inv.household_id, v_uid, 'accept_invitation', 'household_invitation', v_inv.id,
    jsonb_build_object(
      'code', v_inv.code,
      'person_key', CASE
        WHEN p_person_key IS NOT NULL AND length(trim(p_person_key)) > 0
          THEN lower(trim(p_person_key))
        ELSE NULL
      END
    )
  );

  RETURN v_inv.household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation(TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT, TEXT, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- 11) RPC sync — reguła statusu:
--     • INSERT zawsze status = 'planned'
--     • ON CONFLICT: sync_locked → status bez zmian; paid → paid; inaczej planned
--     • NIGDY nie ustawiamy paid dlatego, że occurrence_key <= p_as_of
--     • Ręczny wpływ (is_auto_generated=false) na source+datę → blokuje NOWY auto
--     Okno: default EOM(as_of); p_horizon_days / p_window_end rozszerza (max 365d)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.sync_income_source_transactions(UUID, DATE);
DROP FUNCTION IF EXISTS public.sync_income_source_transactions(UUID, DATE, INTEGER, DATE);

CREATE OR REPLACE FUNCTION public.sync_income_source_transactions(
  p_household_id UUID,
  p_as_of DATE DEFAULT (timezone('Europe/Warsaw', now()))::date,
  p_horizon_days INTEGER DEFAULT NULL,
  p_window_end DATE DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_window_start DATE;
  v_window_end DATE;
  v_max_end DATE;
  v_started DATE;
  v_src RECORD;
  v_account_id UUID;
  v_occs DATE[];
  v_occ DATE;
  v_source_created DATE;
  v_upserted INTEGER := 0;
  v_rowcount INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_household_member(p_household_id) THEN
    RAISE EXCEPTION 'Not a household member';
  END IF;

  SELECT budget_started_date INTO v_started
  FROM public.households
  WHERE id = p_household_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Household not found';
  END IF;

  v_window_start := date_trunc('month', COALESCE(v_started, p_as_of))::date;
  v_max_end := (p_as_of + 365)::date;
  -- Okno: jawny p_window_end → horizon → EOM(as_of) (backward compatible)
  v_window_end := COALESCE(
    p_window_end,
    CASE
      WHEN p_horizon_days IS NOT NULL
        THEN (p_as_of + GREATEST(0, LEAST(p_horizon_days, 365)))::date
      ELSE NULL
    END,
    (date_trunc('month', p_as_of) + INTERVAL '1 month - 1 day')::date
  );
  v_window_end := LEAST(v_window_end, v_max_end);

  FOR v_src IN
    SELECT * FROM public.income_sources
    WHERE household_id = p_household_id AND active = true
  LOOP
    IF v_src.frequency = 'irregular' THEN
      CONTINUE;
    END IF;

    v_source_created := (v_src.created_at AT TIME ZONE 'Europe/Warsaw')::date;

    SELECT a.id INTO v_account_id
    FROM public.accounts a
    WHERE a.household_id = p_household_id
      AND a.active AND a.include_in_budget
      AND (
        (v_src.owner_key = 'pawel' AND a.setup_slot = 'primary_pawel')
        OR (v_src.owner_key = 'milena' AND a.setup_slot = 'primary_milena')
        OR a.owner_key = v_src.owner_key
      )
    ORDER BY
      CASE
        WHEN v_src.owner_key = 'pawel' AND a.setup_slot = 'primary_pawel' THEN 0
        WHEN v_src.owner_key = 'milena' AND a.setup_slot = 'primary_milena' THEN 0
        WHEN a.owner_key = v_src.owner_key THEN 1
        ELSE 2
      END,
      a.created_at
    LIMIT 1;

    IF v_account_id IS NULL THEN
      SELECT a.id INTO v_account_id
      FROM public.accounts a
      WHERE a.household_id = p_household_id AND a.active AND a.include_in_budget
      ORDER BY a.created_at LIMIT 1;
    END IF;
    IF v_account_id IS NULL THEN
      CONTINUE;
    END IF;

    v_occs := public.etap8_list_occurrences(
      v_src.frequency,
      v_src.next_occurrence_date,
      v_src.end_date,
      v_src.day_of_month,
      v_source_created,
      v_window_start,
      v_window_end
    );

    FOREACH v_occ IN ARRAY v_occs LOOP
      -- Reguła: ręczny wpływ na tę datę + source blokuje NOWY auto.
      -- Istniejący auto (jeśli jest) nadal może być potwierdzony przez ON CONFLICT —
      -- ten CONTINUE pomija INSERT tylko gdy jest manual; auto zostaje nietknięty
      -- (ścieżka ON CONFLICT nie jest brana).
      IF EXISTS (
        SELECT 1 FROM public.transactions t
        WHERE t.household_id = p_household_id
          AND t.income_source_id = v_src.id
          AND t.type = 'income'
          AND t.is_auto_generated = false
          AND t.txn_date = v_occ
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.transactions (
        household_id, account_id, type, amount_grosze, txn_date,
        description, category_name, person_key, paid_by, is_shared,
        status, income_source_id, occurrence_key,
        is_auto_generated, sync_locked, generated_by, created_by
      ) VALUES (
        p_household_id, v_account_id, 'income', v_src.typical_amount_grosze, v_occ,
        v_src.name, 'Wpływ', v_src.owner_key, v_src.owner_key, false,
        'planned',
        v_src.id, v_occ,
        true, false, 'income_source_sync', v_uid
      )
      ON CONFLICT (household_id, income_source_id, occurrence_key)
        WHERE (is_auto_generated = true)
      DO UPDATE SET
        -- Reguła statusu:
        --   INSERT → zawsze planned (powyżej).
        --   sync_locked → status bez zmian.
        --   Istniejący paid → zostaje paid.
        --   Inny status → planned.
        --   NIGDY: occurrence_key <= p_as_of ⇒ paid.
        status = CASE
          WHEN public.transactions.sync_locked THEN public.transactions.status
          WHEN public.transactions.status = 'paid' THEN 'paid'
          ELSE 'planned'
        END,
        amount_grosze = CASE
          WHEN public.transactions.sync_locked THEN public.transactions.amount_grosze
          ELSE EXCLUDED.amount_grosze
        END,
        txn_date = CASE
          WHEN public.transactions.sync_locked THEN public.transactions.txn_date
          ELSE EXCLUDED.txn_date
        END,
        account_id = CASE
          WHEN public.transactions.sync_locked THEN public.transactions.account_id
          ELSE EXCLUDED.account_id
        END,
        description = CASE
          WHEN public.transactions.sync_locked THEN public.transactions.description
          ELSE EXCLUDED.description
        END,
        generated_by = CASE
          WHEN public.transactions.generated_by = 'income_source_sync_legacy'
            THEN 'income_source_sync_legacy'
          ELSE 'income_source_sync'
        END,
        updated_at = now();

      GET DIAGNOSTICS v_rowcount = ROW_COUNT;
      v_upserted := v_upserted + v_rowcount;
    END LOOP;
  END LOOP;

  -- DELETE przyszłych planned auto poza oknem / zestawem occurrence / nieaktywne źródło.
  -- occurrence_key > p_as_of — NIE kasuj sierpniowej pensji gdy as_of = late July
  -- i horizon obejmuje sierpień (v_window_end obejmuje tę datę → zostaje w zestawie).
  DELETE FROM public.transactions t
  WHERE t.household_id = p_household_id
    AND t.is_auto_generated = true
    AND t.sync_locked = false
    AND t.status = 'planned'
    AND t.generated_by = 'income_source_sync'
    AND t.occurrence_key IS NOT NULL
    AND t.occurrence_key > p_as_of
    AND (
      t.occurrence_key > v_window_end
      OR t.occurrence_key < v_window_start
      OR NOT EXISTS (
        SELECT 1 FROM public.income_sources s
        WHERE s.id = t.income_source_id
          AND s.household_id = p_household_id
          AND s.active = true
      )
      OR t.occurrence_key <> ALL (
        COALESCE(
          (
            SELECT public.etap8_list_occurrences(
              s.frequency,
              s.next_occurrence_date,
              s.end_date,
              s.day_of_month,
              (s.created_at AT TIME ZONE 'Europe/Warsaw')::date,
              v_window_start,
              v_window_end
            )
            FROM public.income_sources s
            WHERE s.id = t.income_source_id
          ),
          ARRAY[]::DATE[]
        )
      )
    );

  RETURN v_upserted;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_income_source_transactions(UUID, DATE, INTEGER, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_income_source_transactions(UUID, DATE, INTEGER, DATE) TO authenticated;

-- ---------------------------------------------------------------------------
-- 12) complete_simple_setup — person_key z membership (nie z klienta)
--     Wymaga wcześniejszego claim_my_person_key (lub claim w create_household).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_simple_setup(
  p_household_id UUID,
  p_person_key TEXT,
  p_my_balance_grosze INTEGER,
  p_income_name TEXT DEFAULT NULL,
  p_income_amount_grosze INTEGER DEFAULT NULL,
  p_income_day_of_month INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_member_person TEXT;
  v_person TEXT;
  v_acc_slot TEXT;
  v_partner_acc_slot TEXT;
  v_inc_slot TEXT;
  v_partner_owner TEXT;
  v_my_name TEXT;
  v_partner_name TEXT;
  v_day INT;
  v_next DATE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_household_member(p_household_id) THEN
    RAISE EXCEPTION 'Not a household member';
  END IF;

  PERFORM 1 FROM public.households WHERE id = p_household_id FOR UPDATE;

  SELECT person_key INTO v_member_person
  FROM public.household_members
  WHERE household_id = p_household_id AND user_id = v_uid
  FOR UPDATE;

  IF v_member_person IS NULL OR v_member_person NOT IN ('pawel', 'milena') THEN
    RAISE EXCEPTION 'Membership person_key must be pawel or milena before setup';
  END IF;

  -- Odrzuć spoofing: klient nie może podać cudzego person_key
  IF p_person_key IS NOT NULL
     AND lower(trim(p_person_key)) IS DISTINCT FROM v_member_person THEN
    RAISE EXCEPTION 'person_key does not match membership';
  END IF;

  v_person := v_member_person;
  -- NIE UPDATE household_members.person_key — membership już ustawione (claim).

  IF v_person = 'pawel' THEN
    v_acc_slot := 'primary_pawel';
    v_partner_acc_slot := 'primary_milena';
    v_inc_slot := 'primary_income_pawel';
    v_partner_owner := 'milena';
    v_my_name := 'Konto Pawła';
    v_partner_name := 'Konto Mileny';
  ELSE
    v_acc_slot := 'primary_milena';
    v_partner_acc_slot := 'primary_pawel';
    v_inc_slot := 'primary_income_milena';
    v_partner_owner := 'pawel';
    v_my_name := 'Konto Mileny';
    v_partner_name := 'Konto Pawła';
  END IF;

  INSERT INTO public.accounts (
    household_id, name, owner_key, account_type,
    opening_balance_grosze, include_in_budget, active, setup_slot
  ) VALUES (
    p_household_id, v_my_name, v_person, 'personal',
    GREATEST(0, COALESCE(p_my_balance_grosze, 0)), true, true, v_acc_slot
  )
  ON CONFLICT (household_id, setup_slot) WHERE setup_slot IS NOT NULL
  DO UPDATE SET
    opening_balance_grosze = EXCLUDED.opening_balance_grosze,
    name = EXCLUDED.name,
    include_in_budget = true,
    active = true,
    updated_at = now();

  INSERT INTO public.accounts (
    household_id, name, owner_key, account_type,
    opening_balance_grosze, include_in_budget, active, setup_slot
  ) VALUES (
    p_household_id, v_partner_name, v_partner_owner, 'personal',
    0, true, true, v_partner_acc_slot
  )
  ON CONFLICT (household_id, setup_slot) WHERE setup_slot IS NOT NULL
  DO NOTHING;

  UPDATE public.accounts
  SET include_in_budget = false, active = false, updated_at = now()
  WHERE household_id = p_household_id
    AND owner_key = 'shared'
    AND name IN ('Główne konto', 'Konto wspólne');

  IF p_income_name IS NOT NULL
     AND length(trim(p_income_name)) > 0
     AND COALESCE(p_income_amount_grosze, 0) > 0 THEN
    v_day := GREATEST(1, LEAST(28, COALESCE(p_income_day_of_month, 1)));
    v_next := make_date(
      EXTRACT(YEAR FROM timezone('Europe/Warsaw', now()))::int,
      EXTRACT(MONTH FROM timezone('Europe/Warsaw', now()))::int,
      v_day
    );
    IF v_next < (timezone('Europe/Warsaw', now()))::date THEN
      v_next := (v_next + INTERVAL '1 month')::date;
    END IF;

    INSERT INTO public.income_sources (
      household_id, name, owner_key,
      typical_amount_grosze, safe_amount_grosze,
      frequency, day_of_month, next_occurrence_date,
      confidence, active, note, setup_slot
    ) VALUES (
      p_household_id, trim(p_income_name), v_person,
      p_income_amount_grosze, p_income_amount_grosze,
      'monthly_on_day', v_day, v_next,
      'expected', true, 'simple_setup', v_inc_slot
    )
    ON CONFLICT (household_id, setup_slot) WHERE setup_slot IS NOT NULL
    DO UPDATE SET
      name = EXCLUDED.name,
      typical_amount_grosze = EXCLUDED.typical_amount_grosze,
      safe_amount_grosze = EXCLUDED.safe_amount_grosze,
      day_of_month = EXCLUDED.day_of_month,
      next_occurrence_date = EXCLUDED.next_occurrence_date,
      active = true,
      updated_at = now();
  END IF;

  UPDATE public.households
  SET
    initial_setup_done = true,
    budget_started_date = COALESCE(
      budget_started_date,
      date_trunc('month', timezone('Europe/Warsaw', now()))::date
    ),
    updated_at = now()
  WHERE id = p_household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_simple_setup(UUID, TEXT, INTEGER, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_simple_setup(UUID, TEXT, INTEGER, TEXT, INTEGER, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- 13) Wariant B — invitation / remove / reset (owner-only, ochrona ownerów)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_invitation(
  p_household_id UUID,
  p_days_valid INTEGER DEFAULT 7
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_household_owner(p_household_id) THEN
    RAISE EXCEPTION 'Only owner can invite';
  END IF;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  INSERT INTO public.household_invitations (household_id, code, created_by, expires_at)
  VALUES (
    p_household_id, v_code, v_uid,
    now() + make_interval(days => GREATEST(1, LEAST(COALESCE(p_days_valid, 7), 30)))
  );
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.create_invitation(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_invitation(UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_household_member(
  p_household_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_target_role TEXT;
  v_owner_count INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_household_owner(p_household_id) THEN
    RAISE EXCEPTION 'Only owner can remove members';
  END IF;
  IF p_user_id = v_uid THEN
    RAISE EXCEPTION 'Cannot remove yourself';
  END IF;

  SELECT role INTO v_target_role
  FROM public.household_members
  WHERE household_id = p_household_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  -- Member nie może usuwać ownera (caller i tak musi być ownerem — tu chronimy target).
  -- Ostatni owner: usuwanie jakiegokolwiek ownera jest zabronione.
  IF v_target_role = 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count
    FROM public.household_members
    WHERE household_id = p_household_id AND role = 'owner';

    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last owner';
    END IF;
    RAISE EXCEPTION 'Cannot remove an owner';
  END IF;

  DELETE FROM public.household_members
  WHERE household_id = p_household_id AND user_id = p_user_id;

  INSERT INTO public.audit_logs (household_id, user_id, action, entity_type, entity_id, details)
  VALUES (
    p_household_id, v_uid, 'remove_member', 'household_member', p_user_id,
    jsonb_build_object('removed_user_id', p_user_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.remove_household_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_household_member(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_household_budget(p_household_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_household_owner(p_household_id) THEN
    RAISE EXCEPTION 'Only owner can reset household';
  END IF;

  PERFORM 1 FROM public.households WHERE id = p_household_id FOR UPDATE;

  DELETE FROM public.transactions WHERE household_id = p_household_id;
  DELETE FROM public.income_sources WHERE household_id = p_household_id;
  DELETE FROM public.recurring_bills WHERE household_id = p_household_id;
  DELETE FROM public.savings_goals WHERE household_id = p_household_id;
  DELETE FROM public.classification_rules WHERE household_id = p_household_id;
  DELETE FROM public.receipts WHERE household_id = p_household_id;
  DELETE FROM public.accounts WHERE household_id = p_household_id;

  INSERT INTO public.accounts (
    household_id, name, owner_key, account_type,
    opening_balance_grosze, include_in_budget, active
  ) VALUES (
    p_household_id, 'Główne konto', 'shared', 'shared', 0, true, true
  );

  UPDATE public.households
  SET
    safety_buffer_grosze = 0,
    initial_setup_done = false,
    budget_started_date = NULL,
    updated_at = now()
  WHERE id = p_household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_household_budget(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_household_budget(UUID) TO authenticated;

COMMIT;
