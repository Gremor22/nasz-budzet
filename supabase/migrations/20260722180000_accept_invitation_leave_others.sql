-- Po dołączeniu kodem: użytkownik zostaje tylko w nowym gospodarstwie
-- (wcześniej stare puste gospodarstwo wygrywało przy kolejnym logowaniu).

CREATE OR REPLACE FUNCTION public.accept_invitation(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_inv public.household_invitations%ROWTYPE;
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

  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (v_inv.household_id, v_uid, 'member');

  -- Jedno aktywne gospodarstwo: odejdź z pozostałych (np. puste testowe)
  DELETE FROM public.household_members
  WHERE user_id = v_uid
    AND household_id <> v_inv.household_id;

  UPDATE public.household_invitations
  SET accepted_at = now(), accepted_by = v_uid
  WHERE id = v_inv.id;

  INSERT INTO public.audit_logs (household_id, user_id, action, entity_type, entity_id, details)
  VALUES (
    v_inv.household_id, v_uid, 'accept_invitation', 'household_invitation', v_inv.id,
    jsonb_build_object('code', v_inv.code)
  );

  RETURN v_inv.household_id;
END;
$$;
