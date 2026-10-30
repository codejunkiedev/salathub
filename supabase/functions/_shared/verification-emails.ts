import { composeEmail, type Email } from './email.ts';

/** CONSOLE_URL is the SalatHub site, for example https://salathub.app. */
const verificationLink = () => {
  const base = (Deno.env.get('CONSOLE_URL') ?? '').replace(/\/+$/, '');
  return base
    ? { label: 'Open verification', url: `${base}/admin/settings/verification` }
    : undefined;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export const approvedEmail = (to: string[], masjidName: string): Email =>
  composeEmail(
    to,
    `${masjidName} is verified`,
    [
      `Assalamu alaikum. ${masjidName} has been verified by the SalatHub team.`,
      'The masjid can now be listed in the Alkhairia app, where people can find and follow it, see its posts and receive its notifications. If it is not listed yet, turn listing on in Settings → Alkhairia App.',
    ],
    verificationLink()
  );

export const rejectedEmail = (to: string[], masjidName: string, reason: string): Email =>
  composeEmail(
    to,
    `${masjidName}: verification not approved`,
    [
      `Assalamu alaikum. We couldn't verify ${masjidName} from the documents submitted.`,
      `Reason: ${reason}`,
      "Please update the documents and submit them again. The masjid's screens keep working in the meantime.",
    ],
    verificationLink()
  );

export const graceWarningEmail = (to: string[], masjidName: string, graceUntil: string): Email =>
  composeEmail(
    to,
    `Verify ${masjidName} by ${formatDate(graceUntil)} to stay in the Alkhairia app`,
    [
      'Assalamu alaikum. The SalatHub team now verifies every masjid before it appears in the Alkhairia app, so people only follow genuine masjids.',
      `${masjidName} is already listed and stays listed until ${formatDate(graceUntil)}. To stay listed after that, upload proof the masjid exists, a photo of the masjid and, if needed, a letter showing you represent it.`,
      "The masjid's screens are not affected and keep working as normal.",
    ],
    verificationLink()
  );
