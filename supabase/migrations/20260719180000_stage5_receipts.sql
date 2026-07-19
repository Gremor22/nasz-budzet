-- =============================================================================
-- Nasz Budżet — Etap 5: paragony, pozycje, reguły kategorii, Storage
-- File: supabase/migrations/20260719180000_stage5_receipts.sql
--
-- Wklej w Supabase → SQL Editor po migracji Etapu 2.
-- Zdjęcia: prywatny bucket `receipts`, ścieżka: {household_id}/{receipt_id}/...
-- =============================================================================

-- -----------------------------------------------------------------------------
-- receipts — metadane zdjęcia i wynik OCR / weryfikacji
-- -----------------------------------------------------------------------------
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN (
      'uploaded',
      'ocr_pending',
      'review',
      'confirmed',
      'rejected',
      'failed'
    )),
  merchant_name TEXT,
  receipt_date DATE,
  total_grosze INTEGER CHECK (total_grosze IS NULL OR total_grosze >= 0),
  currency TEXT NOT NULL DEFAULT 'PLN',
  suggested_category TEXT,
  ocr_provider TEXT,
  ocr_raw JSONB,
  ocr_error TEXT,
  transaction_id UUID REFERENCES public.transactions (id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX receipts_household_id_idx ON public.receipts (household_id);
CREATE INDEX receipts_status_idx ON public.receipts (household_id, status);

CREATE TRIGGER receipts_set_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- receipt_items — pozycje z paragonu (opcjonalny podział)
-- -----------------------------------------------------------------------------
CREATE TABLE public.receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  receipt_id UUID NOT NULL REFERENCES public.receipts (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC(12, 3) NOT NULL DEFAULT 1,
  unit_price_grosze INTEGER CHECK (unit_price_grosze IS NULL OR unit_price_grosze >= 0),
  total_grosze INTEGER NOT NULL CHECK (total_grosze >= 0),
  category_name TEXT NOT NULL DEFAULT 'Inne',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX receipt_items_receipt_id_idx ON public.receipt_items (receipt_id);

-- -----------------------------------------------------------------------------
-- classification_rules — reguły kategorii (hybrydowe: lokalne + poprawki)
-- -----------------------------------------------------------------------------
CREATE TABLE public.classification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  match_type TEXT NOT NULL DEFAULT 'contains'
    CHECK (match_type IN ('contains', 'equals', 'regex')),
  pattern TEXT NOT NULL,
  category_name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX classification_rules_household_id_idx
  ON public.classification_rules (household_id);

CREATE TRIGGER classification_rules_set_updated_at
  BEFORE UPDATE ON public.classification_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Opcjonalne powiązanie transakcji z paragonem
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS receipt_id UUID
    REFERENCES public.receipts (id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classification_rules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.classification_rules FORCE ROW LEVEL SECURITY;

CREATE POLICY receipts_select_member
  ON public.receipts FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY receipts_insert_member
  ON public.receipts FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY receipts_update_member
  ON public.receipts FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY receipts_delete_member
  ON public.receipts FOR DELETE TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY receipt_items_select_member
  ON public.receipt_items FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY receipt_items_insert_member
  ON public.receipt_items FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY receipt_items_update_member
  ON public.receipt_items FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY receipt_items_delete_member
  ON public.receipt_items FOR DELETE TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY classification_rules_select_member
  ON public.classification_rules FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY classification_rules_insert_member
  ON public.classification_rules FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY classification_rules_update_member
  ON public.classification_rules FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY classification_rules_delete_member
  ON public.classification_rules FOR DELETE TO authenticated
  USING (public.is_household_member(household_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipt_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classification_rules TO authenticated;

-- -----------------------------------------------------------------------------
-- Storage: prywatny bucket paragony
-- Ścieżka obiektu: {household_id}/{receipt_id}/{filename}
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS receipts_storage_select ON storage.objects;
DROP POLICY IF EXISTS receipts_storage_insert ON storage.objects;
DROP POLICY IF EXISTS receipts_storage_update ON storage.objects;
DROP POLICY IF EXISTS receipts_storage_delete ON storage.objects;

CREATE POLICY receipts_storage_select
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND public.is_household_member((string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY receipts_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND public.is_household_member((string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY receipts_storage_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND public.is_household_member((string_to_array(name, '/'))[1]::uuid)
  )
  WITH CHECK (
    bucket_id = 'receipts'
    AND public.is_household_member((string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY receipts_storage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND public.is_household_member((string_to_array(name, '/'))[1]::uuid)
  );
