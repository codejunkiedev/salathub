-- ============================================
-- Run notify-prayer-changes every minute
-- ============================================
-- With a two-minute quiet period, a five-minute schedule added up to five more
-- minutes before an alert went out.

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'notify-prayer-changes'),
  schedule := '* * * * *'
);
