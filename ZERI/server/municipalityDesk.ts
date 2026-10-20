import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { mayUseSection } from './policy';
import { MUNICIPALITY_VISIBLE_STATUSES } from './reportQuery';
import { cheapestPlanWith, decidePlanChange, featuresFor, hasFeature, normalizePlan } from './municipalityPlans';
import type { Auth } from 'firebase-admin/auth';

/**
 * The municipality's desk: what a municipal account writes about a report, and
 * the staff queue that answers it.
 *
 * The /komuna screen used to keep a municipality's responses, correction requests
 * and disputes in the browser's memory. They vanished on reload and reached no
 * one. Now each is a stored request:
 *
 *   respond          an official response. Public at once, as a timeline entry
 *                    ("Komuna e Pejës: …"), because it adds context and removes
 *                    nothing; the request is kept for the record.
 *   correct_fact     asks staff to correct a fact in the citizen's report.
 *   dispute          contests the report; reviewed by staff, never by the
 *                    municipality itself.
 *   request_removal  asks staff to take content down. Granting it is a staff
 *                    decision; the municipality cannot remove anything.
 *
 * The last three wait in `municipalityRequests` as `pending` until staff accept
 * or decline them (with a reason) through the decision system. The municipality
 * sees the outcome and the reason, so a request is never a black hole.
 */

export type RequestKind = 'respond' | 'correct_fact' | 'dispute' | 'request_removal';
export const REQUEST_KINDS: readonly RequestKind[] = ['respond', 'correct_fact', 'dispute', 'request_removal'];

export const MIN_NOTE = 10;
export const MAX_NOTE = 1200;

export interface RequestInput {
  actor: { uid: string; role: string; municipality: string };
  report: { status?: unknown; location?: { municipality?: unknown } } | null;
  kind: unknown;
  note: unknown;
}

export type RequestDecision =
  | { outcome: 'allow'; kind: RequestKind; note: string; publicNow: boolean }
  | { outcome: 'deny'; status: 400 | 403 | 404; error: string };

const deny = (status: 400 | 403 | 404, error: string): RequestDecision => ({ outcome: 'deny', status, error });
const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();

/** May this municipal account file this request on this report? Pure. */
export function decideMunicipalityRequest(input: RequestInput): RequestDecision {
  if (input.actor.role !== 'municipality') return deny(403, 'Kjo është tavolina e llogarive komunale.');
  const own = norm(input.actor.municipality);
  if (!own) return deny(403, 'Llogaria nuk ka komunë të caktuar.');

  if (typeof input.kind !== 'string' || !(REQUEST_KINDS as readonly string[]).includes(input.kind)) {
    return deny(400, 'Lloji i kërkesës nuk njihet.');
  }
  const kind = input.kind as RequestKind;

  if (!input.report) return deny(404, 'Raporti nuk u gjet.');
  // Same answer for "not yours" and "not visible to you": a probe learns nothing.
  if (norm(input.report.location?.municipality) !== own || !MUNICIPALITY_VISIBLE_STATUSES.includes(String(input.report.status ?? ''))) {
    return deny(404, 'Raporti nuk u gjet.');
  }

  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length < MIN_NOTE) return deny(400, `Shkruani të paktën ${MIN_NOTE} shenja.`);
  if (note.length > MAX_NOTE) return deny(400, `Teksti nuk mund të kalojë ${MAX_NOTE} shenja.`);

  return { outcome: 'allow', kind, note, publicNow: kind === 'respond' };
}

export interface MunicipalityDeskDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
  authAdmin: () => Auth;
  actingUser: (req: Request) => { uid: string; email: string; role: string; municipality: string; permissions: string[] };
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
  logEditorialEvent: (entry: Record<string, unknown>) => Promise<void>;
}

const FIREWALL_ACTION: Record<RequestKind, string> = {
  respond: 'respond',
  correct_fact: 'correct_fact',
  dispute: 'dispute',
  request_removal: 'request_removal',
};
const EVENT_KIND: Record<RequestKind, string> = {
  respond: 'response_published',
  correct_fact: 'correction_requested',
  dispute: 'report_disputed',
  request_removal: 'removal_requested',
};

const iso = (value: unknown): string | null => {
  const v = value as { toDate?: () => Date } | string | null | undefined;
  if (!v) return null;
  if (typeof v === 'string') return v;
  return typeof v.toDate === 'function' ? v.toDate().toISOString() : null;
};

export function registerMunicipalityDeskRoutes(app: Express, deps: MunicipalityDeskDeps): void {
  /** The plan this municipal account was sold; read from the profile only the server can write. */
  const planOf = async (uid: string) =>
    normalizePlan((await deps.db().collection('users').doc(uid).get()).data()?.municipalityPlan);

  app.post('/api/v1/municipality/reports/:id/request', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    const reportId = String(req.params.id ?? '').trim();
    try {
      const ref = deps.db().collection('reports').doc(reportId);
      const snap = await ref.get();
      const report = snap.exists ? (snap.data() as Record<string, any>) : null;
      const decision = decideMunicipalityRequest({ actor, report, kind: req.body?.kind, note: req.body?.note });

      if (decision.outcome === 'deny') {
        // A refused attempt is evidence too (see editorialLog): record it.
        await deps.logEditorialEvent({
          kind: 'action_denied', subjectId: reportId, subjectType: 'report',
          actorMunicipality: actor.municipality, actorUserId: actor.uid, actorEmail: actor.email,
          attemptedAction: String(req.body?.kind ?? 'unknown'), denied: true, denialReason: decision.error,
        });
        deps.audit('municipality.request.denied', req, { reportId, kind: req.body?.kind ?? null, reason: decision.error });
        return res.status(decision.status).json({ error: decision.error });
      }

      let byName = '';
      try {
        byName = String((await deps.db().collection('users').doc(actor.uid).get()).data()?.name ?? '');
      } catch { /* display only */ }
      const label = `Komuna e ${actor.municipality}`;
      const now = new Date().toISOString();

      const request = {
        reportId,
        trackingId: String(report?.trackingId ?? ''),
        reportTitle: String(report?.title ?? '').slice(0, 160),
        municipality: actor.municipality,
        kind: decision.kind,
        note: decision.note,
        status: decision.publicNow ? 'published' : 'pending',
        byUid: actor.uid,
        byName: byName || actor.email,
        at: now,
        createdAt: FieldValue.serverTimestamp(),
      };
      const requestRef = deps.db().collection('municipalityRequests').doc();
      const batch = deps.db().batch();
      batch.set(requestRef, request);
      if (decision.publicNow) {
        batch.update(ref, {
          updatedAt: now,
          timeline: FieldValue.arrayUnion({
            id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
            status: String(report?.status ?? ''),
            date: now,
            updatedBy: label,
            actorRole: 'municipality',
            actorInstitution: label,
            previousStatus: String(report?.status ?? ''),
            source: 'municipality',
            comment: decision.note,
          }),
        });
      }
      await batch.commit();

      await deps.logEditorialEvent({
        kind: EVENT_KIND[decision.kind], subjectId: reportId, subjectType: 'report',
        actorMunicipality: actor.municipality, actorUserId: actor.uid, actorEmail: actor.email,
        attemptedAction: FIREWALL_ACTION[decision.kind], note: decision.note,
      });
      deps.audit(`municipality.request.${decision.kind}`, req, { reportId, requestId: requestRef.id });
      return res.status(201).json({ id: requestRef.id, status: request.status });
    } catch (error) {
      console.error('[MUNICIPALITY] request failed:', error?.message);
      return res.status(500).json({ error: 'Kërkesa nuk u ruajt. Provoni përsëri.' });
    }
  });

  /** The municipality's own desk: its requests with their outcome, and its work facts. */
  app.get('/api/v1/municipality/desk', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    if (actor.role !== 'municipality') return res.status(403).json({ error: 'Kjo është tavolina e llogarive komunale.' });
    if (!actor.municipality) return res.status(403).json({ error: 'Llogaria nuk ka komunë të caktuar.' });
    try {
      // Equality filter only (no ordering) so no composite index is needed; sorted here.
      const [requests, facts] = await Promise.all([
        deps.db().collection('municipalityRequests').where('municipality', '==', actor.municipality).limit(300).get(),
        deps.db().collection('workFacts').where('municipality', '==', actor.municipality).limit(300).get(),
      ]);
      const sortDesc = (a: { at: string | null }, b: { at: string | null }) => Date.parse(b.at ?? '') - Date.parse(a.at ?? '');
      const plan = await planOf(actor.uid);
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json({
        plan,
        features: featuresFor(plan),
        requests: requests.docs
          .map(d => {
            const x = d.data();
            return {
              id: d.id, reportId: x.reportId, trackingId: x.trackingId, reportTitle: x.reportTitle, kind: x.kind,
              note: x.note, status: x.status, at: iso(x.at) ?? iso(x.createdAt),
              // The outcome and its reason are the point of a request; who in the newsroom decided is not shown.
              decisionReason: x.decisionReason ?? null, decidedAt: x.decidedAt ?? null,
            };
          })
          .sort(sortDesc),
        workFacts: facts.docs
          .map(d => {
            const x = d.data();
            return { id: d.id, reportId: x.reportId, description: x.description, review: x.review, completedAt: x.completedAt ?? null, at: iso(x.createdAt) };
          })
          .sort(sortDesc),
      });
    } catch (error) {
      console.error('[MUNICIPALITY] desk failed:', error?.message);
      return res.status(500).json({ error: 'Tavolina nuk u ngarkua.' });
    }
  });

  /** The staff queue of what municipalities asked for. */
  app.get('/api/v1/admin/municipality-requests', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    if (actor.role === 'municipality' || !mayUseSection({ role: actor.role, permissions: actor.permissions }, 'reports')) {
      return res.status(403).json({ error: 'Nuk keni qasje te kërkesat e komunave.' });
    }
    const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
    if (!['pending', 'accepted', 'declined', 'published'].includes(status)) return res.status(400).json({ error: 'Statusi nuk njihet.' });
    try {
      const snap = await deps.db().collection('municipalityRequests').where('status', '==', status).limit(200).get();
      const items = snap.docs
        .map(d => ({ id: d.id, ...d.data(), at: iso(d.data().at) ?? iso(d.data().createdAt), createdAt: undefined }))
        .sort((a, b) => Date.parse(String(b.at ?? '')) - Date.parse(String(a.at ?? '')));
      return res.json({ items });
    } catch (error) {
      console.error('[ADMIN] municipality requests failed:', error?.message);
      return res.status(500).json({ error: 'Kërkesat nuk u ngarkuan.' });
    }
  });

  /**
   * The health cases of the municipality's own area, WITHOUT who the patient is.
   *
   * A municipality coordinates care and confirms that a case is real, but the
   * registry holds sensitive identity and contact data that stays with health staff
   * (see the healthRegistry rules). So the name, phone and contact name are never
   * sent here; the case is described by age, neighbourhood, condition and need.
   */
  app.get('/api/v1/municipality/health', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    if (actor.role !== 'municipality') return res.status(403).json({ error: 'Kjo është tavolina e llogarive komunale.' });
    if (!actor.municipality) return res.status(403).json({ error: 'Llogaria nuk ka komunë të caktuar.' });
    try {
      const plan = await planOf(actor.uid);
      if (!hasFeature(plan, 'health')) {
        return res.status(403).json({ error: `Rastet shëndetësore përfshihen nga plani ${cheapestPlanWith('health')}.`, code: 'PLAN_REQUIRED', plan });
      }
      const snap = await deps.db().collection('healthRegistry').where('municipality', '==', actor.municipality).limit(300).get();
      const rank: Record<string, number> = { Urgjente: 3, Mesatare: 2, 'Kronike e Stabilizuar': 1 };
      const items = snap.docs
        .map(d => {
          const x = d.data();
          return {
            id: d.id, trackingId: x.trackingId ?? '', municipality: x.municipality, neighborhood: x.neighborhood ?? '',
            age: x.age ?? null, gender: x.gender ?? '', category: x.category ?? '', diagnosis: x.diagnosis ?? '',
            urgency: x.urgency ?? '', needs: Array.isArray(x.needs) ? x.needs : [], description: x.description ?? '',
            status: x.status ?? 'pending', hospitalNotified: x.hospitalNotified === true, hospitalTarget: x.hospitalTarget ?? '',
            createdAt: iso(x.createdAt),
          };
        })
        .sort((a, b) => (rank[b.urgency] ?? 0) - (rank[a.urgency] ?? 0) || Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? ''));
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json({ items });
    } catch (error) {
      console.error('[MUNICIPALITY] health failed:', error?.message);
      return res.status(500).json({ error: 'Rastet shëndetësore nuk u ngarkuan.' });
    }
  });

  /** An administrator sets the plan of a municipal account (stored where only the server writes). */
  app.put('/api/v1/admin/users/:uid/plan', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    const targetUid = String(req.params.uid ?? '').trim();
    try {
      let targetRole = '';
      try {
        const user = await deps.authAdmin().getUser(targetUid);
        targetRole = String((user.customClaims as Record<string, unknown> | undefined)?.role ?? '');
      } catch (error) {
        if (error?.code === 'auth/user-not-found') return res.status(404).json({ error: 'Llogaria nuk u gjet.' });
        throw error;
      }
      const decision = decidePlanChange({ actor, targetUid, targetRole, plan: req.body?.plan });
      if (decision.outcome === 'deny') {
        deps.audit('admin.municipality.plan.denied', req, { targetUid, plan: req.body?.plan ?? null, reason: decision.error });
        return res.status(decision.status).json({ error: decision.error });
      }
      const ref = deps.db().collection('users').doc(targetUid);
      const before = normalizePlan((await ref.get()).data()?.municipalityPlan);
      await ref.set({ municipalityPlan: decision.plan, planChangedAt: new Date().toISOString(), planChangedBy: actor.uid }, { merge: true });
      deps.audit('admin.municipality.plan', req, { targetUid, from: before, to: decision.plan });
      return res.json({ ok: true, plan: decision.plan, features: featuresFor(decision.plan) });
    } catch (error) {
      console.error('[ADMIN] plan change failed:', error?.message);
      return res.status(500).json({ error: 'Plani nuk u ruajt. Provoni përsëri.' });
    }
  });
}
