-- =============================================================================
-- ETAP 8 — ROLLBACK / RESTORE
-- To NIE jest pełne cofnięcie wszystkich zmian danych po migracji.
-- =============================================================================
--
-- Co ten skrypt robi:
--   A) Restore wierszy zarchiwizowanych przy deduplikacji identycznych legacy auto
--   B) Rollback SCHEMATU (funkcje, triggery, indeksy, kolumny, constraints)
--   C) Przywrócenie funkcji z przed Etapu 8 (inline; kopia: definitions_before_etap8.sql):
--      create_invitation, remove_household_member,
--      create_household, accept_invitation, set_my_person_key
--      + DROP claim_my_person_key
--
-- Czego NIE cofa:
--   • transakcji / kont / źródeł utworzonych później przez RPC sync lub setup
--   • ręcznych edycji użytkowników po migracji
--   • efektów reset_household_budget
-- Pełny powrót stanu biznesowego = zewnętrzny backup (pg_dump / Supabase backup).
--
-- Uwaga: psql \i może nie działać w Supabase SQL Editor — stąd inline definicji.
-- =============================================================================

BEGIN;

-- A) Restore dedupe (wymaga zdjęcia UNIQUE najpierw)
DROP INDEX IF EXISTS public.transactions_hh_source_occurrence_uidx;

INSERT INTO public.transactions (
  id, household_id, account_id, type, amount_grosze, txn_date,
  description, category_name, person_key, paid_by, is_shared, status,
  income_source_id, note, created_by, created_at, updated_at, receipt_id,
  occurrence_key, is_auto_generated, sync_locked, generated_by
)
SELECT
  a.id, a.household_id, a.account_id, a.type, a.amount_grosze, a.txn_date,
  a.description, a.category_name, a.person_key, a.paid_by, a.is_shared, a.status,
  a.income_source_id, a.note, a.created_by, a.created_at, a.updated_at, a.receipt_id,
  a.occurrence_key,
  COALESCE(a.is_auto_generated, false),
  COALESCE(a.sync_locked, false),
  a.generated_by
FROM maintenance.etap8_deleted_duplicate_transactions a
WHERE a.archive_reason = 'etap8_dedupe_identical_legacy_auto'
  AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = a.id);

UPDATE maintenance.etap8_deleted_duplicate_transactions
SET archive_reason = 'etap8_dedupe_identical_legacy_auto_RESTORED'
WHERE archive_reason = 'etap8_dedupe_identical_legacy_auto';

-- B) Rollback schematu (odwrotna kolejność)
DROP FUNCTION IF EXISTS public.reset_household_budget(UUID);
DROP FUNCTION IF EXISTS public.complete_simple_setup(UUID, TEXT, INTEGER, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.sync_income_source_transactions(UUID, DATE);
DROP FUNCTION IF EXISTS public.sync_income_source_transactions(UUID, DATE, INTEGER, DATE);
DROP FUNCTION IF EXISTS public.etap8_list_occurrences(TEXT, DATE, DATE, INT, DATE, DATE, DATE);
DROP FUNCTION IF EXISTS public.etap8_last_business_day(DATE);
DROP FUNCTION IF EXISTS public.claim_my_person_key(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.set_my_person_key(UUID, TEXT);
DROP FUNCTION IF EXISTS public.create_household(TEXT);
DROP FUNCTION IF EXISTS public.create_household(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.accept_invitation(TEXT);
DROP FUNCTION IF EXISTS public.accept_invitation(TEXT, TEXT, INTEGER);

DROP TRIGGER IF EXISTS transactions_same_household ON public.transactions;
DROP FUNCTION IF EXISTS public.transactions_enforce_same_household();

DROP INDEX IF EXISTS public.transactions_hh_source_occurrence_uidx;
DROP INDEX IF EXISTS public.accounts_hh_setup_slot_uidx;
DROP INDEX IF EXISTS public.income_sources_hh_setup_slot_uidx;
DROP INDEX IF EXISTS public.household_members_hh_person_uidx;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_auto_occurrence_pair_chk,
  DROP CONSTRAINT IF EXISTS transactions_generated_by_chk,
  DROP CONSTRAINT IF EXISTS transactions_auto_generated_pair_chk;

ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_setup_slot_chk;
ALTER TABLE public.income_sources DROP CONSTRAINT IF EXISTS income_sources_setup_slot_chk;

ALTER TABLE public.transactions
  DROP COLUMN IF EXISTS occurrence_key,
  DROP COLUMN IF EXISTS is_auto_generated,
  DROP COLUMN IF EXISTS sync_locked,
  DROP COLUMN IF EXISTS generated_by;

ALTER TABLE public.accounts DROP COLUMN IF EXISTS setup_slot;
ALTER TABLE public.income_sources DROP COLUMN IF EXISTS setup_slot;

-- C) Przywróć funkcje pre-etap8 (20260722190000)
--    Źródło: definitions_before_etap8.sql

CREATE OR REPLACE FUNCTION public.create_household(
  p_name TEXT,
  p_person_key TEXT DEFAULT 'pawel'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id UUID;
  v_uid UUID := auth.uid();
  v_person TEXT := lower(trim(COALESCE(p_person_key, 'pawel')));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Household name required';
  END IF;

  IF v_person NOT IN ('pawel', 'milena') THEN
    RAISE EXCEPTION 'person_key must be pawel or milena';
  END IF;

  INSERT INTO public.households (name, created_by, initial_setup_done)
  VALUES (trim(p_name), v_uid, false)
  RETURNING id INTO v_household_id;

  INSERT INTO public.household_members (household_id, user_id, role, person_key)
  VALUES (v_household_id, v_uid, 'owner', v_person);

  INSERT INTO public.audit_logs (household_id, user_id, action, entity_type, entity_id, details)
  VALUES (
    v_household_id, v_uid, 'create', 'household', v_household_id,
    jsonb_build_object('name', trim(p_name), 'person_key', v_person)
  );

  RETURN v_household_id;
END;
$$;

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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_household_owner(p_household_id) THEN
    RAISE EXCEPTION 'Only owner can invite';
  END IF;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.household_invitations (household_id, code, created_by, expires_at)
  VALUES (
    p_household_id,
    v_code,
    v_uid,
    now() + make_interval(days => GREATEST(1, LEAST(p_days_valid, 30)))
  );

  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_code TEXT,
  p_person_key TEXT DEFAULT NULL,
  p_opening_balance_grosze INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_inv public.household_invitations%ROWTYPE;
  v_person TEXT;
  v_taken TEXT;
  v_acc_name TEXT;
  v_acc_id UUID;
  v_balance INTEGER := GREATEST(0, COALESCE(p_opening_balance_grosze, 0));
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

  SELECT m.person_key INTO v_taken
  FROM public.household_members m
  WHERE m.household_id = v_inv.household_id
    AND m.person_key IN ('pawel', 'milena')
  ORDER BY m.created_at
  LIMIT 1;

  IF p_person_key IS NOT NULL AND lower(trim(p_person_key)) IN ('pawel', 'milena') THEN
    v_person := lower(trim(p_person_key));
    IF EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_id = v_inv.household_id AND person_key = v_person
    ) THEN
      RAISE EXCEPTION 'Person slot already taken';
    END IF;
  ELSE
    IF v_taken = 'pawel' THEN
      v_person := 'milena';
    ELSIF v_taken = 'milena' THEN
      v_person := 'pawel';
    ELSE
      v_person := 'milena';
    END IF;
  END IF;

  INSERT INTO public.household_members (household_id, user_id, role, person_key)
  VALUES (v_inv.household_id, v_uid, 'member', v_person);

  DELETE FROM public.household_members
  WHERE user_id = v_uid
    AND household_id <> v_inv.household_id;

  v_acc_name := CASE WHEN v_person = 'pawel' THEN 'Konto Pawła' ELSE 'Konto Mileny' END;

  SELECT id INTO v_acc_id
  FROM public.accounts
  WHERE household_id = v_inv.household_id
    AND owner_key = v_person
    AND active = true
  ORDER BY created_at
  LIMIT 1;

  IF v_acc_id IS NOT NULL THEN
    UPDATE public.accounts
    SET name = v_acc_name,
        account_type = 'personal',
        opening_balance_grosze = v_balance,
        include_in_budget = true,
        active = true
    WHERE id = v_acc_id;
  ELSE
    INSERT INTO public.accounts (
      household_id, name, owner_key, account_type,
      opening_balance_grosze, include_in_budget, active
    ) VALUES (
      v_inv.household_id, v_acc_name, v_person, 'personal',
      v_balance, true, true
    );
  END IF;

  UPDATE public.household_invitations
  SET accepted_at = now(), accepted_by = v_uid
  WHERE id = v_inv.id;

  INSERT INTO public.audit_logs (household_id, user_id, action, entity_type, entity_id, details)
  VALUES (
    v_inv.household_id, v_uid, 'accept_invitation', 'household_invitation', v_inv.id,
    jsonb_build_object('code', v_inv.code, 'person_key', v_person)
  );

  RETURN v_inv.household_id;
END;
$$;

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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_household_owner(p_household_id) THEN
    RAISE EXCEPTION 'Only owner can remove members';
  END IF;

  IF p_user_id = v_uid THEN
    RAISE EXCEPTION 'Cannot remove yourself';
  END IF;

  SELECT role INTO v_target_role
  FROM public.household_members
  WHERE household_id = p_household_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot remove owner';
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

CREATE OR REPLACE FUNCTION public.set_my_person_key(
  p_household_id UUID,
  p_person_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_person TEXT := lower(trim(p_person_key));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_person NOT IN ('pawel', 'milena') THEN
    RAISE EXCEPTION 'person_key must be pawel or milena';
  END IF;

  IF NOT public.is_household_member(p_household_id) THEN
    RAISE EXCEPTION 'Not a household member';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_household_id
      AND person_key = v_person
      AND user_id <> v_uid
  ) THEN
    RAISE EXCEPTION 'Person slot already taken';
  END IF;

  UPDATE public.household_members
  SET person_key = v_person
  WHERE household_id = p_household_id AND user_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.create_household(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_household(TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.create_invitation(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_invitation(UUID, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.accept_invitation(TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT, TEXT, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.remove_household_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_household_member(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.set_my_person_key(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_person_key(UUID, TEXT) TO authenticated;

-- Archiwum w maintenance ZOSTAWIAMY (audit). Usunięcie ręczne:
-- DROP TABLE IF EXISTS maintenance.etap8_deleted_duplicate_transactions;
-- DROP SCHEMA IF EXISTS maintenance RESTRICT;

COMMIT;
