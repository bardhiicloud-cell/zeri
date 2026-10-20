import type { Express, Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { reserveReference } from './trackingIds';
import { FieldValue } from 'firebase-admin/firestore';
import { createIpRateLimiter } from './security';
import { clean, type ContactDeps } from './contactMessages';

/**
 * Citizen ideas and service feedback.
 *
 * `platformIdeas` and `platformFeedback` had no Firestore rule, so the catch-all
 * denied the browser's direct writes: every idea and every suggestion failed for
 * every visitor. They go through the server instead, like the contact form, which
 * also lets the server (not the browser) decide who the author is.
 */
export const IDEA_LIMITS = { title: 140, category: 80, problem: 2000, solution: 2000, impact: 1000, audience: 120, scope: 120 } as const;

export interface IdeaInput { title: string; category: string; problem: string; solution: string; impact: string; audience: string; scope: string }

type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

export function validateIdea(body: unknown): Result<IdeaInput> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const value: IdeaInput = {
    title: clean(b.title, IDEA_LIMITS.title),
    category: clean(b.category, IDEA_LIMITS.category),
    problem: clean(b.problem, IDEA_LIMITS.problem),
    solution: clean(b.solution, IDEA_LIMITS.solution),
    impact: clean(b.impact, IDEA_LIMITS.impact),
    audience: clean(b.audience, IDEA_LIMITS.audience),
    scope: clean(b.scope, IDEA_LIMITS.scope),
  };
  const errors: Record<string, string> = {};
  if (value.title.length < 5) errors.title = 'Titulli duhet të ketë të paktën 5 shkronja.';
  if (value.problem.length < 20) errors.problem = 'Përshkruani problemin me të paktën 20 shkronja.';
  if (value.solution.length < 20) errors.solution = 'Përshkruani zgjidhjen me të paktën 20 shkronja.';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

export function validateFeedback(body: unknown): Result<{ rating: number; feedback: string; source: string }> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const rating = Number(b.rating);
  const feedback = clean(b.feedback, 2000);
  const source = clean(b.source, 60) || 'unknown';
  const errors: Record<string, string> = {};
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = 'Zgjidhni një vlerësim nga 1 në 5.';
  if (feedback.length < 10) errors.feedback = 'Shkruani të paktën 10 shkronja.';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { rating, feedback, source } };
}


/* -------------------------------------------------------------------------- */
/* Donation applications                                                       */
/* -------------------------------------------------------------------------- */

export {
  DONATION_CATEGORIES, DONATION_MEDIA_MAX_CHARS, validateDonationApplication, type DonationApplicationInput,
} from './submissionValidation';
import { validateDonationApplication } from './submissionValidation';


export interface SubmissionDeps extends ContactDeps {
  /** Verified uid when the request carries a valid sign-in token, else null. Never trusts the body. */
  optionalUid?: (req: Request) => Promise<string | null>;
}

export function registerPublicSubmissionRoutes(app: Express, deps: SubmissionDeps): void {
  const limiter = deps.limiter ?? createIpRateLimiter({
    windowMs: 60 * 60_000,
    max: 12,
    floodFactor: 2,
    banMs: 30 * 60_000,
    message: 'Keni dërguar shumë kërkesa. Provoni përsëri pas pak.',
    code: 'SUBMISSION_RATE_LIMIT',
  });

  const store = async (collection: string, prefix: string, data: object, req: Request, res: Response) => {
    try {
      const uid = deps.optionalUid ? await deps.optionalUid(req).catch(() => null) : null;
      const ref = deps.db().collection(collection).doc();
      const reference = await reserveReference(deps.db(), { prefix, kind: collection, ownerUid: uid, randomBytes });
      await ref.set({ status: 'submitted', ...data, reference, authorId: uid, createdAt: FieldValue.serverTimestamp() });
      return res.status(201).json({ ok: true, reference });
    } catch (error) {
      console.error(`[${collection}] store failed:`, error?.message);
      return res.status(500).json({ error: 'Nuk u ruajt. Provoni përsëri.', code: 'STORE_FAILED' });
    }
  };

  app.post('/api/v1/public/ideas', limiter, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const parsed = validateIdea(req.body);
    if (parsed.ok === false) return res.status(400).json({ error: 'Kontrolloni fushat e shënuara.', code: 'VALIDATION', fields: parsed.errors });
    return store('platformIdeas', 'ID', parsed.value, req, res);
  });

  app.post('/api/v1/public/feedback', limiter, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const parsed = validateFeedback(req.body);
    if (parsed.ok === false) return res.status(400).json({ error: 'Kontrolloni fushat e shënuara.', code: 'VALIDATION', fields: parsed.errors });
    return store('platformFeedback', 'FB', parsed.value, req, res);
  });

  app.post('/api/v1/public/donation-applications', limiter, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const parsed = validateDonationApplication(req.body);
    if (parsed.ok === false) return res.status(400).json({ error: 'Kontrolloni fushat e shënuara.', code: 'VALIDATION', fields: parsed.errors });
    // Stored as `pending`: it is not shown publicly until an administrator approves it.
    return store('donationCauses', 'DN', { ...parsed.value, status: 'pending' }, req, res);
  });
}
