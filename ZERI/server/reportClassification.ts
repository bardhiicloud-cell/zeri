import type { Express, Request, RequestHandler, Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { pipelineRoleOf } from './approvalPipeline';
import { KOSOVO_MUNICIPALITIES } from '../src/lib/constants';
import { REPORT_TOPICS } from '../src/lib/reportTopics';
import { resolveResponsible, type Zone } from '../src/lib/responsibility';

/**
 * Setting the category, the municipality and the urban/rural zone of many reports at
 * once, from the board.
 *
 * These three decide who answers a report (src/lib/responsibility.ts), so changing
 * them is a staff decision, not a citizen's. Rules, enforced here:
 *   - who: administrators and agents for any report; a municipality only for its own
 *     reports, and it may set the category and the zone but not move a report to a
 *     different municipality;
 *   - what: the category must be one of the platform's topics, the municipality one
 *     of the 38, the zone `urban` or `rural`; nothing else in the report is touched;
 *   - how many: at most MAX_BATCH reports per call;
 *   - after: the responsible body is recomputed and stored with the report, so the
 *     existing directory lookups (responsibleInstitution / responsibleLevel) agree
 *     with the new classification;
 *   - record: every call is audited, and each report keeps who classified it and when.
 */

export const MAX_BATCH = 200;
const TOPIC_IDS = new Set<string>(REPORT_TOPICS.map(topic => topic.id));
const MUNICIPALITIES = new Set<string>(KOSOVO_MUNICIPALITIES);
const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();

export interface ClassifyActor { uid: string; role: string; municipality: string; permissions: readonly string[] }
export interface ClassifyChange { topicCategory?: unknown; municipality?: unknown; zone?: unknown }
export interface ClassifyReport { id: string; municipality: string }

export type ClassifyDecision =
  | { outcome: 'allow'; ids: string[]; patch: { topicCategory?: string; municipality?: string; zone?: Zone } }
  | { outcome: 'deny'; status: 400 | 403 | 404; error: string };

const deny = (status: 400 | 403 | 404, error: string): ClassifyDecision => ({ outcome: 'deny', status, error });

/** May this actor apply this change to these reports? Pure. */
export function decideClassification(input: { actor: ClassifyActor; ids: unknown; change: ClassifyChange; found: ReadonlyArray<ClassifyReport> }): ClassifyDecision {
  const { actor, change } = input;
  const role = pipelineRoleOf(actor.role, actor.permissions);
  const isMunicipality = role === 'municipality';
  if (role !== 'staff' && role !== 'agent' && !isMunicipality) return deny(403, 'Kjo llogari nuk klasifikon raportime.');

  if (!Array.isArray(input.ids) || input.ids.length === 0) return deny(400, 'Zgjidhni të paktën një raport.');
  const ids = [...new Set(input.ids.map(id => String(id ?? '').trim()).filter(Boolean))];
  if (ids.length === 0) return deny(400, 'Zgjidhni të paktën një raport.');
  if (ids.length > MAX_BATCH) return deny(400, `Mund të klasifikohen më së shumti ${MAX_BATCH} raporte njëherësh.`);

  const patch: { topicCategory?: string; municipality?: string; zone?: Zone } = {};
  if (change.topicCategory !== undefined) {
    const topic = String(change.topicCategory);
    if (!TOPIC_IDS.has(topic)) return deny(400, 'Kategoria nuk është e njohur.');
    patch.topicCategory = topic;
  }
  if (change.municipality !== undefined) {
    const municipality = String(change.municipality);
    if (!MUNICIPALITIES.has(municipality)) return deny(400, 'Komuna nuk është e njohur.');
    if (isMunicipality) return deny(403, 'Një komunë nuk i zhvendos raportet te komuna tjetër.');
    patch.municipality = municipality;
  }
  if (change.zone !== undefined) {
    if (change.zone !== 'urban' && change.zone !== 'rural') return deny(400, 'Zona duhet të jetë urbane ose rurale.');
    patch.zone = change.zone;
  }
  if (Object.keys(patch).length === 0) return deny(400, 'Zgjidhni çfarë të ndryshohet: kategorinë, komunën ose zonën.');

  const selected = input.found.filter(report => ids.includes(report.id));
  if (selected.length !== ids.length) return deny(404, 'Një ose më shumë raporte nuk u gjetën.');
  if (isMunicipality && selected.some(report => norm(report.municipality) !== norm(actor.municipality))) {
    // Same answer as "not found": a municipality must not learn that another's report exists.
    return deny(404, 'Një ose më shumë raporte nuk u gjetën.');
  }
  return { outcome: 'allow', ids, patch };
}

export interface ClassificationDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
  actingUser: (req: Request) => { uid: string; email: string; role: string; municipality: string; permissions: string[] };
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
}

export function registerReportClassificationRoutes(app: Express, deps: ClassificationDeps): void {
  app.post('/api/v1/admin/reports/classify', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    try {
      const rawIds = Array.isArray(req.body?.ids) ? (req.body.ids as unknown[]).slice(0, MAX_BATCH + 1) : [];
      const ids = [...new Set(rawIds.map(id => String(id ?? '').trim()).filter(Boolean))];
      const snaps = ids.length && ids.length <= MAX_BATCH
        ? await deps.db().getAll(...ids.map(id => deps.db().collection('reports').doc(id)))
        : [];
      const found = snaps.filter(snap => snap.exists).map(snap => ({
        id: snap.id,
        municipality: String(snap.data()?.location?.municipality ?? ''),
      }));
      const decision = decideClassification({ actor, ids: req.body?.ids, change: req.body ?? {}, found });
      if (decision.outcome === 'deny') {
        deps.audit('report.classify.denied', req, { reason: decision.error, count: ids.length });
        return res.status(decision.status).json({ error: decision.error });
      }

      const now = new Date().toISOString();
      const batch = deps.db().batch();
      const results: Array<{ id: string; responsible: string; level: string; needsZone: boolean }> = [];
      for (const snap of snaps) {
        const data = snap.data() ?? {};
        const municipality = decision.patch.municipality ?? String(data.location?.municipality ?? '');
        const topicId = decision.patch.topicCategory ?? String(data.topicCategory ?? '');
        const zone = (decision.patch.zone ?? (data.zone === 'urban' || data.zone === 'rural' ? data.zone : null)) as Zone | null;
        const resolution = resolveResponsible({ topicId, municipality, zone });

        const update: Record<string, unknown> = {
          responsibleInstitution: resolution.primary.name,
          responsibleLevel: resolution.primary.level === 'central' ? 'Qendrore' : 'Komunale',
          classifiedBy: actor.uid,
          classifiedAt: now,
          updatedAt: now,
        };
        if (decision.patch.topicCategory) update.topicCategory = decision.patch.topicCategory;
        if (decision.patch.zone) update.zone = decision.patch.zone;
        if (decision.patch.municipality) update['location.municipality'] = decision.patch.municipality;
        batch.update(snap.ref, update);
        results.push({ id: snap.id, responsible: resolution.primary.name, level: resolution.primary.level, needsZone: resolution.needsZone });
      }
      await batch.commit();
      deps.audit('report.classify', req, { count: results.length, patch: decision.patch });
      return res.json({ updated: results.length, results, at: now });
    } catch (error: any) {
      console.error('[CLASSIFY] failed:', error?.message);
      return res.status(500).json({ error: 'Klasifikimi nuk u krye. Provoni përsëri.' });
    }
  });
}

