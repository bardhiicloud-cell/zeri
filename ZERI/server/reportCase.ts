import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { pipelineRoleOf } from './approvalPipeline';

/**
 * The conversation around a report: asking the citizen for more, hearing back,
 * internal notes, and escalation.
 *
 * What was missing: a reviewer who could not decide had two choices, approve or
 * reject. There was no way to say "I need a better photo", no way for the citizen
 * to answer, and no place for staff to leave each other notes that the citizen and
 * the public must never read.
 *
 *   request-info   staff or an agent asks the citizen a question (a report still in
 *                  review). The report is flagged `awaitingInfo`; the public
 *                  timeline says only that more information was requested, never
 *                  the question. The citizen is notified and reads the question.
 *   provide-info   only the person who filed it answers; the flag clears.
 *   notes          internal comments between staff. Never shown to the citizen,
 *                  the municipality or the public.
 *   escalate       an agent raises a report to the owner with a reason; the owner
 *                  resolves the escalation. Both leave an internal note.
 *
 * Where it lives: `reports/{id}/caseMessages` (citizen-visible) and
 * `reports/{id}/internalNotes` (staff only). Both are written and read only through
 * this module; the database rules give clients no access to them.
 */

export const MIN_TEXT = 5;
export const MAX_QUESTION = 600;
export const MAX_ANSWER = 1200;
export const MAX_NOTE = 1000;

const REVIEW_STATUSES = ['Pending Review', 'Draft'];

type Role = 'staff' | 'agent' | null;

export interface CaseActor {
  uid: string;
  role: string;
  permissions: readonly string[];
}

export interface CaseReport {
  status?: unknown;
  authorId?: unknown;
  awaitingInfo?: unknown;
  escalated?: unknown;
}

export type CaseDecision =
  | { outcome: 'allow'; text: string }
  | { outcome: 'deny'; status: 400 | 403 | 404 | 409; error: string };

const deny = (status: 400 | 403 | 404 | 409, error: string): CaseDecision => ({ outcome: 'deny', status, error });
const roleOf = (actor: CaseActor): Role => {
  const r = pipelineRoleOf(actor.role, actor.permissions);
  return r === 'staff' || r === 'agent' ? r : null;
};

/** One shape (not a union): the project does not enable strictNullChecks, so `ok` would not narrow. */
function textOf(value: unknown, min: number, max: number, what: string): { text: string; error: string } {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < min) return { text: '', error: `${what}: shkruani të paktën ${min} shenja.` };
  if (text.length > max) return { text: '', error: `${what} nuk mund të kalojë ${max} shenja.` };
  return { text, error: '' };
}

/** May this actor ask the citizen for more information on this report? Pure. */
export function decideRequestInfo(actor: CaseActor, report: CaseReport | null, question: unknown): CaseDecision {
  if (!roleOf(actor)) return deny(403, 'Vetëm administratori dhe agjenti kërkojnë informacion shtesë.');
  if (!report) return deny(404, 'Raporti nuk u gjet.');
  if (!REVIEW_STATUSES.includes(String(report.status ?? ''))) {
    return deny(409, 'Informacion kërkohet vetëm për raportime që janë ende në shqyrtim.');
  }
  if (!String(report.authorId ?? '')) return deny(409, 'Ky raportim nuk ka llogari për t\'i dërguar pyetjen.');
  if (report.awaitingInfo === true) return deny(409, 'Pret ende përgjigjen e pyetjes së mëparshme.');
  const q = textOf(question, MIN_TEXT, MAX_QUESTION, 'Pyetja');
  return q.error ? deny(400, q.error) : { outcome: 'allow', text: q.text };
}

/** May this person answer? Only the one who filed the report, and only when asked. Pure. */
export function decideProvideInfo(actor: { uid: string }, report: CaseReport | null, answer: unknown): CaseDecision {
  if (!report) return deny(404, 'Raporti nuk u gjet.');
  // Not "forbidden": someone else's report should look like it does not exist.
  if (!actor.uid || String(report.authorId ?? '') !== actor.uid) return deny(404, 'Raporti nuk u gjet.');
  if (report.awaitingInfo !== true) return deny(409, 'Nuk ka pyetje që pret përgjigje.');
  const a = textOf(answer, MIN_TEXT, MAX_ANSWER, 'Përgjigjja');
  return a.error ? deny(400, a.error) : { outcome: 'allow', text: a.text };
}

/** May this actor leave an internal note? Staff and agents, never anyone else. Pure. */
export function decideNote(actor: CaseActor, report: CaseReport | null, text: unknown): CaseDecision {
  if (!roleOf(actor)) return deny(403, 'Shënimet e brendshme janë vetëm për stafin.');
  if (!report) return deny(404, 'Raporti nuk u gjet.');
  const t = textOf(text, MIN_TEXT, MAX_NOTE, 'Shënimi');
  return t.error ? deny(400, t.error) : { outcome: 'allow', text: t.text };
}

/** Escalate (agent or owner, with a reason) or resolve an escalation (owner only). Pure. */
export function decideEscalation(actor: CaseActor, report: CaseReport | null, action: 'escalate' | 'resolve', reason: unknown): CaseDecision {
  const role = roleOf(actor);
  if (!role) return deny(403, 'Eskalimi është vetëm për stafin.');
  if (!report) return deny(404, 'Raporti nuk u gjet.');
  if (action === 'resolve' && role !== 'staff') return deny(403, 'Vetëm administratori e mbyll një eskalim.');
  if (action === 'escalate' && report.escalated === true) return deny(409, 'Ky raportim është tashmë i eskaluar.');
  if (action === 'resolve' && report.escalated !== true) return deny(409, 'Ky raportim nuk është i eskaluar.');
  const t = textOf(reason, MIN_TEXT, MAX_NOTE, action === 'escalate' ? 'Arsyeja' : 'Shënimi i mbylljes');
  return t.error ? deny(400, t.error) : { outcome: 'allow', text: t.text };
}

export interface ReportCaseDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
  actingUser: (req: Request) => { uid: string; email: string; role: string; permissions: string[] };
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
}

const iso = (value: unknown): string | null => {
  const v = value as { toDate?: () => Date } | string | null | undefined;
  if (!v) return null;
  return typeof v === 'string' ? v : typeof v.toDate === 'function' ? v.toDate().toISOString() : null;
};

const eventId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function registerReportCaseRoutes(app: Express, deps: ReportCaseDeps): void {
  const load = async (id: string) => {
    const ref = deps.db().collection('reports').doc(id);
    const snap = await ref.get();
    return { ref, report: snap.exists ? (snap.data() as Record<string, any>) : null };
  };
  const nameOf = async (uid: string, fallback: string) => {
    try { return String((await deps.db().collection('users').doc(uid).get()).data()?.name ?? '') || fallback; } catch { return fallback; }
  };
  const fail = (res: Response, tag: string, error: any) => {
    console.error(`[CASE] ${tag} failed:`, error?.message);
    return res.status(500).json({ error: 'Veprimi nuk u krye. Provoni përsëri.' });
  };

  app.post('/api/v1/reports/:id/request-info', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    const id = String(req.params.id ?? '').trim();
    try {
      const { ref, report } = await load(id);
      const decision = decideRequestInfo(actor, report, req.body?.question);
      if (decision.outcome === 'deny') {
        deps.audit('report.info.request.denied', req, { reportId: id, reason: decision.error });
        return res.status(decision.status).json({ error: decision.error });
      }
      const now = new Date().toISOString();
      const by = await nameOf(actor.uid, actor.role === 'agent' ? 'Agjenti i platformës' : 'Administrata');
      const batch = deps.db().batch();
      batch.update(ref, {
        awaitingInfo: true, infoRequestedAt: now, updatedAt: now,
        timeline: FieldValue.arrayUnion({
          id: eventId(), status: String(report!.status), date: now, updatedBy: 'Zëri i Qytetarëve', actorRole: roleOf(actor) ?? 'staff',
          previousStatus: String(report!.status),
          // Public: that more is needed, never what was asked.
          comment: 'Kërkohet informacion shtesë nga qytetari.',
        }),
      });
      batch.set(ref.collection('caseMessages').doc(), {
        kind: 'info_request', text: decision.text, byUid: actor.uid, byLabel: by, at: now, createdAt: FieldValue.serverTimestamp(),
      });
      const trackId = String(report!.trackingId ?? '');
      batch.set(deps.db().collection('notifications').doc(), {
        title: `Kërkohet informacion shtesë${trackId ? ` për #${trackId}` : ''}`,
        message: decision.text.slice(0, 200), channel: 'report', category: 'report', type: 'info', priority: 'high', urgent: false,
        audience: 'user', userId: String(report!.authorId), reportId: id, trackId: trackId || undefined, state: 'published',
        link: `/trackid${trackId ? `?id=${encodeURIComponent(trackId)}` : ''}`, sender: 'Zëri i Qytetarëve', createdAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
      deps.audit('report.info.request', req, { reportId: id });
      return res.status(201).json({ ok: true });
    } catch (error) { return fail(res, 'request-info', error); }
  });

  const provideInfoHandler = async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    const id = String(req.params.id ?? '').trim();
    try {
      const { ref, report } = await load(id);
      const decision = decideProvideInfo(actor, report, req.body?.answer);
      if (decision.outcome === 'deny') {
        deps.audit('report.info.provide.denied', req, { reportId: id, reason: decision.error });
        return res.status(decision.status).json({ error: decision.error });
      }
      const now = new Date().toISOString();
      // Who asked, so they can be told the answer arrived.
      const asked = await ref.collection('caseMessages').where('kind', '==', 'info_request').limit(20).get();
      const last = asked.docs.map(d => d.data()).sort((a, b) => Date.parse(String(b.at)) - Date.parse(String(a.at)))[0];
      const batch = deps.db().batch();
      batch.update(ref, {
        awaitingInfo: false, infoProvidedAt: now, updatedAt: now,
        timeline: FieldValue.arrayUnion({
          id: eventId(), status: String(report!.status), date: now, updatedBy: 'Qytetari', actorRole: 'citizen',
          previousStatus: String(report!.status), comment: 'Qytetari dha informacionin shtesë.',
        }),
      });
      batch.set(ref.collection('caseMessages').doc(), {
        kind: 'info_response', text: decision.text, byUid: actor.uid, byLabel: 'Qytetari', at: now, createdAt: FieldValue.serverTimestamp(),
      });
      if (last?.byUid) {
        const trackId = String(report!.trackingId ?? '');
        batch.set(deps.db().collection('notifications').doc(), {
          title: `Qytetari u përgjigj${trackId ? ` te #${trackId}` : ''}`, message: 'Informacioni shtesë që kërkuat ka mbërritur.',
          channel: 'report', category: 'report', type: 'info', priority: 'normal', urgent: false, audience: 'user', userId: String(last.byUid),
          reportId: id, state: 'published', link: `/admin#reports?open=${encodeURIComponent(id)}`, sender: 'Zëri i Qytetarëve', createdAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      deps.audit('report.info.provide', req, { reportId: id });
      return res.status(201).json({ ok: true });
    } catch (error) { return fail(res, 'provide-info', error); }
  };
  app.post('/api/v1/reports/:id/provide-info', deps.requireAuth, provideInfoHandler);

  app.post('/api/v1/reports/:id/notes', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    const id = String(req.params.id ?? '').trim();
    try {
      const { ref, report } = await load(id);
      const decision = decideNote(actor, report, req.body?.text);
      if (decision.outcome === 'deny') {
        deps.audit('report.note.denied', req, { reportId: id, reason: decision.error });
        return res.status(decision.status).json({ error: decision.error });
      }
      await ref.collection('internalNotes').add({
        kind: 'note', text: decision.text, byUid: actor.uid, byLabel: await nameOf(actor.uid, actor.email), at: new Date().toISOString(), createdAt: FieldValue.serverTimestamp(),
      });
      deps.audit('report.note', req, { reportId: id });
      return res.status(201).json({ ok: true });
    } catch (error) { return fail(res, 'note', error); }
  });

  const escalation = (action: 'escalate' | 'resolve') => async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    const id = String(req.params.id ?? '').trim();
    try {
      const { ref, report } = await load(id);
      const decision = decideEscalation(actor, report, action, req.body?.reason);
      if (decision.outcome === 'deny') {
        deps.audit(`report.escalation.${action}.denied`, req, { reportId: id, reason: decision.error });
        return res.status(decision.status).json({ error: decision.error });
      }
      const now = new Date().toISOString();
      const batch = deps.db().batch();
      batch.update(ref, action === 'escalate' ? { escalated: true, escalatedAt: now, updatedAt: now } : { escalated: false, escalatedAt: FieldValue.delete(), updatedAt: now });
      batch.set(ref.collection('internalNotes').doc(), {
        kind: action === 'escalate' ? 'escalation' : 'escalation_resolved', text: decision.text, byUid: actor.uid, byLabel: await nameOf(actor.uid, actor.email), at: now, createdAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
      deps.audit(`report.escalation.${action}`, req, { reportId: id });
      return res.json({ ok: true, escalated: action === 'escalate' });
    } catch (error) { return fail(res, `escalation-${action}`, error); }
  };
  app.post('/api/v1/reports/:id/escalate', deps.requireAuth, escalation('escalate'));
  app.post('/api/v1/reports/:id/resolve-escalation', deps.requireAuth, escalation('resolve'));

  /**
   * The thread. Staff, agents and the owner see messages and internal notes together;
   * the monitor reads the same; the person who filed it sees only the messages
   * between them and the staff. Anyone else gets "not found".
   */
  const caseHandler = async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    const id = String(req.params.id ?? '').trim();
    try {
      const { ref, report } = await load(id);
      if (!report) return res.status(404).json({ error: 'Raporti nuk u gjet.' });
      const staff = roleOf(actor) !== null || actor.role === 'monitor';
      const author = actor.uid !== '' && String(report.authorId ?? '') === actor.uid;
      if (!staff && !author) return res.status(404).json({ error: 'Raporti nuk u gjet.' });

      const [messages, notes] = await Promise.all([
        ref.collection('caseMessages').limit(100).get(),
        staff ? ref.collection('internalNotes').limit(100).get() : Promise.resolve(null),
      ]);
      const rows = [
        ...messages.docs.map(d => ({ id: d.id, internal: false, ...d.data() })),
        ...(notes?.docs ?? []).map(d => ({ id: d.id, internal: true, ...d.data() })),
      ].map(row => ({ ...(row as Record<string, unknown>), at: iso((row as { at?: unknown }).at), createdAt: undefined }) as Record<string, any>)
        // Citizens never see who on the staff asked, only that the platform did.
        .map(row => (staff ? row : { ...row, byUid: undefined }))
        .sort((a, b) => Date.parse(String(a.at ?? '')) - Date.parse(String(b.at ?? '')));
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json({ awaitingInfo: report.awaitingInfo === true, escalated: staff ? report.escalated === true : undefined, items: rows });
    } catch (error) { return fail(res, 'case', error); }
  };
  app.get('/api/v1/reports/:id/case', deps.requireAuth, caseHandler);

  /**
   * The citizen's own door, by the Track ID they hold. The public tracking page does
   * not carry the report's id (by design), so the person who filed a report reaches
   * its conversation through the tracking number, and only if it is theirs: the
   * lookup is by tracking number AND their own account, so a stranger's number is
   * simply "not found".
   */
  const mine = (handler: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    const trackingId = String(req.params.trackingId ?? '').trim().toUpperCase();
    if (!actor.uid || !/^[A-Z0-9_-]{8,40}$/.test(trackingId)) return res.status(404).json({ error: 'Raporti nuk u gjet.' });
    try {
      const found = await deps.db().collection('reports').where('trackingId', '==', trackingId).where('authorId', '==', actor.uid).limit(1).get();
      if (found.empty) return res.status(404).json({ error: 'Raporti nuk u gjet.' });
      req.params.id = found.docs[0].id;
      return handler(req, res);
    } catch (error) { return fail(res, 'my-report', error); }
  };
  app.get('/api/v1/my-reports/:trackingId/case', deps.requireAuth, mine(caseHandler));
  app.post('/api/v1/my-reports/:trackingId/provide-info', deps.requireAuth, mine(provideInfoHandler));
}
