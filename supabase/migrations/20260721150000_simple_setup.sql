-- Etap 7b: prosty start + reset budżetu
-- Uruchom w Supabase SQL Editor po wdrożeniu aplikacji.

ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS initial_setup_done BOOLEAN NOT NULL DEFAULT false;

-- Istniejące gospodarstwa — nie zmuszamy do kreatora (reset w aplikacji jeśli trzeba)
UPDATE public.households
SET initial_setup_done = true
WHERE initial_setup_done = false;

CREATE OR REPLACE FUNCTION public.create_household(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id UUID;
  v_uid UUID := auth.uid();
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

  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (v_household_id, v_uid, 'owner');

  INSERT INTO public.accounts (
    household_id, name, owner_key, account_type, opening_balance_grosze, include_in_budget, active
  ) VALUES (
    v_household_id, 'Główne konto', 'shared', 'shared', 0, true, true
  );

  INSERT INTO public.audit_logs (household_id, user_id, action, entity_type, entity_id, details)
  VALUES (
    v_household_id, v_uid, 'create', 'household', v_household_id,
    jsonb_build_object('name', trim(p_name))
  );

  RETURN v_household_id;
END;
$$;
