import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  collection, getDocs, limit, onSnapshot, orderBy, query, startAfter, where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { ChevronDown, Loader2, Radio } from 'lucide-react';
import { db } from '../../lib/firebase';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import { statusLabel, statusMeta, TONE_CLASSES } from '@/src/lib/reportStatus';
import { KOSOVO_MUNICIPALITIES, ALL_MUNICIPALITIES_OPTION } from '@/src/lib/constants';
import type { ReportEvent } from '@/src/types';

/**
 * "Njoftime Live" — the live commune-response feed in the news sidebar.
 *
 * Backed by the `report_events` collection the server writes on every report
 * status transition (server.ts transition endpoint). Only events the server
 * marked `isPublic` are readable by citizens (firestore.rules), so anonymous
 * reports never leak into a public feed. Page 0 is an onSnapshot so new
 * responses appear without a reload; older pages are cursor-paginated with
 * startAfter, matching the composite indexes already declared in
 * firestore.indexes.json (isPublic+createdAt, and municipality+isPublic+createdAt).
 */

const PAGE_SIZE = 6;

function relativeWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return dt('tani');
  if (mins < 60) return `${mins} ${dt('min më parë')}`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${dt('orë më parë')}`;
  const days = Math.round(hours / 24);
  return `${days} ${dt('ditë më parë')}`;
}

export function LiveNoticesFeed() {
  const [municipality, setMunicipality] = useState<string>(ALL_MUNICIPALITIES_OPTION);
  const [pages, setPages] = useState<ReportEvent[][]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursorRefs = useRef<QueryDocumentSnapshot[]>([]);

  const buildQuery = useCallback((muni: string, cursor?: QueryDocumentSnapshot) => {
    const constraints = muni === ALL_MUNICIPALITIES_OPTION
      ? [where('isPublic', '==', true), orderBy('createdAt', 'desc')]
      : [where('municipality', '==', muni), where('isPublic', '==', true), orderBy('createdAt', 'desc')];
    return query(collection(db, 'report_events'), ...constraints, ...(cursor ? [startAfter(cursor)] : []), limit(PAGE_SIZE));
  }, []);

  // Page 0 stays live.
  useEffect(() => {
    setPages([]);
    cursorRefs.current = [];
    setHasMore(false);
    const q = buildQuery(municipality);
    return onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ReportEvent);
        cursorRefs.current[0] = snap.docs[snap.docs.length - 1] as QueryDocumentSnapshot;
        setHasMore(snap.docs.length === PAGE_SIZE);
        setPages((prev) => [docs, ...prev.slice(1)]);
      },
      (err) => console.error('Njoftimet live nuk u ngarkuan:', err),
    );
  }, [municipality, buildQuery]);

  const loadMore = async () => {
    const lastIndex = pages.length - 1;
    const cursor = cursorRefs.current[lastIndex];
    if (loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const snap = await getDocs(buildQuery(municipality, cursor));
      const docs = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ReportEvent);
      cursorRefs.current[lastIndex + 1] = snap.docs[snap.docs.length - 1] as QueryDocumentSnapshot;
      setHasMore(snap.docs.length === PAGE_SIZE);
      setPages((prev) => [...prev, docs]);
    } catch (err) {
      console.error('Faqja tjetër e njoftimeve live nuk u ngarkua:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Flatten + dedup (a live page-0 update can overlap an already-loaded page).
  const events = (() => {
    const seen = new Set<string>();
    const out: ReportEvent[] = [];
    for (const page of pages) {
      for (const ev of page) {
        if (seen.has(ev.id)) continue;
        seen.add(ev.id);
        out.push(ev);
      }
    }
    return out;
  })();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-white/10">
        <span className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-600" />
          </span>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">{dt('Njoftime Live')}</h3>
        </span>
        <Radio className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />
      </div>

      {/* Commune filter — the 38 Kosovo municipalities */}
      <div className="relative mb-3">
        <select
          value={municipality}
          onChange={(e) => setMunicipality(e.target.value)}
          aria-label={dt('Filtro sipas komunës')}
          className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 pr-8 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value={ALL_MUNICIPALITIES_OPTION}>{dt(ALL_MUNICIPALITIES_OPTION)}</option>
          {KOSOVO_MUNICIPALITIES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      </div>

      {events.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">
          {dt('Ende pa përgjigje publike për këtë komunë.')}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {events.map((ev) => {
            const meta = statusMeta(ev.status);
            const tone = TONE_CLASSES[meta.tone];
            return (
              <li key={ev.id}>
                <Link
                  to={ev.trackId ? `/trackid?id=${encodeURIComponent(ev.trackId)}` : '#'}
                  className="group block py-2.5"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', tone.badge)}>
                      {statusLabel(ev.status)}
                    </span>
                    <span className="text-[10px] text-slate-400">{relativeWhen(ev.createdAt)}</span>
                  </span>
                  <span className="mt-1 block line-clamp-2 text-xs font-bold leading-snug text-slate-800 group-hover:text-blue-700 dark:text-slate-200 dark:group-hover:text-blue-300">
                    {ev.reportTitle || dt('Raportim')}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-slate-400">
                    {ev.municipality ? `${dt('Komuna e')} ${ev.municipality}` : ''}
                    {ev.actorInstitution ? ` · ${ev.actorInstitution}` : ''}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
        >
          {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {dt('Ngarko më shumë')}
        </button>
      )}
    </div>
  );
}

export default LiveNoticesFeed;
