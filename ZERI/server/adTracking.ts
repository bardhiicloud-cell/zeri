/**
 * Click tracking for sponsored posts.
 *
 * A sponsored post's button points at `/api/v1/ads/r/:postId`. This route reads
 * the destination from the stored post (never from the request), counts the
 * click, and redirects. Counting is honest:
 *
 *   • one click per visitor per day (a hashed visitor key + day is a document
 *     in `forumPosts/{id}/adClickers`; creating it is the guarantee);
 *   • obvious crawlers and link-preview bots are redirected but not counted;
 *   • only `https` destinations without embedded credentials are ever served.
 *
 * Only the server writes `adClicks` (the Firestore rules refuse it from the
 * browser). Impressions are the post's `viewCount`, which is already counted
 * once per signed-in account.
 *
 * The visitor key is a one-way hash of IP + user agent + day, stored only as a
 * dedup marker; it is not used to identify anyone and is not shown anywhere.
 */
import { createHash } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { adStatus } from '../src/lib/adCampaign';

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|curl|wget|python-requests|headless/i;

export function safeHttpsUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 2000) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export const isLikelyBot = (userAgent: string | undefined): boolean => !userAgent || BOT.test(userAgent);

export const dayStamp = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export function visitorKey(ip: string, userAgent: string, ms: number): string {
  return createHash('sha256').update(`${ip}|${userAgent}|${dayStamp(ms)}`).digest('hex').slice(0, 32);
}

export interface ClickResult {
  url: string | null;
  counted: boolean;
}

export async function recordAdClick(
  fs: Firestore, postId: string, input: { key: string; countable: boolean }, now: number = Date.now(),
): Promise<ClickResult> {
  if (!postId || postId.includes('/') || postId.length > 128) return { url: null, counted: false };
  const ref = fs.collection('forumPosts').doc(postId);
  return fs.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as Record<string, any> | undefined;
    if (!snap.exists || !data || data.isAd !== true || data.isHidden === true || data.deletedAt) return { url: null, counted: false };
    // An ended, not yet started or capped campaign serves nothing (src/lib/adCampaign.ts).
    if (adStatus(data, now) !== 'live') return { url: null, counted: false };
    const url = safeHttpsUrl(data.adLink);
    if (!url) return { url: null, counted: false };
    if (!input.countable) return { url, counted: false };

    const markerRef = ref.collection('adClickers').doc(`${dayStamp(now)}_${input.key}`);
    const marker = await tx.get(markerRef);
    if (marker.exists) return { url, counted: false };
    tx.create(markerRef, { at: FieldValue.serverTimestamp() });
    tx.update(ref, { adClicks: (Number(data.adClicks) || 0) + 1 });
    return { url, counted: true };
  });
}

export function registerAdRoutes(app: Express, deps: { db: () => Firestore }): void {
  app.get('/api/v1/ads/r/:postId', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const ua = String(req.headers['user-agent'] ?? '');
      const result = await recordAdClick(deps.db(), req.params.postId, {
        key: visitorKey(String(req.ip ?? ''), ua, Date.now()),
        countable: !isLikelyBot(ua),
      });
      if (!result.url) return res.status(404).type('text/plain').send('Reklama nuk është më e disponueshme.');
      return res.redirect(302, result.url);
    } catch (error) {
      console.error('[ADS] click failed:', (error as Error)?.message);
      return res.status(500).type('text/plain').send('Lidhja nuk u hap. Provoni përsëri.');
    }
  });
}
