import { composeEmail, type Email } from './email.ts';

/** CONSOLE_URL is the SalatHub site, for example https://salathub.alkhairia.org. */
const billingLink = () => {
  const base = (Deno.env.get('CONSOLE_URL') ?? '').replace(/\/+$/, '');
  return base ? { label: 'Open Billing', url: `${base}/admin/settings/billing` } : undefined;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export const trialReminderEmail = (
  to: string[],
  masjidName: string,
  trialEndsAt: string,
  daysLeft: 7 | 1
): Email =>
  composeEmail(
    to,
    daysLeft === 1
      ? `${masjidName}: your SalatHub Pro trial ends tomorrow`
      : `${masjidName}: 7 days left in your SalatHub Pro trial`,
    [
      `Assalamu alaikum. ${masjidName}'s free Pro trial ends on ${formatDate(trialEndsAt)}.`,
      'To keep Pro, upgrade from the Billing page of the console. Pro includes up to 5 screens, unlimited announcements, events, posts, YouTube, weather, every theme, the Ayat & Hadith designer and moderators.',
      "If you don't upgrade, the masjid moves to the Free plan. Nothing is deleted and one screen stays live. You can upgrade at any time to bring everything back.",
    ],
    billingLink()
  );
