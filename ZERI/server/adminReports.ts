import type { Express, Request, RequestHandler, Response } from 'express';
import { FieldPath, Timestamp, type Firestore } from 'firebase-admin/firestore';
import {
  encodeCursor,
  parseReportListQuery,
  planReportQuery,
  presentReport,
  type Principal,
} from './reportQuery';

/**
 * GET /api/v1/admin/reports — one page of reports, filtered and authorised on the
 * server.
 *
 * Replaces "load the newest 100 and filter in the browser". The caller gets at
 * most MAX_PAGE_SIZE reports plus an opaque cursor for the next page, and (on
 * the first page only) an exact total from Firestore's count aggregation, which
 * reads index entries rather than documents.
 *
 * Authorisation is not in this file: `planReportQuery` decides, from the verified
 * token, what the caller may see. This function only runs the resulting plan and
 * re-checks each row against it before sending (defence in depth: a row outside
 * the caller's jurisdiction is dropped and logged, never returned).
 *
 * Dependencies are injected so the route does not import server.ts (which starts
 * the whole application) and so it can be exercised with fakes.
 */
export interface AdminReportDeps {
  requireAuth: RequestHandler;
  db: () => Firestore;
  actingUser: (req: Request) => { uid: string; email: string; role: string; municipality: string; permissions: string[] };
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
  /** The firewall's status check, applied again to every outgoing row. */
  canSeeReportStatus: (actor: { role: string }, status: string) => boolean;
}

export function registerAdminReportRoutes(app: Express, deps: AdminReportDeps): void {
  app.get('/api/v1/admin/reports', deps.requireAuth, async (req: Request, res: Response) => {
    const actor = deps.actingUser(req);
    const principal: Principal = {
      uid: actor.uid,
      role: actor.role,
      municipality: actor.municipality,
      permissions: actor.permissions,
    };

    const parsed = parseReportListQuery(req.query as Record<string, unknown>);
    if (parsed.ok === false) return res.status(parsed.status).json({ error: parsed.error });

    const planned = planReportQuery(parsed.query, principal);
    if (planned.ok === false) {
      // A refusal is evidence of something: a role without the section, or a
      // municipality reaching for another's data. Record it.
      deps.audit('admin.reports.list.denied', req, {
        reason: planned.error,
        requestedMunicipality: parsed.query.municipality ?? null,
        requestedStatus: parsed.query.status ?? null,
      });
      return res.status(planned.status).json({ error: planned.error });
    }

    const { plan } = planned;
    res.setHeader('Cache-Control', 'private, no-store');
    if (plan.empty) return res.json({ items: [], nextCursor: null, total: 0 });

    // Exact lookup by tracking code or id: one report out of any number. The same
    // per-row visibility check as a list applies, so a municipality that types
    // another municipality's code (or a pending report's) simply finds nothing.
    if (plan.code) {
      try {
        const [byCode, byId] = await Promise.all([
          deps.db().collection('reports').where('trackingId', '==', plan.code).limit(plan.limit).get(),
          deps.db().collection('reports').doc(plan.code).get(),
        ]);
        const found = new Map<string, Record<string, unknown>>();
        byCode.docs.forEach(doc => found.set(doc.id, doc.data() as Record<string, unknown>));
        if (byId.exists) found.set(byId.id, byId.data() as Record<string, unknown>);

        const items: Array<Record<string, unknown>> = [];
        for (const [id, data] of found) {
          const municipality = String((data.location as { municipality?: unknown } | undefined)?.municipality ?? '');
          const hidden =
            (principal.role === 'municipality' && municipality !== principal.municipality) ||
            !deps.canSeeReportStatus({ role: principal.role }, String(data.status ?? ''));
          if (!hidden) items.push(presentReport(id, data, principal));
        }
        return res.json({ items, nextCursor: null, total: items.length });
      } catch (error) {
        console.error('[REPORTS] code lookup failed:', error?.message);
        return res.status(500).json({ error: 'Raporti nuk u gjet. Provoni përsëri.' });
      }
    }

    try {
      let filtered: FirebaseFirestore.Query = deps.db().collection('reports');
      for (const clause of plan.where) {
        filtered = filtered.where(clause.field, clause.op, clause.value);
      }

      const direction = plan.direction === 'asc' ? 'asc' : 'desc';
      let page = filtered.orderBy('createdAt', direction).orderBy(FieldPath.documentId(), direction);
      if (plan.cursor) {
        const { value, id } = plan.cursor;
        page = page.startAfter(typeof value === 'number' ? Timestamp.fromMillis(value) : value, id);
      }
      page = page.limit(plan.limit + 1);

      // The total is computed once, on the first page, and echoed by the client.
      const [snapshot, total] = await Promise.all([
        page.get(),
        plan.cursor ? Promise.resolve(null) : filtered.count().get().then(result => result.data().count),
      ]);

      const docs = snapshot.docs;
      const hasMore = docs.length > plan.limit;
      const pageDocs = hasMore ? docs.slice(0, plan.limit) : docs;

      const items: Array<Record<string, unknown>> = [];
      for (const doc of pageDocs) {
        const data = doc.data() as Record<string, unknown>;
        const status = String(data.status ?? '');
        const municipality = String((data.location as { municipality?: unknown } | undefined)?.municipality ?? '');

        const outsideJurisdiction = principal.role === 'municipality' && municipality !== principal.municipality;
        if (outsideJurisdiction || !deps.canSeeReportStatus({ role: principal.role }, status)) {
          console.error(`[REPORTS] row ${doc.id} outside the caller's visibility was dropped`);
          continue;
        }
        items.push(presentReport(doc.id, data, principal));
      }

      const last = pageDocs[pageDocs.length - 1];
      const lastCreated = last?.get('createdAt') as Timestamp | string | undefined;
      const cursorValue =
        lastCreated && typeof (lastCreated as Timestamp).toMillis === 'function'
          ? (lastCreated as Timestamp).toMillis()
          : typeof lastCreated === 'string' && lastCreated
            ? lastCreated
            : null;
      const nextCursor = hasMore && last && cursorValue !== null ? encodeCursor({ value: cursorValue, id: last.id }) : null;

      return res.json({ items, nextCursor, total });
    } catch (error) {
      // `failed-precondition` means a composite index is missing: say so, because
      // it is a deployment gap, not a bad request.
      const missingIndex = error?.code === 9 || /index/i.test(String(error?.message ?? ''));
      console.error('[REPORTS] admin list failed:', error?.message);
      return res.status(missingIndex ? 503 : 500).json({
        error: missingIndex
          ? 'Indeksi i kërkuar nuk është aktivizuar ende. Njoftoni administratorin e sistemit.'
          : 'Raportet nuk u ngarkuan. Provoni përsëri.',
      });
    }
  });
}
