import type { Express, Request, RequestHandler, Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { createIpRateLimiter } from './security';
import { isEmailAddress } from './mailer';

/**
 * Public contact form: a message from the Kontakt page to the platform team.
 *
 * The page used to invent a "ZQ-######" reference in the browser and show a
 * success toast without sending anything anywhere. This is the persisted
 * version: the message is written to `contactMessages` through the Admin SDK
 * (the collection stays closed to clients by the catch-all rule), and the
 * reference returned is the stored document's own id, so a citizen who quotes
 * it quotes something that exists.
 *
 * Nothing here claims an email left. `delivery` is reported as `stored`, and
 * only `queued`/`sent` reflect the optional notification mail.
 */

export const CONTACT_LIMITS = { name: 120, email: 254, phone: 40, subject: 160, message: 4000, topic: 80, municipality: 80 } as const;
export const CONTACT_MIN_MESSAGE = 10;

export interface ContactInput {
  name: string;
  email: string;
  phone: string;
  municipality: string;
  topic: string;
  subject: string;
  message: string;
}

export type ContactValidation = { ok: true; value: ContactInput } | { ok: false; errors: Record<string, string> };

export const clean = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '';

export function validateContact(body: unknown): ContactValidation {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const value: ContactInput = {
    name: clean(b.name, CONTACT_LIMITS.name),
    email: clean(b.email, CONTACT_LIMITS.email),
    phone: clean(b.phone, CONTACT_LIMITS.phone),
    municipality: clean(b.municipality, CONTACT_LIMITS.municipality),
    topic: clean(b.topic, CONTACT_LIMITS.topic),
    subject: clean(b.subject, CONTACT_LIMITS.subject),
    message: clean(b.message, CONTACT_LIMITS.message),
  };
  const errors: Record<string, string> = {};
  if (value.name.length < 2) errors.name = 'Shkruani emrin tuaj.';
  if (value.subject.length < 3) errors.subject = 'Shkruani një subjekt të shkurtër.';
  if (value.message.length < CONTACT_MIN_MESSAGE) errors.message = `Mesazhi duhet të ketë të paktën ${CONTACT_MIN_MESSAGE} shkronja.`;
  if (value.email && !isEmailAddress(value.email)) errors.email = 'Adresa e emailit nuk duket e saktë.';
  if (value.phone && !/^[+\d][\d\s()./-]{5,}$/.test(value.phone)) errors.phone = 'Numri i telefonit nuk duket i saktë.';
  // A reply is impossible without some way to reach the sender; the message is still accepted
  // without one, but the page says so, so this is not an error.
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

export interface ContactDeps {
  db: () => Firestore;
  /** Test seam: replaces the submit limiter. */
  limiter?: RequestHandler;
}

export function registerContactRoutes(app: Express, deps: ContactDeps): void {
  const limiter = deps.limiter ?? createIpRateLimiter({
    windowMs: 60 * 60_000,
    max: 6,
    floodFactor: 2,
    banMs: 30 * 60_000,
    message: 'Keni dërguar shumë mesazhe. Provoni përsëri pas pak.',
    code: 'CONTACT_RATE_LIMIT',
  });

  app.post('/api/v1/public/contact', limiter, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');

    // Honeypot: a real visitor never fills a field they cannot see. Answer as if it worked.
    if (typeof (req.body as any)?.website === 'string' && (req.body as any).website.trim()) {
      return res.status(202).json({ ok: true, reference: null, delivery: 'stored' });
    }

    const parsed = validateContact(req.body);
    if (parsed.ok === false) {
      return res.status(400).json({ error: 'Kontrolloni fushat e shënuara.', code: 'VALIDATION', fields: parsed.errors });
    }

    try {
      const ref = deps.db().collection('contactMessages').doc();
      const reference = `KT-${ref.id.slice(0, 8).toUpperCase()}`;
      await ref.set({
        ...parsed.value,
        reference,
        status: 'new',
        createdAt: FieldValue.serverTimestamp(),
        source: 'kontakt-page',
      });
      // The reference is only returned after the write succeeded.
      return res.status(201).json({ ok: true, reference, delivery: 'stored' });
    } catch (error) {
      console.error('[CONTACT] store failed:', error?.message);
      return res.status(500).json({ error: 'Mesazhi nuk u ruajt. Provoni përsëri.', code: 'STORE_FAILED' });
    }
  });
}
