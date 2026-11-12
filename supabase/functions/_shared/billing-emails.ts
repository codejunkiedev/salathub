import { composeEmail, type Email } from './email.ts';

/** CONSOLE_URL is the SalatHub site, for example https://salathub.alkhairia.org. */
const billingLink = () => {
  const base = (Deno.env.get('CONSOLE_URL') ?? '').replace(/\/+$/, '');
  return base ? { label: 'Open Billing', url: `${base}/admin/settings/billing` } : undefined;
};

/** In the masjid's timezone, so an end late on 31 March doesn't read as 1 April. */
const formatDate = (iso: string, timeZone: string | null) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timeZone ?? 'UTC',
  });

const PRO_FEATURES =
  'Pro includes up to 5 screens, unlimited announcements, events, posts, YouTube, weather, every theme, the Ayat & Hadith designer and moderators.';

const AFTER_FREE =
  "If you don't upgrade, the masjid moves to the Free plan. Nothing is deleted and one screen stays live. You can upgrade at any time to bring everything back.";

export const trialReminderEmail = (
  to: string[],
  masjidName: string,
  trialEndsAt: string,
  timeZone: string | null,
  daysLeft: 7 | 1
): Email =>
  composeEmail(
    to,
    daysLeft === 1
      ? `${masjidName}: your SalatHub Pro trial ends tomorrow`
      : `${masjidName}: 7 days left in your SalatHub Pro trial`,
    [
      `Assalamu alaikum. ${masjidName}'s free Pro trial ends on ${formatDate(trialEndsAt, timeZone)}.`,
      `To keep Pro, upgrade from the Billing page of the console. ${PRO_FEATURES}`,
      AFTER_FREE,
    ],
    billingLink()
  );

export const grantEndingEmail = (
  to: string[],
  masjidName: string,
  grantedUntil: string,
  timeZone: string | null,
  daysLeft: 30 | 7
): Email =>
  composeEmail(
    to,
    `${masjidName}: free SalatHub Pro ends in ${daysLeft} days`,
    [
      `Assalamu alaikum. ${masjidName} has free SalatHub Pro until ${formatDate(grantedUntil, timeZone)}.`,
      `To keep Pro after that, upgrade from the Billing page of the console before then. ${PRO_FEATURES}`,
      AFTER_FREE,
    ],
    billingLink()
  );

export const exemptionExpiringEmail = (
  to: string[],
  masjidName: string,
  state: string,
  expiresAt: string,
  timeZone: string | null
): Email =>
  composeEmail(
    to,
    `${masjidName}: tax-exemption certificate expires in 30 days`,
    [
      `Assalamu alaikum. ${masjidName}'s ${state} sales tax exemption certificate expires on ${formatDate(expiresAt, timeZone)}.`,
      'After that date, sales tax is added to SalatHub charges again until a new certificate is approved. Upload the new certificate on the Billing page of the console.',
    ],
    billingLink()
  );
