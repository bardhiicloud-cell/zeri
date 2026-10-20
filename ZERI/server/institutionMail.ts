import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { pipelineRoleOf } from './approvalPipeline';
import { MUNICIPALITY_VISIBLE_STATUSES } from './reportQuery';
import { cheapestPlanWith, featuresFor, hasFeature, normalizePlan } from './municipalityPlans';
import { isEmailAddress, type Mailer } from './mailer';

/**
 * Sending a report to the institution responsible for it, from the platform.
 *
 * It used to open the staffer's own mail program with a pre-filled message: nothing
 * was recorded, nothing proved it was sent, and nobody else could see it had been.
 * Now the platform sends it, and every send is a row in `emailOutbox` with who sent
 * it, to whom, when and whether it arrived at the provider.
 *
 * Rules, enforced here:
 *   - who: administrators and agents, and a municipality whose plan includes `email`
 *     (Pro), only for its own reports;
 *   - which reports: only those already public record (approved onwards), never a
 *     report still waiting for review or one that was rejected;
 *   - to whom: only an address from the verified contact directory
 *     (`reportRoutingContacts`), never one typed into the request;
 *   - what: the report, never who reported it. Name, email and account of the
 *     citizen are not in the message;
 *   - how often: the same report is not sent to the same address twice in 24 hours.
 */

export const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MAX_NOTE = 600;

export interface ReportForMail {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  urgency?: unknown;
  status?: unknown;
  trackingId?: unknown;
  responseDueAt?: unknown;
  location?: { municipality?: unknown; address?: unknown };
  media?: unknown;
  images?: unknown;
}

export interface ContactForMail {
  municipality?: unknown;
  institution?: unknown;
  name?: unknown;
  email?: unknown;
}

export interface SendInput {
  actor: { uid: string; role: string; municipality: string; permissions: readonly string[]; plan: unknown };
  report: ReportForMail | null;
  contact: ContactForMail | null;
  note: unknown;
  recent: ReadonlyArray<{ to: string; atMs: number }>;
  nowMs: number;
}

export type SendDecision =
  | { outcome: 'allow'; to: string; institution: string; note: string }
  | { outcome: 'deny'; status: 400 | 403 | 404 | 409; error: string; code?: string };

const deny = (status: 400 | 403 | 404 | 409, error: string, code?: string): SendDecision => ({ outcome: 'deny', status, error, ...(code ? { code } : {}) });
const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();

/** May this actor send this report to this contact now? Pure. */
export function decideInstitutionEmail(input: SendInput): SendDecision {
  const { actor } = input;
  const pipelineRole = pipelineRoleOf(actor.role, actor.permissions);
  const isMunicipality = actor.role === 'municipality';
  if (pipelineRole !== 'staff' && pipelineRole !== 'agent' && !isMunicipality) {
    return deny(403, 'Kjo llogari nuk dërgon raportime te institucionet.');
  }
  if (isMunicipality && !hasFeature(actor.plan, 'email')) {
    return deny(403, `Dërgimi me email përfshihet nga plani ${cheapestPlanWith('email')}.`, 'PLAN_REQUIRED');
  }

  if (!input.report) return deny(404, 'Raporti nuk u gjet.');
  const municipality = String(input.report.location?.municipality ?? '');
  if (isMunicipality && norm(municipality) !== norm(actor.municipality)) return deny(404, 'Raporti nuk u gjet.');

  // Only what is already public record leaves the platform.
  if (!MUNICIPALITY_VISIBLE_STATUSES.includes(String(input.report.status ?? ''))) {
    return deny(409, 'Raporti dërgohet te institucioni vetëm pasi të jetë aprovuar.');
  }

  if (!input.contact) return deny(404, 'Kontakti nuk u gjet te drejtoria e verifikuar.');
  const to = String(input.contact.email ?? '').trim();
  if (!isEmailAddress(to)) return deny(400, 'Kontakti nuk ka email të vlefshëm.');
  // A contact answers for its own municipality, or for the whole country ("Kosovë").
  const contactArea = norm(input.contact.municipality);
  if (contactArea !== norm(municipality) && contactArea !== 'kosovë' && contactArea !== 'kosove') {
    return deny(400, 'Ky kontakt nuk i përket komunës së raportit.');
  }

  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > MAX_NOTE) return deny(400, `Shënimi nuk mund të kalojë ${MAX_NOTE} shenja.`);

  const duplicate = input.recent.some(row => norm(row.to) === norm(to) && input.nowMs - row.atMs < DUPLICATE_WINDOW_MS);
  if (duplicate) return deny(409, 'Ky raport i është dërguar tashmë këtij kontakti brenda 24 orëve.', 'DUPLICATE');

  return { outcome: 'allow', to, institution: String(input.contact.institution ?? '').trim(), note };
}

/** The message. It carries the report and never the reporter. */
export function buildInstitutionEmail(
  report: ReportForMail,
  contact: ContactForMail,
  options: { note?: string; baseUrl?: string; reportId: string }
): { subject: string; text: string } {
  const code = String(report.trackingId ?? '') || options.reportId;
  const media = Array.isArray(report.media) && report.media.length
    ? (report.media as Array<{ url?: unknown }>).map(item => String(item.url ?? ''))
    : Array.isArray(report.images) ? (report.images as unknown[]).map(String) : [];
  const links = media.filter(url => /^https?:\/\//.test(url)).slice(0, 5);
  const link = options.baseUrl ? `${options.baseUrl.replace(/\/$/, '')}/detailed-registry?report=${encodeURIComponent(options.reportId)}` : '';
  const lines = [
    `I/e nderuar ${String(contact.name ?? '').trim() || 'përgjegjës'},`,
    '',
    'Po ju përcjellim një raportim qytetar për trajtim sipas kompetencës suaj.',
    '',
    `Numri përcjellës: ${code}`,
    `Titulli: ${String(report.title ?? '').trim()}`,
    `Kategoria: ${String(report.category ?? '').trim()}`,
    `Institucioni përgjegjës: ${String(contact.institution ?? '').trim()}`,
    `Komuna: ${String(report.location?.municipality ?? '') || 'Pa komunë'}`,
    `Adresa: ${String(report.location?.address ?? '') || 'Pa adresë'}`,
    `Urgjenca: ${String(report.urgency ?? '')}`,
    `Afati i përgjigjes: ${String(report.responseDueAt ?? '') || 'Nuk është caktuar'}`,
    '',
    'Përshkrimi:',
    String(report.description ?? '').trim() || 'Nuk ka përshkrim.',
  ];
  if (links.length) lines.push('', 'Foto / video:', ...links.map((url, index) => `${index + 1}. ${url}`));
  if (options.note) lines.push('', 'Shënim nga platforma:', options.note);
  if (link) lines.push('', `Shiko raportimin dhe statusin e tij: ${link}`);
  lines.push('', 'Ju lutemi përgjigjuni duke e cituar numrin përcjellës.', '', 'Me respekt,', 'Zëri i Qytetarëve');
  return { subject: `Raportim qytetar ${code}: ${String(report.title ?? '').trim()}`.slice(0, 200), text: lines.join('\n') };
}

export interface InstitutionMailDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
  mailer: () => Mailer;
  actingUser: (req: Request) => { uid: string; email: string; role: string; municipality: string; permissions: string[] };
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
  baseUrl?: () => string;
}

const iso = (value: unknown): string | null => {
  const v = value as { toDate?: () => Date } | string | null | undefined;
  if (!v) return null;
  return typeof v === 'string' ? v : typeof v.toDate === 'function' ? v.toDate().toISOString() : null;
};

export function registerInstitutionMailRoutes(app: Express, deps: InstitutionMailDeps): void {
  const planOf = async (uid: string) =>
    normalizePlan((await deps.db().collection('users').doc(uid).get()).data()?.municipalityPlan);

  app.get('/api/v1/mail/status', deps.requireAuth, (_req: Request, res: Response) => {
    const mailer = deps.mailer();
    res.json({ configured: mailer.configured, provider: mailer.provider });
  });

  app.post('/api/v1/reports/:id/email-institution', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    const reportId = String(req.params.id ?? '').trim();
    const contactId = typeof req.body?.contactId === 'string' ? req.body.contactId.trim() : '';
    if (!reportId || !contactId) return res.status(400).json({ error: 'Kërkesa nuk është e plotë.' });

    try {
      const [reportSnap, contactSnap, plan, recentSnap] = await Promise.all([
        deps.db().collection('reports').doc(reportId).get(),
        deps.db().collection('reportRoutingContacts').doc(contactId).get(),
        actor.role === 'municipality' ? planOf(actor.uid) : Promise.resolve('pro'),
        deps.db().collection('emailOutbox').where('reportId', '==', reportId).limit(50).get(),
      ]);
      const nowMs = Date.now();
      const decision = decideInstitutionEmail({
        actor: { ...actor, plan },
        report: reportSnap.exists ? (reportSnap.data() as ReportForMail) : null,
        contact: contactSnap.exists ? (contactSnap.data() as ContactForMail) : null,
        note: req.body?.note,
        recent: recentSnap.docs
          .filter(doc => ['queued', 'sent'].includes(String(doc.data().status)))
          .map(doc => ({ to: String(doc.data().to ?? ''), atMs: Date.parse(String(iso(doc.data().at) ?? '')) || 0 })),
        nowMs,
      });
      if (decision.outcome === 'deny') {
        deps.audit('report.email.denied', req, { reportId, contactId, reason: decision.error });
        return res.status(decision.status).json({ error: decision.error, ...(decision.code ? { code: decision.code } : {}) });
      }

      const report = reportSnap.data() as ReportForMail;
      const message = buildInstitutionEmail(report, contactSnap.data() as ContactForMail, {
        note: decision.note, baseUrl: deps.baseUrl?.(), reportId,
      });
      let byName = '';
      try { byName = String((await deps.db().collection('users').doc(actor.uid).get()).data()?.name ?? ''); } catch { /* display only */ }
      const now = new Date().toISOString();
      const outboxRef = deps.db().collection('emailOutbox').doc();
      await outboxRef.set({
        reportId, trackingId: String(report.trackingId ?? ''), contactId, to: decision.to, institution: decision.institution,
        subject: message.subject, status: 'queued', attempts: 0, provider: deps.mailer().provider,
        municipality: String(report.location?.municipality ?? ''), byUid: actor.uid, byName: byName || actor.email, byRole: actor.role,
        at: now, createdAt: FieldValue.serverTimestamp(),
      });

      const mailer = deps.mailer();
      if (!mailer.configured) {
        deps.audit('report.email.queued', req, { reportId, outboxId: outboxRef.id });
        return res.status(202).json({ id: outboxRef.id, status: 'queued', configured: false });
      }

      const result = await mailer.send({ to: decision.to, subject: message.subject, text: message.text });
      await outboxRef.update(result.ok
        ? { status: 'sent', attempts: 1, sentAt: new Date().toISOString(), messageId: result.messageId, error: FieldValue.delete() }
        : { status: 'failed', attempts: 1, error: result.error, retryable: result.retryable });

      if (result.ok) {
        // Public, and deliberately without the address: the citizen sees that it went.
        await deps.db().collection('reports').doc(reportId).update({
          updatedAt: now,
          timeline: FieldValue.arrayUnion({
            id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
            status: String(report.status ?? ''), date: now, updatedBy: 'Zëri i Qytetarëve', actorRole: 'staff',
            previousStatus: String(report.status ?? ''),
            comment: `Raportimi u dërgua me email te ${decision.institution || 'institucioni përgjegjës'}.`,
          }),
        });
      }
      deps.audit(result.ok ? 'report.email.sent' : 'report.email.failed', req, { reportId, outboxId: outboxRef.id, provider: mailer.provider, error: result.ok ? null : result.error });
      return res.status(result.ok ? 201 : 502).json(result.ok ? { id: outboxRef.id, status: 'sent' } : { id: outboxRef.id, status: 'failed', error: result.error });
    } catch (error) {
      console.error('[MAIL] send failed:', error?.message);
      return res.status(500).json({ error: 'Dërgimi nuk u krye. Provoni përsëri.' });
    }
  });

  /** What was sent about a report, and whether it arrived at the provider. */
  app.get('/api/v1/reports/:id/emails', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    const role = pipelineRoleOf(actor.role, actor.permissions);
    const isMunicipality = actor.role === 'municipality';
    if (role !== 'staff' && role !== 'agent' && !isMunicipality && actor.role !== 'monitor') {
      return res.status(403).json({ error: 'Nuk keni qasje te historia e dërgimeve.' });
    }
    try {
      const snap = await deps.db().collection('emailOutbox').where('reportId', '==', String(req.params.id)).limit(50).get();
      const items = snap.docs
        .map(d => ({ id: d.id, ...d.data(), at: iso(d.data().at), createdAt: undefined, subject: undefined }))
        .filter(row => !isMunicipality || norm((row as { municipality?: unknown }).municipality) === norm(actor.municipality))
        .sort((a, b) => Date.parse(String(b.at ?? '')) - Date.parse(String(a.at ?? '')));
      return res.json({ items });
    } catch (error) {
      console.error('[MAIL] history failed:', error?.message);
      return res.status(500).json({ error: 'Historia nuk u lexua.' });
    }
  });

  /** Try again a message that failed or stayed queued (e.g. before the provider was configured). */
  app.post('/api/v1/admin/emails/:id/retry', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    if (pipelineRoleOf(actor.role, actor.permissions) !== 'staff') return res.status(403).json({ error: 'Vetëm administratori e riprovon një dërgim.' });
    const mailer = deps.mailer();
    if (!mailer.configured) return res.status(409).json({ error: 'Emaili automatik nuk është konfiguruar.', code: 'NOT_CONFIGURED' });
    try {
      const ref = deps.db().collection('emailOutbox').doc(String(req.params.id));
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Dërgimi nuk u gjet.' });
      const row = snap.data() as Record<string, unknown>;
      if (!['queued', 'failed'].includes(String(row.status))) return res.status(409).json({ error: 'Ky dërgim është kryer.' });
      const [reportSnap, contactSnap] = await Promise.all([
        deps.db().collection('reports').doc(String(row.reportId)).get(),
        deps.db().collection('reportRoutingContacts').doc(String(row.contactId)).get(),
      ]);
      if (!reportSnap.exists || !contactSnap.exists) return res.status(404).json({ error: 'Raporti ose kontakti nuk ekziston më.' });
      const message = buildInstitutionEmail(reportSnap.data() as ReportForMail, contactSnap.data() as ContactForMail, { baseUrl: deps.baseUrl?.(), reportId: String(row.reportId) });
      const result = await mailer.send({ to: String(row.to), subject: message.subject, text: message.text });
      await ref.update(result.ok
        ? { status: 'sent', attempts: FieldValue.increment(1), sentAt: new Date().toISOString(), messageId: result.messageId, error: FieldValue.delete() }
        : { status: 'failed', attempts: FieldValue.increment(1), error: result.error, retryable: result.retryable });
      deps.audit(result.ok ? 'report.email.sent' : 'report.email.failed', req, { outboxId: ref.id, retry: true });
      return res.status(result.ok ? 200 : 502).json({ status: result.ok ? 'sent' : 'failed', ...(result.ok ? {} : { error: result.error }) });
    } catch (error) {
      console.error('[MAIL] retry failed:', error?.message);
      return res.status(500).json({ error: 'Riprovimi nuk u krye.' });
    }
  });

  // Exposed for tests and the desk: the features a plan unlocks.
  void featuresFor;
}
