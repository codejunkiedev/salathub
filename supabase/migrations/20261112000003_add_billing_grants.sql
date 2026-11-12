-- ============================================
-- Platform admin billing tools (PB-89)
-- ============================================
-- Our team can give a masjid Pro for free until a date (sponsored masjids,
-- Pakistani cards that won't go through) and extend a trial. Each change is
-- logged with who made it and why. Masjids that exist now get free Pro until
-- 31 March 2027, after Eid al-Fitr.

-- granted: free Pro from our team until granted_until, no Stripe subscription.
ALTER TABLE masjid_billing DROP CONSTRAINT masjid_billing_status_check;
ALTER TABLE masjid_billing ADD CONSTRAINT masjid_billing_status_check
  CHECK (status IN ('none', 'trial', 'active', 'payment_failed', 'cancelled', 'granted'));

ALTER TABLE masjid_billing
  ADD COLUMN granted_until TIMESTAMPTZ,
  ADD COLUMN grant_reminder_30d_at TIMESTAMPTZ,
  ADD COLUMN grant_reminder_7d_at TIMESTAMPTZ,
  ADD CONSTRAINT masjid_billing_grant_has_end
    CHECK (status <> 'granted' OR granted_until IS NOT NULL);

DROP INDEX idx_masjid_billing_expiring;
CREATE INDEX idx_masjid_billing_expiring
  ON masjid_billing (status)
  WHERE status IN ('trial', 'payment_failed', 'granted');

-- ============================================
-- Log of grants and trial extensions
-- ============================================
-- granted_by is NULL for the automatic grant to masjids that existed at launch.

CREATE TABLE masjid_billing_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  masjid_id UUID NOT NULL REFERENCES masjid_profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('pro', 'trial_extension')),
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL CHECK (nullif(btrim(reason), '') IS NOT NULL),
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_masjid_billing_grants_masjid ON masjid_billing_grants (masjid_id, created_at DESC);

ALTER TABLE masjid_billing_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON masjid_billing_grants FROM anon, authenticated;
GRANT SELECT ON masjid_billing_grants TO authenticated;

CREATE POLICY "Platform admins can view billing grants"
  ON masjid_billing_grants FOR SELECT TO authenticated
  USING ((SELECT is_platform_admin()));

-- ============================================
-- Actions, platform admins only
-- ============================================

CREATE OR REPLACE FUNCTION grant_masjid_pro(
  p_masjid_id UUID,
  p_until TIMESTAMPTZ,
  p_reason TEXT
)
RETURNS masjid_billing
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row masjid_billing;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A grant needs a reason' USING ERRCODE = '22023';
  END IF;
  IF p_until IS NULL OR p_until <= now() THEN
    RAISE EXCEPTION 'Pick a date in the future' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row FROM masjid_billing WHERE masjid_id = p_masjid_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Masjid not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.status IN ('active', 'cancelled', 'payment_failed') THEN
    RAISE EXCEPTION 'This masjid pays for Pro. Change its subscription in Stripe instead.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE masjid_billing
  SET plan = 'pro',
      status = 'granted',
      granted_until = p_until,
      grant_reminder_30d_at = NULL,
      grant_reminder_7d_at = NULL,
      updated_at = now()
  WHERE masjid_id = p_masjid_id
  RETURNING * INTO v_row;

  INSERT INTO masjid_billing_grants (masjid_id, kind, ends_at, reason, granted_by, granted_by_email)
  VALUES (p_masjid_id, 'pro', p_until, btrim(p_reason), auth.uid(), auth.jwt() ->> 'email');

  RETURN v_row;
END;
$$;

-- Extends a running trial, or starts a new one for a Free masjid that never paid.
-- A reminder already sent is only cleared if its window now lies ahead again.
CREATE OR REPLACE FUNCTION extend_masjid_trial(
  p_masjid_id UUID,
  p_days INTEGER,
  p_reason TEXT
)
RETURNS masjid_billing
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row masjid_billing;
  v_end TIMESTAMPTZ;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'An extension needs a reason' USING ERRCODE = '22023';
  END IF;
  IF p_days IS NULL OR p_days < 1 OR p_days > 365 THEN
    RAISE EXCEPTION 'Extend by 1 to 365 days' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row FROM masjid_billing WHERE masjid_id = p_masjid_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Masjid not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.status NOT IN ('trial', 'none') OR v_row.stripe_subscription_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only a masjid on a trial or on Free can have its trial extended'
      USING ERRCODE = '22023';
  END IF;

  v_end := greatest(coalesce(v_row.trial_ends_at, now()), now()) + make_interval(days => p_days);

  UPDATE masjid_billing
  SET plan = 'pro',
      status = 'trial',
      trial_ends_at = v_end,
      trial_reminder_7d_at = CASE WHEN v_end > now() + INTERVAL '7 days' THEN NULL ELSE trial_reminder_7d_at END,
      trial_reminder_1d_at = CASE WHEN v_end > now() + INTERVAL '1 day' THEN NULL ELSE trial_reminder_1d_at END,
      updated_at = now()
  WHERE masjid_id = p_masjid_id
  RETURNING * INTO v_row;

  INSERT INTO masjid_billing_grants (masjid_id, kind, ends_at, reason, granted_by, granted_by_email)
  VALUES (p_masjid_id, 'trial_extension', v_end, btrim(p_reason), auth.uid(), auth.jwt() ->> 'email');

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION grant_masjid_pro(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION extend_masjid_trial(UUID, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION grant_masjid_pro(UUID, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION extend_masjid_trial(UUID, INTEGER, TEXT) TO authenticated;

-- ============================================
-- Expiry now covers grants
-- ============================================

CREATE OR REPLACE FUNCTION expire_masjid_billing()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE masjid_billing
  SET plan = 'free',
      status = 'none',
      grace_ends_at = NULL,
      updated_at = now()
  WHERE (status = 'trial' AND trial_ends_at <= now())
     OR (status = 'payment_failed' AND grace_ends_at <= now())
     OR (status = 'granted' AND granted_until <= now());
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================
-- Masjids that exist now: free Pro until the end of 31 March 2027, their time
-- ============================================

WITH launch AS (
  UPDATE masjid_billing b
  SET plan = 'pro',
      status = 'granted',
      granted_until = ('2027-03-31 23:59:59'::timestamp AT TIME ZONE coalesce(p.timezone, 'UTC')),
      updated_at = now()
  FROM masjid_profiles p
  WHERE p.id = b.masjid_id
    AND b.status = 'none'
    AND b.stripe_subscription_id IS NULL
  RETURNING b.masjid_id, b.granted_until
)
INSERT INTO masjid_billing_grants (masjid_id, kind, ends_at, reason)
SELECT masjid_id, 'pro', granted_until,
  'Existing masjid at launch: free Pro until after Eid al-Fitr'
FROM launch;
