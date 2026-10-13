/**
 * Sending email, independent of the provider.
 *
 * The platform needs to send one kind of mail: a citizen's report forwarded to the
 * institution responsible for it. That must work without tying the product to a
 * vendor, and without a new dependency, so the three common providers are spoken to
 * over plain HTTPS with `fetch`:
 *
 *   MAIL_PROVIDER = sendgrid | mailgun | resend
 *   MAIL_API_KEY  = the provider's API key (never logged, never sent to a client)
 *   MAIL_FROM     = "Zëri i Qytetarëve <no-reply@your-domain>" (a verified sender)
 *   MAIL_REPLY_TO = optional address answers should go to
 *   MAILGUN_DOMAIN, MAILGUN_REGION (eu|us) = Mailgun only
 *
 * Nothing set means "not configured": the outbox keeps messages as `queued` and
 * the console says so honestly, instead of pretending a mail left.
 */

export type MailProvider = 'sendgrid' | 'mailgun' | 'resend';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

/**
 * One shape, not a union: the project does not enable strictNullChecks, so TypeScript
 * would not narrow a union on `ok`. When `ok` is false, `error` says why and
 * `retryable` says whether trying again can help.
 */
export interface MailResult {
  ok: boolean;
  provider: MailProvider | null;
  messageId?: string | null;
  error?: string;
  retryable?: boolean;
}

export interface Mailer {
  configured: boolean;
  provider: MailProvider | null;
  send(message: MailMessage): Promise<MailResult>;
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  headers: { get(name: string): string | null };
}>;

const TIMEOUT_MS = 10_000;

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;
export const isEmailAddress = (value: unknown): value is string => typeof value === 'string' && value.length <= 254 && EMAIL.test(value.trim());

/** "Name <a@b.c>" or "a@b.c" → both parts. */
export function parseSender(value: string): { name: string; email: string } | null {
  const match = value.trim().match(/^(?:"?([^"<]*?)"?\s*)?<([^>]+)>$/);
  if (match && isEmailAddress(match[2])) return { name: (match[1] ?? '').trim(), email: match[2].trim() };
  return isEmailAddress(value) ? { name: '', email: value.trim() } : null;
}

const NOT_CONFIGURED: Mailer = {
  configured: false,
  provider: null,
  send: async () => ({ ok: false, provider: null, error: 'Emaili automatik nuk është konfiguruar.', retryable: false }),
};

/** Build the mailer from environment variables. Anything missing or malformed → not configured. */
export function createMailerFromEnv(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: FetchLike = fetch as unknown as FetchLike
): Mailer {
  const provider = String(env.MAIL_PROVIDER ?? '').toLowerCase() as MailProvider;
  const key = String(env.MAIL_API_KEY ?? '').trim();
  const from = parseSender(String(env.MAIL_FROM ?? ''));
  if (!['sendgrid', 'mailgun', 'resend'].includes(provider) || !key || !from) return NOT_CONFIGURED;
  const mailgunDomain = String(env.MAILGUN_DOMAIN ?? '').trim();
  if (provider === 'mailgun' && !mailgunDomain) return NOT_CONFIGURED;
  const replyDefault = isEmailAddress(env.MAIL_REPLY_TO) ? String(env.MAIL_REPLY_TO).trim() : '';
  const fromHeader = from.name ? `${from.name} <${from.email}>` : from.email;

  const request = (message: MailMessage): { url: string; headers: Record<string, string>; body: string } => {
    const replyTo = message.replyTo || replyDefault;
    if (provider === 'sendgrid') {
      return {
        url: 'https://api.sendgrid.com/v3/mail/send',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: message.to }] }],
          from: from.name ? { email: from.email, name: from.name } : { email: from.email },
          ...(replyTo ? { reply_to: { email: replyTo } } : {}),
          subject: message.subject,
          content: [{ type: 'text/plain', value: message.text }],
        }),
      };
    }
    if (provider === 'resend') {
      return {
        url: 'https://api.resend.com/emails',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromHeader, to: [message.to], subject: message.subject, text: message.text, ...(replyTo ? { reply_to: replyTo } : {}) }),
      };
    }
    const host = String(env.MAILGUN_REGION ?? '').toLowerCase() === 'eu' ? 'api.eu.mailgun.net' : 'api.mailgun.net';
    const form = new URLSearchParams({ from: fromHeader, to: message.to, subject: message.subject, text: message.text });
    if (replyTo) form.set('h:Reply-To', replyTo);
    return {
      url: `https://${host}/v3/${encodeURIComponent(mailgunDomain)}/messages`,
      headers: { Authorization: `Basic ${Buffer.from(`api:${key}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    };
  };

  return {
    configured: true,
    provider,
    async send(message) {
      if (!isEmailAddress(message.to)) return { ok: false, provider, error: 'Adresa e marrësit nuk është e vlefshme.', retryable: false };
      // A header injection needs a newline; a subject never has one.
      const safe = { ...message, subject: message.subject.replace(/[\r\n]+/g, ' ').slice(0, 200) };
      const { url, headers, body } = request(safe);
      try {
        const response = await fetchImpl(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (response.ok) {
          const id = response.headers.get('x-message-id');
          let parsed: string | null = id;
          if (!parsed) {
            try { parsed = String(JSON.parse(await response.text())?.id ?? '') || null; } catch { parsed = null; }
          }
          return { ok: true, provider, messageId: parsed };
        }
        const detail = (await response.text().catch(() => '')).slice(0, 200);
        // 4xx other than rate limiting is the request's fault: retrying will not help.
        return { ok: false, provider, error: `Ofruesi ktheu ${response.status}${detail ? `: ${detail}` : ''}`, retryable: response.status === 429 || response.status >= 500 };
      } catch (error) {
        return { ok: false, provider, error: `Lidhja me ofruesin dështoi (${(error as Error)?.name ?? 'gabim'}).`, retryable: true };
      }
    },
  };
}
