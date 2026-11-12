-- ============================================
-- Nonprofit tax-exemption certificates (PB-95)
-- ============================================
-- A masjid's admin uploads a certificate for a US state; our team approves or
-- rejects it with a reason through the `tax-exemptions` Edge Function, which
-- also marks the masjid's Stripe customer tax exempt while an approved,
-- unexpired certificate covers its billing state. Visible only to the masjid's
-- admins and platform admins. Admins add certificates; only our team changes them.

CREATE TABLE tax_exemption_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  masjid_id UUID NOT NULL REFERENCES masjid_profiles(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
  storage_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL
    CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  expires_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- When billing-jobs took an expired certificate out of Stripe, and warned about it.
  lapsed_at TIMESTAMPTZ,
  expiry_warned_at TIMESTAMPTZ,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tax_exemption_certificates_path_in_masjid_folder
    CHECK (split_part(storage_path, '/', 1) = masjid_id::text),
  CONSTRAINT tax_exemption_certificates_rejection_has_reason
    CHECK (status <> 'rejected' OR nullif(btrim(rejection_reason), '') IS NOT NULL)
);

CREATE INDEX idx_tax_exemption_certificates_masjid
  ON tax_exemption_certificates (masjid_id, created_at DESC);
CREATE INDEX idx_tax_exemption_certificates_pending
  ON tax_exemption_certificates (created_at)
  WHERE status = 'pending';

ALTER TABLE tax_exemption_certificates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tax_exemption_certificates FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON tax_exemption_certificates FROM authenticated;

CREATE POLICY "Admins and platform admins can view tax exemption certificates"
  ON tax_exemption_certificates FOR SELECT TO authenticated
  USING (
    (masjid_id = get_user_masjid_id() AND get_user_role() = 'admin')
    OR (SELECT is_platform_admin())
  );

CREATE POLICY "Admins can add tax exemption certificates"
  ON tax_exemption_certificates FOR INSERT TO authenticated
  WITH CHECK (
    masjid_id = get_user_masjid_id()
    AND get_user_role() = 'admin'
    AND uploaded_by = auth.uid()
    AND status = 'pending'
    AND rejection_reason IS NULL
    AND expires_at IS NULL
    AND decided_at IS NULL
    AND decided_by IS NULL
  );

-- ============================================
-- Private bucket
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tax-exemption-certificates',
  'tax-exemption-certificates',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
);

CREATE POLICY "Admins and platform admins can read tax exemption files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'tax-exemption-certificates'
    AND (
      (
        (storage.foldername(name))[1] = public.get_user_masjid_id()::text
        AND public.get_user_role() = 'admin'
      )
      OR (SELECT public.is_platform_admin())
    )
  );

CREATE POLICY "Admins can upload tax exemption files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tax-exemption-certificates'
    AND (storage.foldername(name))[1] = public.get_user_masjid_id()::text
    AND public.get_user_role() = 'admin'
  );

-- Lets the upload service remove a file whose table row failed to save.
CREATE POLICY "Admins can delete unrecorded tax exemption files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'tax-exemption-certificates'
    AND (storage.foldername(name))[1] = public.get_user_masjid_id()::text
    AND public.get_user_role() = 'admin'
    AND NOT EXISTS (
      SELECT 1 FROM public.tax_exemption_certificates c WHERE c.storage_path = name
    )
  );
