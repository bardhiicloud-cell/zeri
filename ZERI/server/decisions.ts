import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { DECISION_KINDS, decide, patchFor, type DecisionKind } from '../src/lib/decisionRules';
import { mayUseSection } from './policy';
import { featuresFor } from './municipalityPlans';

/**
 * The acceptance system's routes. The rules themselves are in
 * src/lib/decisionRules.ts, shared with the screens. Here the server checks who
 * may decide, writes the change in a transaction, keeps a private history of every
 * decision (`<collection>/{id}/decisions`, unreadable to clients) and writes the
 * audit log.
 */

export interface DecisionDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
  actingUser: (req: Request) => { uid: string; email: string; role: string; municipality: string; permissions: string[] };
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
}

export function registerDecisionRoutes(app: Express, deps: DecisionDeps): void {
  app.post('/api/v1/admin/decisions/:kind/:id', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    const kindParam = String(req.params.kind ?? '');
    const id = String(req.params.id ?? '').trim();
    const rule = DECISION_KINDS[kindParam as DecisionKind];
    if (!rule || !id) return res.status(400).json({ error: 'Kërkesa nuk është e plotë.' });

    try {
      const ref = deps.db().collection(rule.collection).doc(id);
      const now = new Date().toISOString();
      let actorName = '';
      try {
        const profile = await deps.db().collection('users').doc(actor.uid).get();
        actorName = String(profile.data()?.name ?? '');
      } catch { /* display only */ }

      // A municipality's entitlements come from its plan, read from the profile only the
      // server can write.
      let planDoc: unknown;
      if (actor.role === 'municipality') {
        try {
          planDoc = (await deps.db().collection('users').doc(actor.uid).get()).data()?.municipalityPlan;
        } catch { /* falls back to the basic plan */ }
      }

      // Read-decide-write in one transaction: two staff deciding the same record
      // at once get one success and one "someone else changed it".
      const result = await deps.db().runTransaction(async tx => {
        const snap = await tx.get(ref);
        const decision = decide({
          actor: { ...actor, features: actor.role === 'municipality' ? [...featuresFor(planDoc)] : undefined },
          kind: kindParam,
          action: req.body?.action,
          reason: req.body?.reason,
          doc: snap.exists ? (snap.data() as Record<string, any>) : null,
        });
        if (decision.outcome === 'deny') return decision;

        const campaignId = typeof req.body?.campaignId === 'string' ? req.body.campaignId.trim().slice(0, 128) : '';
        tx.update(ref, {
          ...patchFor(decision.kind, decision.action, now, { reason: decision.reason, campaignId }),
          decidedAt: now,
          updatedAt: now,
        });
        tx.set(ref.collection('decisions').doc(), {
          action: decision.action,
          label: decision.label,
          from: decision.from,
          to: decision.to,
          reason: decision.reason || null,
          byUid: actor.uid,
          byName: actorName || actor.email || actor.uid,
          byRole: actor.role,
          at: now,
          createdAt: FieldValue.serverTimestamp(),
        });
        return decision;
      });

      if (result.outcome === 'deny') {
        deps.audit(`decision.${kindParam}.denied`, req, { id, action: req.body?.action ?? null, reason: result.error });
        return res.status(result.status).json({ error: result.error });
      }
      deps.audit(`decision.${result.kind}.${result.action}`, req, { id, from: result.from, to: result.to, reason: result.reason || null });
      return res.json({ ok: true, state: result.to, action: result.action });
    } catch (error: any) {
      console.error('[DECISIONS] failed:', error?.message);
      return res.status(500).json({ error: 'Vendimi nuk u ruajt. Provoni përsëri.' });
    }
  });

  /** Every decision ever taken on one record, newest first. Same access as deciding. */
  app.get('/api/v1/admin/decisions/:kind/:id', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    const rule = DECISION_KINDS[String(req.params.kind ?? '') as DecisionKind];
    if (!rule) return res.status(400).json({ error: 'Lloji i punës nuk njihet.' });
    const owner = actor.role === 'admin' || actor.role === 'superadmin';
    const allowed = owner || actor.role === 'monitor' || mayUseSection({ role: actor.role, permissions: actor.permissions }, rule.section);
    if (!allowed) return res.status(403).json({ error: 'Nuk keni qasje në këtë histori.' });
    try {
      const snap = await deps.db().collection(rule.collection).doc(String(req.params.id)).collection('decisions').orderBy('at', 'desc').limit(100).get();
      return res.json({ items: snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: undefined })) });
    } catch (error: any) {
      console.error('[DECISIONS] history failed:', error?.message);
      return res.status(500).json({ error: 'Historia nuk u lexua.' });
    }
  });

  /** The action table, so screens draw only the buttons the server will accept. */
  app.get('/api/v1/admin/decision-rules', deps.requireAuth, (_req: Request, res: Response) => {
    const out = Object.fromEntries(
      Object.entries(DECISION_KINDS).map(([kind, rule]) => [
        kind,
        Object.fromEntries(Object.entries(rule.actions).map(([name, a]) => [name, { label: a.label, from: a.from, to: a.to, needsReason: !!a.needsReason }])),
      ])
    );
    res.json(out);
  });
}
