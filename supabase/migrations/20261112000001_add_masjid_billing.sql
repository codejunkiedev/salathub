-- ============================================
-- Masjid billing (PB-85)
-- ============================================
-- One row per masjid recording its plan and where its Stripe subscription
-- stands. Only service_role writes it: the `billing` and `stripe-webhook`
-- Edge Functions and the expiry job below. Masjid admins and platform admins
-- read it; moderators can't.

-- ============================================
-- Plan rules: the single definition of what each plan allows
-- ============================================
-- Console, screens and the limits in PB-87 all read this table.
-- NULL max_active_announcements means unlimited.

CREATE TABLE plan_rules (
  plan TEXT PRIMARY KEY CHECK (plan IN ('free', 'pro')),
  included_screens INTEGER NOT NULL CHECK (included_screens > 0),
  extra_screens_allowed BOOLEAN NOT NULL,
  max_active_announcements INTEGER CHECK (max_active_announcements > 0),
  features TEXT[] NOT NULL DEFAULT '{}'
);

INSERT INTO plan_rules (plan, included_screens, extra_screens_allowed, max_active_announcements, features)
VALUES
  ('free', 1, false, 3, '{}'),
  ('pro', 5, true, NULL, ARRAY[
    'events',
    'posts',
    'youtube',
    'weather',
    'all_themes',
    'ayat_hadith_designer',
    'moderators',
    'event_post_notifications',
    'follower_messages',
    'hide_badge'
  ]);

ALTER TABLE plan_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON plan_rules FROM anon, authenticated;
GRANT SELECT ON plan_rules TO authenticated;

CREATE POLICY "Signed-in users can read plan rules"
  ON plan_rules FOR SELECT TO authenticated
  USING (true);

-- ============================================
-- Billing state, one row per masjid
-- ============================================
-- status: none (Free), trial (Pro trial, no card), active (paid Pro),
-- payment_failed (Pro until grace_ends_at), cancelled (Pro until renews_at,
-- then Free).

CREATE TABLE masjid_billing (
  masjid_id UUID PRIMARY KEY REFERENCES masjid_profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' REFERENCES plan_rules(plan),
  status TEXT NOT NULL DEFAULT 'none'
    CHECK (status IN ('none', 'trial', 'active', 'payment_failed', 'cancelled')),
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency IN ('usd', 'cad', 'pkr')),
  extra_screens INTEGER NOT NULL DEFAULT 0 CHECK (extra_screens >= 0),
  trial_ends_at TIMESTAMPTZ,
  renews_at TIMESTAMPTZ,
  grace_ends_at TIMESTAMPTZ,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT masjid_billing_free_has_no_status CHECK ((plan = 'free') = (status = 'none')),
  CONSTRAINT masjid_billing_trial_has_end CHECK (status <> 'trial' OR trial_ends_at IS NOT NULL),
  CONSTRAINT masjid_billing_grace_has_end
    CHECK (status <> 'payment_failed' OR grace_ends_at IS NOT NULL)
);

CREATE INDEX idx_masjid_billing_expiring
  ON masjid_billing (status)
  WHERE status IN ('trial', 'payment_failed');

ALTER TABLE masjid_billing ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON masjid_billing FROM anon, authenticated;
GRANT SELECT ON masjid_billing TO authenticated;

CREATE POLICY "Masjid admins can view their billing"
  ON masjid_billing FOR SELECT TO authenticated
  USING (masjid_id = get_user_masjid_id() AND get_user_role() = 'admin');

CREATE POLICY "Platform admins can view all billing"
  ON masjid_billing FOR SELECT TO authenticated
  USING ((SELECT is_platform_admin()));

-- ============================================
-- Currency, from the masjid's timezone
-- ============================================
-- Pakistan pays in PKR, Canada in CAD, everyone else in USD. Fixed once the
-- masjid has a Stripe customer, since Stripe locks a customer's currency.

CREATE OR REPLACE FUNCTION billing_currency_for_timezone(p_timezone TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT CASE
    WHEN p_timezone = 'Asia/Karachi' THEN 'pkr'
    WHEN p_timezone LIKE 'Canada/%' OR p_timezone IN (
      'America/St_Johns', 'America/Halifax', 'America/Glace_Bay', 'America/Moncton',
      'America/Goose_Bay', 'America/Blanc-Sablon', 'America/Toronto', 'America/Montreal',
      'America/Nipigon', 'America/Thunder_Bay', 'America/Iqaluit', 'America/Pangnirtung',
      'America/Atikokan', 'America/Winnipeg', 'America/Rainy_River', 'America/Resolute',
      'America/Rankin_Inlet', 'America/Regina', 'America/Swift_Current', 'America/Edmonton',
      'America/Cambridge_Bay', 'America/Yellowknife', 'America/Inuvik', 'America/Creston',
      'America/Dawson_Creek', 'America/Fort_Nelson', 'America/Whitehorse', 'America/Dawson',
      'America/Vancouver'
    ) THEN 'cad'
    ELSE 'usd'
  END;
$$;

-- New masjids start a 30-day Pro trial.
CREATE OR REPLACE FUNCTION create_masjid_billing()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO masjid_billing (masjid_id, plan, status, trial_ends_at, currency)
  VALUES (
    NEW.id, 'pro', 'trial', now() + INTERVAL '30 days',
    billing_currency_for_timezone(NEW.timezone)
  )
  ON CONFLICT DO NOTHING;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_masjid_profile_insert_billing
  AFTER INSERT ON masjid_profiles
  FOR EACH ROW EXECUTE FUNCTION create_masjid_billing();

CREATE OR REPLACE FUNCTION sync_masjid_billing_currency()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE masjid_billing
  SET currency = billing_currency_for_timezone(NEW.timezone), updated_at = now()
  WHERE masjid_id = NEW.id
    AND stripe_customer_id IS NULL
    AND currency IS DISTINCT FROM billing_currency_for_timezone(NEW.timezone);
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_masjid_profile_timezone_billing
  AFTER UPDATE OF timezone ON masjid_profiles
  FOR EACH ROW
  WHEN (OLD.timezone IS DISTINCT FROM NEW.timezone)
  EXECUTE FUNCTION sync_masjid_billing_currency();

REVOKE ALL ON FUNCTION create_masjid_billing() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sync_masjid_billing_currency() FROM PUBLIC, anon, authenticated;

-- Masjids that exist now start on Free with no trial; PB-89 gives them free
-- Pro until 31 March 2027.
INSERT INTO masjid_billing (masjid_id, currency)
SELECT id, billing_currency_for_timezone(timezone)
FROM masjid_profiles
ON CONFLICT DO NOTHING;

-- ============================================
-- Stripe webhook events already handled
-- ============================================
-- Lets stripe-webhook skip a redelivered event. No client role can reach it.

CREATE TABLE stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stripe_events FROM anon, authenticated;

-- ============================================
-- Trial and grace expiry
-- ============================================
-- A trial without a payment, or a grace period after a failed payment, ends
-- on Free. A later successful payment brings Pro back through the webhook.

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
     OR (status = 'payment_failed' AND grace_ends_at <= now());
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION expire_masjid_billing() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION expire_masjid_billing() TO service_role;

SELECT cron.schedule('expire-masjid-billing', '*/5 * * * *', $$SELECT expire_masjid_billing();$$);
