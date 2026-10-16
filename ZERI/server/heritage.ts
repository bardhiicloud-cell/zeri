import type { Express, NextFunction, Request, RequestHandler, Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { SEED_SOURCES } from '../src/lib/heritage/seed/sources';
import type { EntryStatus, HeritageEntry, HeritageSettings, HeritageSource, VerificationState } from '../src/lib/heritage/types';
import { RIGHTS } from '../src/lib/heritage/types';
import {
  checkTransition, canApproveHeritage, canEditHeritage, canPublishHeritage, parseEntryInput, parseSource,
  publishBlockers, type Actor,
} from '../src/lib/heritage/workflow';

/**
 * CMS for the Kosovo identity & history archive.
 *
 *   public   GET  /api/public/heritage                       published entries + sources (cached 60 s)
 *   staff    GET  /api/v1/admin/heritage                     everything, incl. drafts, sources, settings, log
 *            POST /api/v1/admin/heritage/entries             create (always a draft)
 *            PUT  /api/v1/admin/heritage/entries/:id         edit a draft / in-review entry (version-checked)
 *            POST /api/v1/admin/heritage/entries/:id/transition   draft → review → approved → published → archived
 *            POST /api/v1/admin/heritage/entries/:id/verify       fact-check state (a second person)
 *            POST /api/v1/admin/heritage/entries/:id/correct      visible correction on a published entry
 *            GET  /api/v1/admin/heritage/entries/:id/revisions    revision history
 *            DELETE /api/v1/admin/heritage/entries/:id            super-admin, draft/archived only
 *            POST /api/v1/admin/heritage/import-seed              copy bundled entries into the CMS as drafts
 *            PUT/DELETE /api/v1/admin/heritage/sources/:id        the citation register
 *            PUT  /api/v1/admin/heritage/settings                 hero image, emblem, featured ids
 *
 * Authority comes from the verified token (see server/auth.ts); the rules that decide *who may
 * do what* live in src/lib/heritage/workflow.ts and are the same ones the editor UI shows.
 * Browsers never write to these collections (firestore.rules denies it): every change here is
 * made with the Admin SDK, one transaction per change, with a revision and an append-only log.
 */

export interface HeritageDeps {
  db: () => Firestore;
  requireAuth: RequestHandler;
  /** Gate for the `heritage` admin section. */
  requireHeritage: RequestHandler;
  audit: (action: string, req: Request, detail?: Record<string, unknown>) => void;
  /** Role resolved from the verified token. */
  resolveRole: (req: Request) => Promise<string>;
  /** Names the permission claims the caller holds (`perm_*`). */
  permissions: (req: Request) => string[];
  now?: () => Date;
}

const ENTRIES = 'heritageEntries';
const SOURCES = 'heritageSources';
const SETTINGS = 'heritageSettings';
const LOG = 'heritageLog';

const MAX_ENTRIES = 1500;

/** Fields a reader must never receive: staff identities. */
export function toPublicEntry(entry: HeritageEntry): HeritageEntry {
  const { createdBy: _c, updatedBy: _u, editedBy: _e, ...rest } = entry as HeritageEntry & { withdrawn?: boolean };
  delete rest.withdrawn;
  return {
    ...rest,
    verification: { state: entry.verification.state, ...(entry.verification.at ? { at: entry.verification.at } : {}), ...(entry.verification.note ? { note: entry.verification.note } : {}) },
    corrections: entry.corrections.map((c) => ({ at: c.at, text: c.text, by: '' })),
  } as HeritageEntry;
}

let publicCache: { at: number; body: unknown } | null = null;
export const invalidateHeritageCache = () => { publicCache = null; };

export function registerHeritageRoutes(app: Express, deps: HeritageDeps): void {
  const now = () => (deps.now ? deps.now() : new Date());
  const iso = () => now().toISOString();

  const actorOf = async (req: Request): Promise<Actor> => ({
    uid: String(req.user?.uid ?? ''),
    role: await deps.resolveRole(req),
    permissions: deps.permissions(req),
  });

  const guard = (needs: 'edit' | 'approve' | 'publish'): RequestHandler => async (req, res, next) => {
    const actor = await actorOf(req);
    const ok = needs === 'edit' ? canEditHeritage(actor) : needs === 'approve' ? canApproveHeritage(actor) : canPublishHeritage(actor);
    if (!ok) return res.status(403).json({ error: 'Roli juaj nuk e lejon këtë veprim në arkivin e trashëgimisë.' });
    next();
  };

  const readSources = async (): Promise<Map<string, HeritageSource>> => {
    const map = new Map<string, HeritageSource>(SEED_SOURCES.map((s) => [s.id, s]));
    const snap = await deps.db().collection(SOURCES).limit(2000).get();
    snap.forEach((doc) => map.set(doc.id, { ...(doc.data() as HeritageSource), id: doc.id }));
    return map;
  };

  const fail = (res: Response, error: unknown, message: string) => {
    console.error(`[HERITAGE] ${message}`, (error as Error)?.message);
    return res.status(500).json({ error: message });
  };

  // ── Public ────────────────────────────────────────────────────────────────
  app.get('/api/public/heritage', async (_req, res) => {
    try {
      const nowMs = Date.now();
      if (publicCache && nowMs - publicCache.at < 60_000) {
        res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
        return res.json(publicCache.body);
      }
      const [entriesSnap, sources, settingsSnap] = await Promise.all([
        deps.db().collection(ENTRIES).limit(MAX_ENTRIES).get(),
        readSources(),
        deps.db().collection(SETTINGS).doc('main').get(),
      ]);
      const entries: HeritageEntry[] = [];
      const hiddenIds: string[] = [];
      entriesSnap.forEach((doc) => {
        const data = doc.data() as HeritageEntry & { withdrawn?: boolean };
        if (data.status === 'published') entries.push(toPublicEntry({ ...data, id: doc.id }));
        else if (data.withdrawn === true) hiddenIds.push(doc.id);
      });
      const settings = settingsSnap.exists ? (settingsSnap.data() as HeritageSettings) : {};
      const body = {
        entries, hiddenIds,
        sources: [...sources.values()].filter((s) => s.origin !== 'seed'),
        settings: { heroImageUrl: settings.heroImageUrl ?? '', heroCredit: settings.heroCredit ?? '', emblemUrl: settings.emblemUrl ?? '', featuredIds: settings.featuredIds ?? [] },
        generatedAt: iso(),
      };
      publicCache = { at: nowMs, body };
      res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
      return res.json(body);
    } catch (error) {
      return fail(res, error, 'Nuk mund të ngarkohet arkivi.');
    }
  });

  // ── Staff: read ───────────────────────────────────────────────────────────
  const staff: RequestHandler[] = [deps.requireAuth, deps.requireHeritage];

  app.get('/api/v1/admin/heritage', ...staff, async (req, res) => {
    try {
      const [entriesSnap, sources, settingsSnap, logSnap] = await Promise.all([
        deps.db().collection(ENTRIES).limit(MAX_ENTRIES).get(),
        readSources(),
        deps.db().collection(SETTINGS).doc('main').get(),
        deps.db().collection(LOG).orderBy('at', 'desc').limit(100).get(),
      ]);
      const entries: HeritageEntry[] = [];
      entriesSnap.forEach((doc) => entries.push({ ...(doc.data() as HeritageEntry), id: doc.id }));
      const log: unknown[] = [];
      logSnap.forEach((doc) => log.push({ id: doc.id, ...doc.data() }));
      const actor = await actorOf(req);
      return res.json({
        entries, sources: [...sources.values()], settings: settingsSnap.exists ? settingsSnap.data() : {}, log,
        me: { canEdit: canEditHeritage(actor), canApprove: canApproveHeritage(actor), canPublish: canPublishHeritage(actor), uid: actor.uid, role: actor.role },
      });
    } catch (error) {
      return fail(res, error, 'Nuk mund të ngarkohet CMS-i i arkivit.');
    }
  });

  app.get('/api/v1/admin/heritage/entries/:id/revisions', ...staff, async (req, res) => {
    try {
      const snap = await deps.db().collection(ENTRIES).doc(req.params.id).collection('revisions').orderBy('version', 'desc').limit(100).get();
      const rows: unknown[] = [];
      snap.forEach((doc) => rows.push({ id: doc.id, ...doc.data() }));
      return res.json({ revisions: rows });
    } catch (error) {
      return fail(res, error, 'Nuk mund të ngarkohet historiku.');
    }
  });

  /** Write one change atomically: the entry, its revision snapshot and the append-only log line. */
  const commit = async (
    id: string,
    action: string,
    req: Request,
    mutate: (current: HeritageEntry | null, actor: Actor) => { next: HeritageEntry | null; extra?: Record<string, unknown>; reason?: string } | { error: { status: number; message: string } },
  ): Promise<{ status: number; body: Record<string, unknown> }> => {
    const actor = await actorOf(req);
    const db = deps.db();
    const ref = db.collection(ENTRIES).doc(id);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists ? ({ ...(snap.data() as HeritageEntry), id } as HeritageEntry) : null;
      const out = mutate(current, actor);
      if ('error' in out) return { status: out.error.status, body: { error: out.error.message } };
      const stamp = iso();
      const logRef = db.collection(LOG).doc();
      if (out.next === null) {
        tx.delete(ref);
      } else {
        const next = { ...out.next, id, updatedAt: stamp, updatedBy: actor.uid };
        tx.set(ref, { ...next, ...(out.extra ?? {}) });
        tx.set(ref.collection('revisions').doc(`v${String(next.version).padStart(5, '0')}-${Date.now()}`), {
          version: next.version, status: next.status, snapshot: next, action, reason: out.reason ?? '',
          actorUid: actor.uid, actorEmail: req.user?.email ?? '', actorRole: actor.role, at: stamp,
        });
      }
      tx.set(logRef, {
        entryId: id, action, reason: out.reason ?? '', actorUid: actor.uid, actorEmail: req.user?.email ?? '', actorRole: actor.role,
        status: out.next?.status ?? 'deleted', version: out.next?.version ?? 0, at: stamp,
      });
      return { status: 200, body: { ok: true, entry: out.next } };
    });
    if (result.status === 200) {
      invalidateHeritageCache();
      deps.audit(`heritage.${action}`, req, { entryId: id });
    }
    return result;
  };

  const send = (res: Response, r: { status: number; body: Record<string, unknown> }) => res.status(r.status).json(r.body);

  // ── Staff: entries ────────────────────────────────────────────────────────
  app.post('/api/v1/admin/heritage/entries', ...staff, guard('edit'), async (req, res) => {
    try {
      const parsed = parseEntryInput(req.body);
      if (parsed.ok === false) return res.status(400).json({ error: 'Të dhënat nuk janë të vlefshme.', errors: parsed.errors });
      const stamp = iso();
      const actor = await actorOf(req);
      const r = await commit(parsed.value.id, 'create', req, (current) => {
        if (current) return { error: { status: 409, message: `ID "${parsed.value.id}" ekziston tashmë.` } };
        return {
          next: {
            ...parsed.value, status: 'draft', version: 1, origin: 'cms', corrections: [],
            verification: { state: 'unverified' }, createdAt: stamp, createdBy: actor.uid, editedBy: actor.uid,
          } as HeritageEntry,
          extra: { withdrawn: false },
        };
      });
      return send(res, r);
    } catch (error) {
      return fail(res, error, 'Nuk mund të krijohet shënimi.');
    }
  });

  app.put('/api/v1/admin/heritage/entries/:id', ...staff, guard('edit'), async (req, res) => {
    try {
      const parsed = parseEntryInput({ ...req.body, id: req.params.id });
      if (parsed.ok === false) return res.status(400).json({ error: 'Të dhënat nuk janë të vlefshme.', errors: parsed.errors });
      const expected = Number(req.body?.expectedVersion);
      const r = await commit(req.params.id, 'edit', req, (current, actor) => {
        if (!current) return { error: { status: 404, message: 'Shënimi nuk ekziston.' } };
        if (current.status === 'published' || current.status === 'approved' || current.status === 'archived') {
          return { error: { status: 409, message: current.status === 'published' ? 'Shënimi është i publikuar: përdorni "Korrigjim" ose tërhiqeni në draft me arsye.' : `Shënimi është "${current.status}": kthejeni në draft para redaktimit.` } };
        }
        if (Number.isFinite(expected) && expected !== current.version) {
          return { error: { status: 409, message: 'Dikush tjetër e ndryshoi këtë shënim. Ringarkoni dhe bashkoni ndryshimet.' } };
        }
        return {
          // A content change invalidates an earlier fact-check.
          next: { ...current, ...parsed.value, version: current.version + 1, verification: { state: 'unverified' }, editedBy: actor.uid },
          reason: String(req.body?.note ?? '').slice(0, 300),
        };
      });
      return send(res, r);
    } catch (error) {
      return fail(res, error, 'Nuk mund të ruhet shënimi.');
    }
  });

  app.post('/api/v1/admin/heritage/entries/:id/transition', ...staff, async (req, res) => {
    try {
      const to = String(req.body?.to ?? '') as EntryStatus;
      const reason = String(req.body?.reason ?? '').trim().slice(0, 500);
      const sources = to === 'published' ? await readSources() : new Map<string, HeritageSource>();
      const r = await commit(req.params.id, `to-${to}`, req, (current, actor) => {
        if (!current) return { error: { status: 404, message: 'Shënimi nuk ekziston.' } };
        const check = checkTransition(current, to, actor, reason);
        if (check.ok === false) return { error: { status: check.status, message: check.error } };
        if (to === 'published') {
          const blockers = publishBlockers(current, sources);
          if (blockers.length) return { error: { status: 409, message: `Nuk publikohet: ${blockers.map((b) => b.message).join(' ')}` } };
        }
        const stamp = iso();
        const next: HeritageEntry = { ...current, status: to, version: current.version + 1 };
        if (to === 'published') next.publishedAt = stamp;
        // Going back to draft after being public drops the "verified" mark: the text will change.
        if (to === 'draft' && current.status !== 'archived') next.verification = { state: 'unverified' };
        const withdrawn = (current.status === 'published' && to !== 'published') ? true : undefined;
        return { next, reason, extra: withdrawn === undefined ? (to === 'published' ? { withdrawn: false } : {}) : { withdrawn } };
      });
      return send(res, r);
    } catch (error) {
      return fail(res, error, 'Nuk mund të ndryshohet statusi.');
    }
  });

  app.post('/api/v1/admin/heritage/entries/:id/verify', ...staff, guard('approve'), async (req, res) => {
    try {
      const state = String(req.body?.state ?? '') as VerificationState;
      if (!['unverified', 'in-review', 'verified'].includes(state)) return res.status(400).json({ error: 'Gjendja e verifikimit është e pavlefshme.' });
      const note = String(req.body?.note ?? '').trim().slice(0, 500);
      const r = await commit(req.params.id, `verify-${state}`, req, (current, actor) => {
        if (!current) return { error: { status: 404, message: 'Shënimi nuk ekziston.' } };
        if (state === 'verified') {
          if (note.length < 8) return { error: { status: 400, message: 'Shkruani çfarë u kontrollua (të paktën 8 shkronja).' } };
          if ((current.editedBy ?? current.updatedBy) === actor.uid && actor.role !== 'superadmin') {
            return { error: { status: 403, message: 'Verifikimi duhet bërë nga një person tjetër nga redaktori i fundit.' } };
          }
        }
        return {
          next: { ...current, version: current.version + 1, verification: { state, by: req.user?.email ?? actor.uid, at: iso().slice(0, 10), note } },
          reason: note,
        };
      });
      return send(res, r);
    } catch (error) {
      return fail(res, error, 'Nuk mund të ruhet verifikimi.');
    }
  });

  app.post('/api/v1/admin/heritage/entries/:id/correct', ...staff, guard('publish'), async (req, res) => {
    try {
      const sq = String(req.body?.text?.sq ?? '').trim().slice(0, 600);
      const en = String(req.body?.text?.en ?? '').trim().slice(0, 600);
      if (sq.length < 8) return res.status(400).json({ error: 'Shkruani përshkrimin e korrigjimit (shqip, të paktën 8 shkronja).' });
      const patch = (req.body?.patch ?? {}) as Record<string, { sq?: string; en?: string }>;
      const r = await commit(req.params.id, 'correct', req, (current, actor) => {
        if (!current) return { error: { status: 404, message: 'Shënimi nuk ekziston.' } };
        if (current.status !== 'published') return { error: { status: 409, message: 'Korrigjimet e dukshme vlejnë vetëm për shënime të publikuara.' } };
        const next: HeritageEntry = { ...current, version: current.version + 1, editedBy: actor.uid };
        for (const field of ['title', 'summary', 'body'] as const) {
          const p = patch[field];
          if (p && (typeof p.sq === 'string' || typeof p.en === 'string')) {
            next[field] = { sq: typeof p.sq === 'string' ? p.sq.slice(0, 24000) : current[field].sq, en: typeof p.en === 'string' ? p.en.slice(0, 24000) : current[field].en };
          }
        }
        next.corrections = [...current.corrections, { at: iso().slice(0, 10), text: { sq, en }, by: req.user?.email ?? actor.uid }];
        return { next, reason: sq };
      });
      return send(res, r);
    } catch (error) {
      return fail(res, error, 'Nuk mund të regjistrohet korrigjimi.');
    }
  });

  app.delete('/api/v1/admin/heritage/entries/:id', ...staff, async (req, res) => {
    try {
      const r = await commit(req.params.id, 'delete', req, (current, actor) => {
        if (!current) return { error: { status: 404, message: 'Shënimi nuk ekziston.' } };
        if (actor.role !== 'superadmin') return { error: { status: 403, message: 'Fshirja e përhershme është vetëm për superadminin. Arkivojeni në vend.' } };
        if (current.status !== 'draft' && current.status !== 'archived') return { error: { status: 409, message: 'Fshihen vetëm draftet dhe të arkivuarat.' } };
        return { next: null, reason: String(req.body?.reason ?? '') };
      });
      return send(res, r);
    } catch (error) {
      return fail(res, error, 'Nuk mund të fshihet shënimi.');
    }
  });

  app.post('/api/v1/admin/heritage/import-seed', ...staff, guard('publish'), async (req, res) => {
    try {
      const { SEED_ENTRIES } = await import('../src/lib/heritage/seed');
      const wanted = Array.isArray(req.body?.ids) ? new Set<string>(req.body.ids.map(String)) : null;
      const db = deps.db();
      const actor = await actorOf(req);
      const stamp = iso();
      let created = 0;
      let skipped = 0;
      for (const seed of SEED_ENTRIES) {
        if (wanted && !wanted.has(seed.id)) continue;
        const ref = db.collection(ENTRIES).doc(seed.id);
        const done = await db.runTransaction(async (tx) => {
          if ((await tx.get(ref)).exists) return false;
          const copy: HeritageEntry = { ...seed, status: 'draft', origin: 'seed', version: 1, createdAt: stamp, updatedAt: stamp, createdBy: actor.uid, updatedBy: actor.uid, editedBy: actor.uid };
          tx.set(ref, { ...copy, withdrawn: false });
          tx.set(db.collection(LOG).doc(), { entryId: seed.id, action: 'import-seed', reason: '', actorUid: actor.uid, actorEmail: req.user?.email ?? '', actorRole: actor.role, status: 'draft', version: 1, at: stamp });
          return true;
        });
        if (done) created += 1; else skipped += 1;
      }
      invalidateHeritageCache();
      deps.audit('heritage.import-seed', req, { created, skipped });
      return res.json({ ok: true, created, skipped });
    } catch (error) {
      return fail(res, error, 'Importimi dështoi.');
    }
  });

  // ── Staff: sources ────────────────────────────────────────────────────────
  app.put('/api/v1/admin/heritage/sources/:id', ...staff, guard('edit'), async (req, res) => {
    try {
      const parsed = parseSource({ ...req.body, id: req.params.id });
      if (parsed.ok === false) return res.status(400).json({ error: 'Burimi nuk është i vlefshëm.', errors: parsed.errors });
      const actor = await actorOf(req);
      const ref = deps.db().collection(SOURCES).doc(req.params.id);
      const previous = (await ref.get()).data() as HeritageSource | undefined;
      const seedSource = SEED_SOURCES.find((s) => s.id === req.params.id);
      const wasChecked = previous?.linkChecked ?? false;
      const stamp = iso();
      const value: HeritageSource = {
        ...parsed.value, origin: 'cms', updatedAt: stamp,
        // The date of the check is stamped by the server, never typed.
        ...(parsed.value.linkChecked ? { linkChecked: true, linkCheckedAt: wasChecked && previous?.linkCheckedAt ? previous.linkCheckedAt : stamp.slice(0, 10) } : { linkChecked: false }),
      };
      if (!parsed.value.linkChecked) delete value.linkCheckedAt;
      await ref.set({ ...value, updatedBy: actor.uid });
      invalidateHeritageCache();
      deps.audit('heritage.source.save', req, { sourceId: req.params.id, overridesSeed: !!seedSource });
      return res.json({ ok: true, source: value });
    } catch (error) {
      return fail(res, error, 'Nuk mund të ruhet burimi.');
    }
  });

  app.delete('/api/v1/admin/heritage/sources/:id', ...staff, guard('publish'), async (req, res) => {
    try {
      const db = deps.db();
      const used = await db.collection(ENTRIES).limit(MAX_ENTRIES).get();
      let inUse = false;
      used.forEach((doc) => {
        const e = doc.data() as HeritageEntry;
        if (e.sourceIds?.includes(req.params.id) || e.claims?.some((c) => c.sourceIds.includes(req.params.id))) inUse = true;
      });
      if (inUse) return res.status(409).json({ error: 'Burimi përdoret nga shënime; hiqeni nga ato së pari.' });
      await db.collection(SOURCES).doc(req.params.id).delete();
      invalidateHeritageCache();
      deps.audit('heritage.source.delete', req, { sourceId: req.params.id });
      return res.json({ ok: true });
    } catch (error) {
      return fail(res, error, 'Nuk mund të fshihet burimi.');
    }
  });

  // ── Staff: settings ───────────────────────────────────────────────────────
  app.put('/api/v1/admin/heritage/settings', ...staff, guard('publish'), async (req, res) => {
    try {
      const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
      const https = (v: unknown) => { const s = clip(v, 800); return s === '' || /^https:\/\/\S+$/.test(s) ? s : null; };
      const hero = https(req.body?.heroImageUrl);
      const emblem = https(req.body?.emblemUrl);
      if (hero === null || emblem === null) return res.status(400).json({ error: 'Lidhjet e imazheve duhet të fillojnë me https://' });
      const rights = (RIGHTS as readonly string[]).includes(req.body?.heroRights) ? req.body.heroRights : 'unknown';
      if (hero && (rights === 'unknown' || !clip(req.body?.heroCredit, 200))) {
        return res.status(400).json({ error: 'Foto e kreut kërkon kredi dhe të drejtë përdorimi të njohur.' });
      }
      const featuredIds = Array.isArray(req.body?.featuredIds) ? req.body.featuredIds.map((x: unknown) => clip(x, 80)).filter(Boolean).slice(0, 12) : [];
      const value: HeritageSettings = { heroImageUrl: hero, heroCredit: clip(req.body?.heroCredit, 200), heroRights: rights, emblemUrl: emblem, featuredIds, updatedAt: iso() };
      await deps.db().collection(SETTINGS).doc('main').set(value);
      invalidateHeritageCache();
      deps.audit('heritage.settings', req, {});
      return res.json({ ok: true, settings: value });
    } catch (error) {
      return fail(res, error, 'Nuk mund të ruhen cilësimet.');
    }
  });
}

/** Re-exported so server.ts and the tests share one name for the middleware type. */
export type { NextFunction };
