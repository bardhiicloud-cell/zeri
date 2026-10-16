import { collection, doc, getDocFromServer, getDocsFromServer, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { apiReady, markApiUnavailable } from './apiAvailability';
import { ensureReportSession } from './reportSession';
import { fetchWithTimeout, isJsonResponse, withTimeout } from './timeouts';
import { validateDonationApplication, validateTip } from '../../server/submissionValidation';

/**
 * Citizen news tips (LJ-) and donation applications (DN-), with or without the API.
 *
 * The server route is preferred: it rate-limits per IP and reserves the reference in
 * the `trackingIds` registry. When no usable API is behind this host, the page writes
 * the record to Firestore itself, after the same validation the server applies
 * (server/submissionValidation.ts). The deployed firestore.rules do not accept these
 * browser writes yet (tests/rules/citizenSubmissions.rules.test.ts); the page then says
 * the service needs the server instead of failing silently. The citizen gets a Track
 * ID only once the record is stored, never before.
 */

export interface SubmitResult {
  ok: boolean;
  reference: string | null;
  error: string | null;
  fields: Record<string, string>;
}

const REFERENCE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** `LJ-`/`DN-` + 8 symbols from the platform CSPRNG, the shape the server mints (server/trackingIds.ts). */
export function mintReference(prefix: 'LJ' | 'DN'): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let body = '';
  for (const byte of bytes) body += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length];
  return `${prefix}-${body}`;
}

const fail = (error: string, fields: Record<string, string> = {}): SubmitResult => ({ ok: false, reference: null, error, fields });

/** Server first when it is usable; `null` means "write it directly". */
async function viaServer(path: string, body: unknown): Promise<SubmitResult | null> {
  if (!(await apiReady())) return null;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const user = auth.currentUser;
    if (user && !user.isAnonymous) {
      const token = await withTimeout(user.getIdToken(), 10000, 'timeout').catch(() => null);
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetchWithTimeout(path, { method: 'POST', headers, body: JSON.stringify(body) }, 20000);
    if (!isJsonResponse(response)) {
      markApiUnavailable();
      return null;
    }
    const data = await response.json().catch(() => ({})) as { ok?: boolean; reference?: string; error?: string; fields?: Record<string, string> };
    if (response.ok && data.reference) return { ok: true, reference: data.reference, error: null, fields: {} };
    // The server read it and refused it: say why, do not write around its decision.
    if ([400, 409, 413, 422, 429].includes(response.status)) return fail(data.error || 'Dërgimi u refuzua.', data.fields ?? {});
    markApiUnavailable();
    return null;
  } catch {
    markApiUnavailable();
    return null;
  }
}

type WriteOutcome = 'stored' | 'denied' | 'failed';

/** Writes `data` under a fresh document; bounded, and confirmed with the server when the ack is slow. */
async function writeDirect(collectionName: string, data: Record<string, unknown>): Promise<WriteOutcome> {
  const ref = doc(collection(db, collectionName));
  try {
    await withTimeout(setDoc(ref, data), 30000, 'timeout');
    return 'stored';
  } catch (error) {
    // The deployed rules do not accept browser writes here (yet): only the server can store it.
    if ((error as { code?: string })?.code === 'permission-denied') return 'denied';
    // The rules do not let the author read tips back, so a slow ack can only be
    // confirmed for donations (public read). For tips a timeout is reported as such.
    if (collectionName !== 'donationCauses') return 'failed';
    const snap = await withTimeout(getDocFromServer(ref), 10000, 'timeout').catch(() => null);
    return snap?.exists() ? 'stored' : 'failed';
  }
}

const outcome = (result: WriteOutcome, reference: string): SubmitResult =>
  result === 'stored' ? { ok: true, reference, error: null, fields: {} }
    : result === 'denied' ? fail(SERVER_NEEDED)
      : fail(NOT_STORED);

async function sessionUid(): Promise<string | null> {
  await ensureReportSession();
  return auth.currentUser?.uid ?? null;
}

const NO_SESSION = 'Për ta ruajtur nevojitet një sesion. Rifreskoni faqen dhe provoni përsëri.';
const NOT_STORED = 'Nuk u ruajt. Kontrolloni lidhjen me internetin dhe provoni përsëri; të dhënat e formës mbeten.';
const SERVER_NEEDED = 'Ky shërbim nuk është aktiv tani: dërgesa ruhet vetëm përmes serverit të platformës, i cili nuk po përgjigjet. Asgjë nuk u ruajt; provoni përsëri më vonë.';

export async function submitNewsTip(input: Record<string, unknown>): Promise<SubmitResult> {
  const parsed = validateTip(input);
  if (parsed.ok === false) return fail('Kontrolloni fushat e shënuara.', parsed.errors);

  const server = await viaServer('/api/v1/public/news-tips', input);
  if (server) return server;

  const uid = await sessionUid();
  if (!uid) return fail(NO_SESSION);
  const reference = mintReference('LJ');
  const stored = await writeDirect('newsTips', {
    ...parsed.value,
    reference,
    status: 'submitted',
    authorId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return outcome(stored, reference);
}

export async function submitDonationApplication(input: Record<string, unknown>): Promise<SubmitResult> {
  const parsed = validateDonationApplication(input);
  if (parsed.ok === false) return fail('Kontrolloni fushat e shënuara.', parsed.errors);

  const server = await viaServer('/api/v1/public/donation-applications', input);
  if (server) return server;

  const uid = await sessionUid();
  if (!uid) return fail(NO_SESSION);
  const reference = mintReference('DN');
  // `pending`: not shown publicly until an administrator approves it.
  const stored = await writeDirect('donationCauses', {
    ...parsed.value,
    reference,
    status: 'pending',
    authorId: uid,
    createdAt: serverTimestamp(),
  });
  return outcome(stored, reference);
}

const DONATION_STAGE: Record<string, string> = { pending: 'Në pritje', submitted: 'Në pritje', approved: 'U aprovua', published: 'U aprovua', active: 'U aprovua', rejected: 'U refuzua' };

/** DN- lookup without the server: donation records are public by rule, the stage is all that is shown. */
export async function lookupDonationDirect(reference: string) {
  const snap = await withTimeout(
    getDocsFromServer(query(collection(db, 'donationCauses'), where('reference', '==', reference), limit(1))),
    15000,
    'timeout',
  );
  if (snap.empty) return null;
  const d = snap.docs[0].data() as { status?: string; createdAt?: { toDate?: () => Date } | string };
  const status = String(d.status ?? 'pending');
  const created = typeof d.createdAt === 'string' ? d.createdAt : d.createdAt?.toDate?.().toISOString() ?? null;
  return { kind: 'donation' as const, reference, stage: DONATION_STAGE[status] ?? 'Në pritje', rejected: status === 'rejected', updatedAt: created, createdAt: created };
}
