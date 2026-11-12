-- ============================================
-- Trial reminder emails (PB-86)
-- ============================================
-- billing-jobs emails a masjid's admins 7 days and 1 day before its Pro trial
-- ends, once each; these record when each went out.
--
-- Hourly, reading the Vault secrets `project_url` and `billing_jobs_secret`,
-- the latter matching BILLING_JOBS_SECRET.

ALTER TABLE masjid_billing
  ADD COLUMN trial_reminder_7d_at TIMESTAMPTZ,
  ADD COLUMN trial_reminder_1d_at TIMESTAMPTZ;

SELECT cron.schedule(
  'billing-jobs',
  '30 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
      || '/functions/v1/billing-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-jobs-secret',
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'billing_jobs_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
