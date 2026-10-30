/**
 * Sends email through Resend. Needs RESEND_API_KEY and EMAIL_FROM, for example
 * `SalatHub <noreply@example.com>` on the domain verified in Resend.
 */

export interface Email {
  to: string[];
  subject: string;
  text: string;
  html: string;
}

export const sendEmail = async (email: Email): Promise<void> => {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM');
  if (!apiKey || !from) throw new Error('RESEND_API_KEY and EMAIL_FROM must be set');
  if (email.to.length === 0) return;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, ...email }),
  });

  if (!response.ok) {
    throw new Error(`Resend ${response.status}: ${await response.text()}`);
  }
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/** Paragraphs plus an optional button, as both plain text and simple HTML. */
export const composeEmail = (
  to: string[],
  subject: string,
  paragraphs: string[],
  link?: { label: string; url: string }
): Email => {
  const text = [...paragraphs, ...(link ? [`${link.label}: ${link.url}`] : [])].join('\n\n');
  const html = [
    '<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">',
    ...paragraphs.map(p => `<p>${escapeHtml(p)}</p>`),
    link
      ? `<p><a href="${escapeHtml(link.url)}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;border-radius:6px;text-decoration:none">${escapeHtml(link.label)}</a></p>`
      : '',
    '</div>',
  ].join('');
  return { to, subject, text, html };
};
