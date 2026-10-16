import { useEffect, useMemo, useState } from 'react';
import { describeApiFailure, requireAdminToken } from '../adminApi';
import { mergeContent, type HeritageContent, type LiveHeritage } from './content';
import type { HeritageEntry, HeritageSettings, HeritageSource, VerificationState } from './types';

/* ── Public ─────────────────────────────────────────────────────────────── */

interface PublicPayload extends LiveHeritage {
  settings: HeritageSettings;
}

let pending: Promise<PublicPayload | null> | null = null;
let loaded: PublicPayload | null | undefined;

/**
 * One request per page load, shared by every component that asks. A failure is remembered as
 * `null` (seed only): the archive must open offline and when the API is down, so the reader
 * never sees an error page where the bundled content could have been shown.
 */
export function loadPublicHeritage(force = false): Promise<PublicPayload | null> {
  if (force) { pending = null; loaded = undefined; }
  if (loaded !== undefined) return Promise.resolve(loaded);
  if (!pending) {
    pending = fetch('/api/public/heritage', { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? (r.json() as Promise<PublicPayload>) : null))
      .catch(() => null)
      .then((payload) => { loaded = payload; return payload; });
  }
  return pending;
}

export function useHeritage(): { content: HeritageContent; settings: HeritageSettings; loading: boolean } {
  const [payload, setPayload] = useState<PublicPayload | null | undefined>(loaded);
  useEffect(() => {
    let alive = true;
    void loadPublicHeritage().then((p) => { if (alive) setPayload(p); });
    return () => { alive = false; };
  }, []);
  const content = useMemo(() => mergeContent(payload ?? null), [payload]);
  return { content, settings: payload?.settings ?? {}, loading: payload === undefined };
}

/* ── Staff ──────────────────────────────────────────────────────────────── */

export interface AdminLogRow {
  id: string;
  entryId: string;
  action: string;
  reason: string;
  actorEmail: string;
  actorRole: string;
  status: string;
  version: number;
  at: string;
}

export interface AdminHeritageState {
  entries: Array<HeritageEntry & { withdrawn?: boolean }>;
  sources: HeritageSource[];
  settings: HeritageSettings;
  log: AdminLogRow[];
  me: { canEdit: boolean; canApprove: boolean; canPublish: boolean; uid: string; role: string };
}

export interface Revision {
  id: string;
  version: number;
  status: string;
  action: string;
  reason: string;
  actorEmail: string;
  actorRole: string;
  at: string;
  snapshot: HeritageEntry;
}

export class HeritageApiError extends Error {
  constructor(message: string, public status: number, public fields?: Record<string, string>) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await requireAdminToken();
  const response = await fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: unknown = null;
  try { data = await response.json(); } catch { /* empty body */ }
  if (!response.ok) {
    const fields = data && typeof data === 'object' && 'errors' in data ? ((data as { errors: Record<string, string> }).errors) : undefined;
    throw new HeritageApiError(describeApiFailure(response.status, data), response.status, fields);
  }
  return data as T;
}

const base = '/api/v1/admin/heritage';

export const heritageAdmin = {
  load: () => call<AdminHeritageState>('GET', base),
  create: (entry: Partial<HeritageEntry>) => call<{ entry: HeritageEntry }>('POST', `${base}/entries`, entry),
  save: (id: string, entry: Partial<HeritageEntry>, expectedVersion: number, note = '') =>
    call<{ entry: HeritageEntry }>('PUT', `${base}/entries/${encodeURIComponent(id)}`, { ...entry, expectedVersion, note }),
  transition: (id: string, to: string, reason = '') => call<{ entry: HeritageEntry }>('POST', `${base}/entries/${encodeURIComponent(id)}/transition`, { to, reason }),
  verify: (id: string, state: VerificationState, note: string) => call<{ entry: HeritageEntry }>('POST', `${base}/entries/${encodeURIComponent(id)}/verify`, { state, note }),
  correct: (id: string, text: { sq: string; en: string }, patch: Record<string, { sq?: string; en?: string }>) =>
    call<{ entry: HeritageEntry }>('POST', `${base}/entries/${encodeURIComponent(id)}/correct`, { text, patch }),
  revisions: (id: string) => call<{ revisions: Revision[] }>('GET', `${base}/entries/${encodeURIComponent(id)}/revisions`),
  remove: (id: string, reason: string) => call<{ ok: true }>('DELETE', `${base}/entries/${encodeURIComponent(id)}`, { reason }),
  importSeed: (ids?: string[]) => call<{ created: number; skipped: number }>('POST', `${base}/import-seed`, { ids }),
  saveSource: (source: Partial<HeritageSource> & { id: string }) => call<{ source: HeritageSource }>('PUT', `${base}/sources/${encodeURIComponent(source.id)}`, source),
  deleteSource: (id: string) => call<{ ok: true }>('DELETE', `${base}/sources/${encodeURIComponent(id)}`),
  saveSettings: (settings: HeritageSettings) => call<{ settings: HeritageSettings }>('PUT', `${base}/settings`, settings),
};
