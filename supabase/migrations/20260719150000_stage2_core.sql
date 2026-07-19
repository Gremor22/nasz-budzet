-- =============================================================================
-- Nasz Budżet — Etap 2 migration
-- File: supabase/migrations/20260719150000_stage2_core.sql
--
-- Kwoty: zawsze integer grosze (1 zł = 100).
-- RLS: włączone na KAŻDEJ tabeli używanej przez aplikację.
-- Uprawnienia: authenticated (nie service_role w przeglądarce).
-- Automatically expose new tables = OFF → jawne GRANT poniżej.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Wspólna funkcja updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- profiles — profil użytkownika (1:1 z auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Automatyczny profil po rejestracji
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1), 'Użytkownik')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- households — gospodarstwo domowe
-- -----------------------------------------------------------------------------
CREATE TABLE public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  safety_buffer_grosze INTEGER NOT NULL DEFAULT 0 CHECK (safety_buffer_grosze >= 0),
  default_forecast_mode TEXT NOT NULL DEFAULT 'realistic'
    CHECK (default_forecast_mode IN ('cautious', 'realistic', 'full')),
  default_horizon_days INTEGER NOT NULL DEFAULT 14
    CHECK (default_horizon_days > 0 AND default_horizon_days <= 365),
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER households_set_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- household_members — kto należy do gospodarstwa
-- -----------------------------------------------------------------------------
CREATE TABLE public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  person_key TEXT CHECK (person_key IS NULL OR person_key IN ('pawel', 'milena', 'shared')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id)
);

CREATE INDEX household_members_user_id_idx ON public.household_members (user_id);
CREATE INDEX household_members_household_id_idx ON public.household_members (household_id);

CREATE TRIGGER household_members_set_updated_at
  BEFORE UPDATE ON public.household_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- household_invitations — zaproszenia kodem
-- -----------------------------------------------------------------------------
CREATE TABLE public.household_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT household_invitations_code_unique UNIQUE (code)
);

CREATE INDEX household_invitations_household_id_idx
  ON public.household_invitations (household_id);

CREATE TRIGGER household_invitations_set_updated_at
  BEFORE UPDATE ON public.household_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Helper RLS: czy bieżący użytkownik jest członkiem gospodarstwa?
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_household_member(p_household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members m
    WHERE m.household_id = p_household_id
      AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_household_owner(p_household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members m
    WHERE m.household_id = p_household_id
      AND m.user_id = auth.uid()
      AND m.role = 'owner'
  );
$$;

REVOKE ALL ON FUNCTION public.is_household_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_household_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_household_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_owner(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- accounts — konta pieniężne (ręczne, bez banku)
-- -----------------------------------------------------------------------------
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  owner_key TEXT NOT NULL DEFAULT 'shared'
    CHECK (owner_key IN ('pawel', 'milena', 'shared')),
  account_type TEXT NOT NULL DEFAULT 'shared'
    CHECK (account_type IN ('shared', 'personal', 'savings', 'cash', 'other')),
  opening_balance_grosze INTEGER NOT NULL DEFAULT 0,
  include_in_budget BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX accounts_household_id_idx ON public.accounts (household_id);

CREATE TRIGGER accounts_set_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- categories — kategorie hierarchiczne
-- -----------------------------------------------------------------------------
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.categories (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX categories_household_id_idx ON public.categories (household_id);
CREATE INDEX categories_parent_id_idx ON public.categories (parent_id);

CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- income_sources — źródła dochodu cyklicznego
-- -----------------------------------------------------------------------------
CREATE TABLE public.income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  owner_key TEXT NOT NULL CHECK (owner_key IN ('pawel', 'milena')),
  typical_amount_grosze INTEGER NOT NULL CHECK (typical_amount_grosze >= 0),
  safe_amount_grosze INTEGER NOT NULL CHECK (safe_amount_grosze >= 0),
  frequency TEXT NOT NULL
    CHECK (frequency IN (
      'once', 'weekly', 'biweekly', 'monthly',
      'monthly_on_day', 'last_business_day', 'irregular'
    )),
  day_of_month INTEGER CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31)),
  next_occurrence_date DATE NOT NULL,
  end_date DATE,
  confidence TEXT NOT NULL DEFAULT 'expected'
    CHECK (confidence IN ('confirmed', 'expected', 'forecast')),
  active BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX income_sources_household_id_idx ON public.income_sources (household_id);

CREATE TRIGGER income_sources_set_updated_at
  BEFORE UPDATE ON public.income_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- recurring_bills — rachunki cykliczne
-- -----------------------------------------------------------------------------
CREATE TABLE public.recurring_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount_grosze INTEGER NOT NULL CHECK (amount_grosze >= 0),
  frequency TEXT NOT NULL
    CHECK (frequency IN (
      'once', 'weekly', 'biweekly', 'monthly',
      'monthly_on_day', 'last_business_day', 'irregular'
    )),
  day_of_month INTEGER CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31)),
  next_occurrence_date DATE NOT NULL,
  end_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'reserved', 'paid', 'cancelled', 'uncertain')),
  paid_by TEXT NOT NULL DEFAULT 'shared'
    CHECK (paid_by IN ('pawel', 'milena', 'shared')),
  category_name TEXT NOT NULL DEFAULT 'Dom',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX recurring_bills_household_id_idx ON public.recurring_bills (household_id);

CREATE TRIGGER recurring_bills_set_updated_at
  BEFORE UPDATE ON public.recurring_bills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- transactions — wpływy i wydatki
-- -----------------------------------------------------------------------------
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts (id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  amount_grosze INTEGER NOT NULL CHECK (amount_grosze >= 0),
  txn_date DATE NOT NULL,
  description TEXT NOT NULL,
  category_name TEXT NOT NULL DEFAULT 'Inne',
  person_key TEXT NOT NULL DEFAULT 'shared'
    CHECK (person_key IN ('pawel', 'milena', 'shared')),
  paid_by TEXT NOT NULL DEFAULT 'shared'
    CHECK (paid_by IN ('pawel', 'milena', 'shared')),
  is_shared BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'paid'
    CHECK (status IN ('planned', 'reserved', 'paid', 'cancelled', 'uncertain')),
  income_source_id UUID REFERENCES public.income_sources (id) ON DELETE SET NULL,
  note TEXT,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX transactions_household_id_idx ON public.transactions (household_id);
CREATE INDEX transactions_txn_date_idx ON public.transactions (household_id, txn_date);

CREATE TRIGGER transactions_set_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- savings_goals — cele oszczędnościowe
-- -----------------------------------------------------------------------------
CREATE TABLE public.savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount_grosze INTEGER NOT NULL CHECK (target_amount_grosze >= 0),
  saved_amount_grosze INTEGER NOT NULL DEFAULT 0 CHECK (saved_amount_grosze >= 0),
  reserved BOOLEAN NOT NULL DEFAULT false,
  owner_key TEXT NOT NULL DEFAULT 'shared'
    CHECK (owner_key IN ('pawel', 'milena', 'shared')),
  deadline DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX savings_goals_household_id_idx ON public.savings_goals (household_id);

CREATE TRIGGER savings_goals_set_updated_at
  BEFORE UPDATE ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- audit_logs — kto co zmienił (uproszczony)
-- -----------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_household_id_idx ON public.audit_logs (household_id);

-- =============================================================================
-- ROW LEVEL SECURITY — włączone na każdej tabeli aplikacji
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Wymuszenie RLS także dla właściciela tabeli (bezpieczniej)
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.households FORCE ROW LEVEL SECURITY;
ALTER TABLE public.household_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.household_invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.income_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_bills FORCE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

-- ----- profiles -----
CREATE POLICY profiles_select_own_or_household
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.household_members me
      JOIN public.household_members other
        ON me.household_id = other.household_id
      WHERE me.user_id = auth.uid()
        AND other.user_id = profiles.id
    )
  );

CREATE POLICY profiles_update_own
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Insert profilu robi trigger SECURITY DEFINER — brak INSERT dla authenticated

-- ----- households -----
CREATE POLICY households_select_member
  ON public.households FOR SELECT TO authenticated
  USING (public.is_household_member(id));

CREATE POLICY households_update_member
  ON public.households FOR UPDATE TO authenticated
  USING (public.is_household_member(id))
  WITH CHECK (public.is_household_member(id));

-- Insert gospodarstwa tylko przez funkcję create_household (SECURITY DEFINER)

-- ----- household_members -----
CREATE POLICY household_members_select_same_hh
  ON public.household_members FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

-- Insert/delete członkostwa przez funkcje SECURITY DEFINER (create/accept)

-- ----- household_invitations -----
CREATE POLICY invitations_select_member
  ON public.household_invitations FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY invitations_insert_member
  ON public.household_invitations FOR INSERT TO authenticated
  WITH CHECK (
    public.is_household_member(household_id)
    AND created_by = auth.uid()
  );

CREATE POLICY invitations_update_member
  ON public.household_invitations FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

-- ----- accounts -----
CREATE POLICY accounts_select_member
  ON public.accounts FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY accounts_insert_member
  ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY accounts_update_member
  ON public.accounts FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY accounts_delete_member
  ON public.accounts FOR DELETE TO authenticated
  USING (public.is_household_member(household_id));

-- ----- categories -----
CREATE POLICY categories_select_member
  ON public.categories FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY categories_insert_member
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY categories_update_member
  ON public.categories FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY categories_delete_member
  ON public.categories FOR DELETE TO authenticated
  USING (public.is_household_member(household_id));

-- ----- income_sources -----
CREATE POLICY income_sources_select_member
  ON public.income_sources FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY income_sources_insert_member
  ON public.income_sources FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY income_sources_update_member
  ON public.income_sources FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY income_sources_delete_member
  ON public.income_sources FOR DELETE TO authenticated
  USING (public.is_household_member(household_id));

-- ----- recurring_bills -----
CREATE POLICY recurring_bills_select_member
  ON public.recurring_bills FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY recurring_bills_insert_member
  ON public.recurring_bills FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY recurring_bills_update_member
  ON public.recurring_bills FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY recurring_bills_delete_member
  ON public.recurring_bills FOR DELETE TO authenticated
  USING (public.is_household_member(household_id));

-- ----- transactions -----
CREATE POLICY transactions_select_member
  ON public.transactions FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY transactions_insert_member
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY transactions_update_member
  ON public.transactions FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY transactions_delete_member
  ON public.transactions FOR DELETE TO authenticated
  USING (public.is_household_member(household_id));

-- ----- savings_goals -----
CREATE POLICY savings_goals_select_member
  ON public.savings_goals FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY savings_goals_insert_member
  ON public.savings_goals FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY savings_goals_update_member
  ON public.savings_goals FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY savings_goals_delete_member
  ON public.savings_goals FOR DELETE TO authenticated
  USING (public.is_household_member(household_id));

-- ----- audit_logs -----
CREATE POLICY audit_logs_select_member
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY audit_logs_insert_member
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (
    public.is_household_member(household_id)
    AND (user_id IS NULL OR user_id = auth.uid())
  );
-- Brak UPDATE/DELETE dla audit_logs (append-only)

-- =============================================================================
-- RPC: utworzenie gospodarstwa + właściciel (omija problem „kurczak-jajko” RLS)
-- =============================================================================
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

  INSERT INTO public.households (name, created_by)
  VALUES (trim(p_name), v_uid)
  RETURNING id INTO v_household_id;

  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (v_household_id, v_uid, 'owner');

  INSERT INTO public.accounts (
    household_id, name, owner_key, account_type, opening_balance_grosze, include_in_budget, active
  ) VALUES (
    v_household_id, 'Konto wspólne', 'shared', 'shared', 0, true, true
  );

  INSERT INTO public.audit_logs (household_id, user_id, action, entity_type, entity_id, details)
  VALUES (
    v_household_id, v_uid, 'create', 'household', v_household_id,
    jsonb_build_object('name', trim(p_name))
  );

  RETURN v_household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_household(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_household(TEXT) TO authenticated;

-- =============================================================================
-- RPC: utworzenie zaproszenia (kod 8 znaków)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_invitation(p_household_id UUID, p_days_valid INTEGER DEFAULT 7)
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

  IF NOT public.is_household_member(p_household_id) THEN
    RAISE EXCEPTION 'Not a household member';
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

REVOKE ALL ON FUNCTION public.create_invitation(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_invitation(UUID, INTEGER) TO authenticated;

-- =============================================================================
-- RPC: akceptacja zaproszenia po kodzie
-- =============================================================================
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

REVOKE ALL ON FUNCTION public.accept_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;

-- =============================================================================
-- GRANT — Data API z wyłączonym auto-expose wymaga jawnych uprawnień
-- anon: brak dostępu do tabel finansowych (tylko Auth signup/login)
-- authenticated: CRUD ograniczone przez RLS
-- =============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, UPDATE ON public.households TO authenticated;
GRANT SELECT ON public.household_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.household_invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_bills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_goals TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;

-- Brak GRANT dla roli anon na tabelach finansowych (świadomie).
