-- ============================================
-- Masjid verification (PB-79)
-- ============================================
-- `listed` stays the admin's opt-in. `in_app` is what every app path reads:
-- listed, verified or inside its grace period, and not suspended. A trigger
-- recomputes it on every write, so whatever a client sends is overwritten.

-- ============================================
-- Platform admins
-- ============================================
-- Seeded by hand: INSERT INTO platform_admins (user_id) VALUES ('<auth user id>');

CREATE TABLE platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON platform_admins FROM anon, authenticated;

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated, service_role;

-- ============================================
-- Verification status, one row per masjid
-- ============================================

CREATE TABLE masjid_verifications (
  masjid_id UUID PRIMARY KEY REFERENCES masjid_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_submitted'
    CHECK (status IN ('not_submitted', 'pending', 'verified', 'rejected')),
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  grace_until TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  suspension_reason TEXT,
  suspended_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT masjid_verifications_rejection_has_reason
    CHECK (status <> 'rejected' OR nullif(btrim(rejection_reason), '') IS NOT NULL)
);

CREATE INDEX idx_masjid_verifications_pending
  ON masjid_verifications (submitted_at)
  WHERE status = 'pending';

ALTER TABLE masjid_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON masjid_verifications FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON masjid_verifications FROM authenticated;

CREATE POLICY "Members can view their masjid verification"
  ON masjid_verifications FOR SELECT TO authenticated
  USING (masjid_id = get_user_masjid_id());

CREATE POLICY "Platform admins can view all verifications"
  ON masjid_verifications FOR SELECT TO authenticated
  USING ((SELECT is_platform_admin()));

CREATE POLICY "Platform admins can view all masjid profiles"
  ON masjid_profiles FOR SELECT TO authenticated
  USING ((SELECT is_platform_admin()));

-- ============================================
-- in_app
-- ============================================

ALTER TABLE masjid_profiles ADD COLUMN in_app BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION compute_masjid_in_app()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.in_app := NEW.listed AND EXISTS (
    SELECT 1 FROM masjid_verifications v
    WHERE v.masjid_id = NEW.id
      AND v.suspended_at IS NULL
      AND (v.status = 'verified' OR v.grace_until > now())
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_compute_masjid_in_app
  BEFORE INSERT OR UPDATE ON masjid_profiles
  FOR EACH ROW EXECUTE FUNCTION compute_masjid_in_app();

-- Re-saves the profile so trg_compute_masjid_in_app picks up the new status.
-- Un-listed masjids are skipped: their in_app is false either way.
CREATE OR REPLACE FUNCTION sync_masjid_in_app()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE masjid_profiles SET listed = listed WHERE id = NEW.masjid_id AND listed;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_masjid_in_app
  AFTER UPDATE OF status, grace_until, suspended_at ON masjid_verifications
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status
    OR OLD.grace_until IS DISTINCT FROM NEW.grace_until
    OR OLD.suspended_at IS DISTINCT FROM NEW.suspended_at
  )
  EXECUTE FUNCTION sync_masjid_in_app();

CREATE OR REPLACE FUNCTION create_masjid_verification()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO masjid_verifications (masjid_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_masjid_profile_insert_verification
  AFTER INSERT ON masjid_profiles
  FOR EACH ROW EXECUTE FUNCTION create_masjid_verification();

REVOKE ALL ON FUNCTION compute_masjid_in_app() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sync_masjid_in_app() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION create_masjid_verification() FROM PUBLIC, anon, authenticated;

-- ============================================
-- Existing masjids: 30 days' grace for those already listed
-- ============================================

INSERT INTO masjid_verifications (masjid_id, grace_until)
SELECT id, CASE WHEN listed THEN now() + INTERVAL '30 days' END
FROM masjid_profiles;

UPDATE masjid_profiles SET listed = listed WHERE listed;

DROP INDEX idx_masjid_profiles_listed_coordinates;

CREATE INDEX idx_masjid_profiles_in_app_coordinates
  ON masjid_profiles (latitude, longitude)
  WHERE in_app;

COMMENT ON COLUMN masjid_profiles.listed IS
  'Admin opt-in to the Alkhairia app. The app itself reads in_app.';
COMMENT ON COLUMN masjid_profiles.in_app IS
  'listed, verified or in grace, and not suspended. Set by trg_compute_masjid_in_app only.';

-- ============================================
-- Decisions, made by platform admins
-- ============================================
-- A rejection leaves any grace period running, so a masjid that was already
-- listed can fix its documents and resubmit. Suspension is for fakes.

CREATE OR REPLACE FUNCTION decide_masjid_verification(
  p_masjid_id UUID,
  p_approve BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS masjid_verifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row masjid_verifications;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  IF NOT p_approve AND nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A rejection needs a reason' USING ERRCODE = '22023';
  END IF;

  UPDATE masjid_verifications
  SET status = CASE WHEN p_approve THEN 'verified' ELSE 'rejected' END,
      rejection_reason = CASE WHEN p_approve THEN NULL ELSE btrim(p_reason) END,
      decided_at = now(),
      decided_by = auth.uid(),
      grace_until = CASE WHEN p_approve THEN NULL ELSE grace_until END,
      updated_at = now()
  WHERE masjid_id = p_masjid_id AND status = 'pending'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Masjid is not awaiting review' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION set_masjid_suspension(
  p_masjid_id UUID,
  p_suspended BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS masjid_verifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row masjid_verifications;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  UPDATE masjid_verifications
  SET suspended_at = CASE WHEN p_suspended THEN coalesce(suspended_at, now()) END,
      suspension_reason = CASE WHEN p_suspended THEN nullif(btrim(p_reason), '') END,
      suspended_by = CASE WHEN p_suspended THEN auth.uid() END,
      updated_at = now()
  WHERE masjid_id = p_masjid_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Masjid not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION decide_masjid_verification(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION set_masjid_suspension(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION decide_masjid_verification(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION set_masjid_suspension(UUID, BOOLEAN, TEXT) TO authenticated;
