-- ============================================
-- Verification documents (PB-79)
-- ============================================
-- Private to the masjid's admins and platform admins. Uploads and deletes are
-- open only while the masjid has not submitted or was rejected, so a document
-- can't change under a reviewer.

CREATE TABLE verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  masjid_id UUID NOT NULL REFERENCES masjid_profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('existence', 'representation', 'photo')),
  storage_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL
    CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT verification_documents_path_in_masjid_folder
    CHECK (split_part(storage_path, '/', 1) = masjid_id::text)
);

CREATE INDEX idx_verification_documents_masjid
  ON verification_documents (masjid_id, created_at);

CREATE OR REPLACE FUNCTION can_edit_verification_documents(p_masjid_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_masjid_id = get_user_masjid_id()
    AND get_user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM masjid_verifications v
      WHERE v.masjid_id = p_masjid_id
        AND v.status IN ('not_submitted', 'rejected')
    );
$$;

REVOKE ALL ON FUNCTION can_edit_verification_documents(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION can_edit_verification_documents(UUID) TO authenticated;

ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON verification_documents FROM anon;
REVOKE UPDATE, TRUNCATE ON verification_documents FROM authenticated;

CREATE POLICY "Admins and platform admins can view verification documents"
  ON verification_documents FOR SELECT TO authenticated
  USING (
    (masjid_id = get_user_masjid_id() AND get_user_role() = 'admin')
    OR (SELECT is_platform_admin())
  );

CREATE POLICY "Admins can add verification documents"
  ON verification_documents FOR INSERT TO authenticated
  WITH CHECK (can_edit_verification_documents(masjid_id) AND uploaded_by = auth.uid());

CREATE POLICY "Admins can remove verification documents"
  ON verification_documents FOR DELETE TO authenticated
  USING (can_edit_verification_documents(masjid_id));

-- ============================================
-- Private bucket
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verification-documents',
  'verification-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
);

CREATE POLICY "Admins and platform admins can read verification files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND (
      (
        (storage.foldername(name))[1] = public.get_user_masjid_id()::text
        AND public.get_user_role() = 'admin'
      )
      OR (SELECT public.is_platform_admin())
    )
  );

CREATE POLICY "Admins can upload verification files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] = public.get_user_masjid_id()::text
    AND public.can_edit_verification_documents(public.get_user_masjid_id())
  );

CREATE POLICY "Admins can delete verification files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] = public.get_user_masjid_id()::text
    AND public.can_edit_verification_documents(public.get_user_masjid_id())
  );

-- ============================================
-- Submitting for review
-- ============================================
-- The representation letter is optional: it isn't needed when the applicant
-- is named on the proof of existence.

CREATE OR REPLACE FUNCTION submit_masjid_verification()
RETURNS masjid_verifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_masjid_id UUID := get_user_masjid_id();
  v_row masjid_verifications;
BEGIN
  IF v_masjid_id IS NULL OR get_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM verification_documents WHERE masjid_id = v_masjid_id AND kind = 'existence'
  ) OR NOT EXISTS (
    SELECT 1 FROM verification_documents WHERE masjid_id = v_masjid_id AND kind = 'photo'
  ) THEN
    RAISE EXCEPTION 'Upload proof the masjid exists and a photo of the masjid'
      USING ERRCODE = '22023';
  END IF;

  UPDATE masjid_verifications
  SET status = 'pending',
      submitted_at = now(),
      rejection_reason = NULL,
      updated_at = now()
  WHERE masjid_id = v_masjid_id AND status IN ('not_submitted', 'rejected')
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Already submitted' USING ERRCODE = '55000';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION submit_masjid_verification() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_masjid_verification() TO authenticated;

-- ============================================
-- 90-day purge
-- ============================================
-- Documents from a decided submission, 90 days after the decision. Files added
-- after the decision belong to a resubmission and stay. The decision itself is
-- kept on masjid_verifications.

CREATE OR REPLACE FUNCTION list_purgeable_verification_documents(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (id UUID, storage_path TEXT)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT d.id, d.storage_path
  FROM verification_documents d
  JOIN masjid_verifications v ON v.masjid_id = d.masjid_id
  WHERE v.status IN ('verified', 'rejected')
    AND v.decided_at < now() - INTERVAL '90 days'
    AND d.created_at <= v.decided_at
  ORDER BY d.created_at
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

REVOKE ALL ON FUNCTION list_purgeable_verification_documents(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION list_purgeable_verification_documents(INTEGER) TO service_role;
