-- ============================================
-- Verification jobs (PB-79)
-- ============================================
-- Hourly: end grace periods that have run out, which drops those masjids from
-- the app through trg_sync_masjid_in_app.
--
-- Hourly: verification-jobs deletes documents 90 days after a decision (files
-- can only be deleted through the Storage API, hence the Edge Function) and
-- sends the one-off grace warning email. Reads the Vault secrets `project_url`
-- and `verification_jobs_secret`, the latter matching VERIFICATION_JOBS_SECRET.

SELECT cron.schedule(
  'expire-verification-grace',
  '0 * * * *',
  $$
  UPDATE masjid_verifications
  SET grace_until = NULL, updated_at = now()
  WHERE grace_until <= now();
  $$
);

SELECT cron.schedule(
  'verification-jobs',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
      || '/functions/v1/verification-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-jobs-secret',
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'verification_jobs_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
