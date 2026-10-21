import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  collection, getDocs, limit, onSnapshot, orderBy, query, startAfter, where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { ChevronDown, Loader2, MapPin, Radio } from 'lucide-react';
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

export function LiveNoticesFeed({ className }: { className?: string } = {}) {
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
    <section
      aria-label={dt('Njoftime Live')}
      className={cn('flex flex-col overflow-hidden', events.length > 0 && 'min-h-[28rem]', 'overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_18px_50px_-24px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-slate-900', className ?? 'max-h-[36rem]')}
    >
      {/* Masthead */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#0b2b57] via-[#0f3a75] to-[#1d4ed8] px-5 pb-5 pt-5 text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-black uppercase tracking-[0.18em] text-blue-50">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
              </span>
              {dt('Drejtpërdrejt')}
            </span>
            <h3 className="mt-3 font-serif text-2xl font-black leading-none tracking-tight">{dt('Njoftime')}</h3>
            <p className="mt-1.5 text-xs leading-snug text-blue-100/90">{dt('Përgjigjet zyrtare të institucioneve ndaj raportimeve të qytetarëve.')}</p>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <Radio className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>

        {/* Commune filter: the 38 Kosovo municipalities */}
        <div className="relative mt-4">
          <select
            value={municipality}
            onChange={(e) => setMunicipality(e.target.value)}
            aria-label={dt('Filtro sipas komunës')}
            className="w-full appearance-none rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 pr-9 text-xs font-bold text-white outline-none backdrop-blur transition focus:border-white/60 focus:ring-2 focus:ring-white/30 [&>option]:text-slate-900"
          >
            <option value={ALL_MUNICIPALITIES_OPTION}>{dt(ALL_MUNICIPALITIES_OPTION)}</option>
            {KOSOVO_MUNICIPALITIES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-100" aria-hidden="true" />
        </div>
      </header>

      {/* Timeline: scrolls inside the panel so the column runs the full height of the archive. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-width:thin]">
        {events.length === 0 ? (
          <div className="flex h-full min-h-28 flex-col items-center justify-center gap-2 px-4 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-600 dark:text-slate-400 dark:bg-slate-800">
              <Radio className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
              {dt('Ende pa përgjigje publike për këtë komunë.')}
            </p>
          </div>
        ) : (
          <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-px before:bg-slate-200 dark:before:bg-white/10">
            {events.map((ev) => {
              const meta = statusMeta(ev.status);
              const tone = TONE_CLASSES[meta.tone];
              return (
                <li key={ev.id} className="relative pl-7">
                  <span
                    aria-hidden="true"
                    className={cn('absolute left-0 top-4 h-[19px] w-[19px] rounded-full border-4 border-white dark:border-slate-900', tone.dot)}
                  />
                  <Link
                    to={ev.trackId ? `/trackid?id=${encodeURIComponent(ev.trackId)}` : '#'}
                    className="group block rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-slate-800/50 dark:hover:border-blue-500/50 dark:hover:bg-slate-800"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-black', tone.badge)}>
                        {statusLabel(ev.status)}
                      </span>
                      <time className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-400">{relativeWhen(ev.createdAt)}</time>
                    </span>
                    <span className="mt-2 block line-clamp-2 text-[13px] font-extrabold leading-snug text-slate-900 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
                      {ev.reportTitle || dt('Raportim')}
                    </span>
                    {(ev.municipality || ev.actorInstitution) && (
                      <span className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {ev.municipality ? `${dt('Komuna e')} ${ev.municipality}` : ''}
                          {ev.actorInstitution ? ` · ${ev.actorInstitution}` : ''}
                        </span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        )}

        {hasMore && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
          >
            {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {dt('Ngarko më shumë')}
          </button>
        )}
      </div>
    </section>
  );
}

export default LiveNoticesFeed;
