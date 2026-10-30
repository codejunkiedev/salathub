-- ============================================
-- Verification jobs (PB-79)
-- ============================================
-- Hourly: end grace periods that have run out, which drops those masjids from
-- the app through trg_sync_masjid_in_app.
--
-- Daily: purge-verification-documents deletes files 90 days after a decision.
-- Storage files can only be deleted through the Storage API, hence the Edge
-- Function. Reads the Vault secrets `project_url` and
-- `verification_purge_secret`, the latter matching VERIFICATION_PURGE_SECRET.

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
  'purge-verification-documents',
  '30 3 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
      || '/functions/v1/purge-verification-documents',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-purge-secret',
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'verification_purge_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
