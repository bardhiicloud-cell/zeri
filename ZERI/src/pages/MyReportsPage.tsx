import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { ChevronRight, FolderOpen, HeartPulse, Megaphone, PlusCircle, Search, Wallet, FileText } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { auth, db } from '../lib/firebase';
import { cn } from '../lib/utils';
import { statusLabel, statusMeta, TONE_CLASSES } from '../lib/reportStatus';
import { getGuestReportHistory } from '../lib/session';
import { PageHero } from '../components/layout/PageHero';

/**
 * "Raportet e mia": everything this citizen sent, in one list.
 *
 * Two sources, merged by Track ID:
 *  - this device's history (src/lib/session.ts), written by every form when it
 *    issues a code: reports (ZQ-), news tips (LJ-), donations (DN-), health (HC-);
 *  - the signed-in account's own reports in Firestore (authorId == uid), so a
 *    report sent from another device under the same account shows up too.
 *
 * Each row opens /trackid, which decides what is public. Nothing here is shared:
 * the page reads only what the device stored and the account's own reports.
 */

type Kind = 'report' | 'news' | 'donation' | 'health';

interface Row {
  trackingId: string;
  title: string;
  kind: Kind;
  status: string | null;
  municipality: string;
  createdAt: string | null;
}

const KIND: Record<Kind, { label: string; icon: typeof FileText; tone: string }> = {
  report: { label: 'Raportim', icon: FileText, tone: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
  news: { label: 'Lajm', icon: Megaphone, tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  donation: { label: 'Donacion', icon: Wallet, tone: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' },
  health: { label: 'Rast shëndetësor', icon: HeartPulse, tone: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
};

export function kindOf(trackingId: string): Kind {
  if (trackingId.startsWith('LJ-')) return 'news';
  if (trackingId.startsWith('DN-')) return 'donation';
  if (trackingId.startsWith('HC-')) return 'health';
  return 'report';
}

const toIso = (value: unknown): string | null => {
  if (!value) return null;
  const v = value as { toDate?: () => Date };
  const date = typeof v.toDate === 'function' ? v.toDate() : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** Only report statuses have the shared labels; the sector forms store their own words. */
const SECTOR_STAGE: Record<string, string> = {
  submitted: 'Në pritje', pending: 'Në pritje', accepted: 'U pranua', in_editing: 'Në përpunim', published: 'U publikua',
  approved: 'U aprovua', verified: 'U verifikua', resolved: 'U zgjidh', rejected: 'U refuzua',
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export default function MyReportsPage() {
  const [deviceRows] = useState<Row[]>(() => getGuestReportHistory().map((item) => ({
    trackingId: item.trackingId,
    title: item.title || dt('Pa titull'),
    kind: kindOf(item.trackingId),
    status: item.status ?? null,
    municipality: item.municipality ?? '',
    createdAt: item.createdAt ?? null,
  })));
  const [accountRows, setAccountRows] = useState<Row[]>([]);
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  useEffect(() => onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null)), []);

  useEffect(() => {
    if (!uid) {
      setAccountRows([]);
      return;
    }
    // Same query and index as the dashboard's "own reports" (publicReportsApi.ts).
    const q = query(collection(db, 'reports'), where('authorId', '==', uid), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(
      q,
      (snap) => setAccountRows(snap.docs.flatMap((d) => {
        const data = d.data() as Record<string, any>;
        const trackingId = typeof data.trackingId === 'string' ? data.trackingId : '';
        if (!trackingId) return [];
        return [{
          trackingId,
          title: String(data.title ?? dt('Pa titull')),
          kind: 'report' as const,
          status: typeof data.status === 'string' ? data.status : null,
          municipality: String(data.location?.municipality ?? data.municipality ?? ''),
          createdAt: toIso(data.createdAt),
        }];
      })),
      // The device list still shows; an account list that cannot load is not an error for the citizen.
      () => setAccountRows([]),
    );
  }, [uid]);

  const rows = useMemo(() => {
    const byId = new Map<string, Row>();
    // The account copy is newer (live status), so it wins over the device copy.
    for (const row of [...deviceRows, ...accountRows]) byId.set(row.trackingId, { ...byId.get(row.trackingId), ...row });
    return [...byId.values()].sort((a, b) => (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0));
  }, [deviceRows, accountRows]);

  return (
    <div className="page-shell min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHero
          eyebrow={dt('Llogaria ime')}
          icon={FolderOpen}
          title={dt('Raportet e mia')}
          subtitle={dt('Gjithçka që keni dërguar nga kjo pajisje: raportime, lajme, donacione dhe raste shëndetësore. Prekni njërin për të parë statusin.')}
        />

        {rows.length === 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-slate-900">
            <FolderOpen className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-black text-slate-900 dark:text-white">{dt('Ende asnjë dërgesë')}</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              {dt('Kur dërgoni një raportim, ai shfaqet këtu me Track ID-në e tij. Nëse e dërguat nga një pajisje tjetër, kërkojeni me Track ID.')}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link to="/raporto" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white">
                <PlusCircle className="h-4 w-4" aria-hidden="true" />{dt('Raporto një problem')}
              </Link>
              <Link to="/trackid" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-800 dark:border-white/10 dark:text-white">
                <Search className="h-4 w-4" aria-hidden="true" />{dt('Kërko me Track ID')}
              </Link>
            </div>
          </section>
        ) : (
          <section aria-label={dt('Raportet e mia')} className="space-y-2.5">
            {rows.map((row) => {
              const kind = KIND[row.kind];
              const isReport = row.kind === 'report';
              const label = row.status ? (isReport ? statusLabel(row.status) : SECTOR_STAGE[row.status] ?? row.status) : null;
              const tone = isReport && row.status ? TONE_CLASSES[statusMeta(row.status).tone] : null;
              return (
                <Link
                  key={row.trackingId}
                  to={`/trackid?id=${encodeURIComponent(row.trackingId)}`}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300 dark:border-white/10 dark:bg-slate-900"
                >
                  <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', kind.tone)}>
                    <kind.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-slate-900 dark:text-white">{row.title}</span>
                    <span className="mt-0.5 block truncate font-mono text-[11px] font-bold text-slate-500">{row.trackingId}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="font-bold">{dt(kind.label)}</span>
                      {row.municipality && <span>· {row.municipality}</span>}
                      {row.createdAt && <span>· {formatDate(row.createdAt)}</span>}
                      {label && <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-black sm:hidden', tone?.badge ?? 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300')}>{dt(label)}</span>}
                    </span>
                  </span>
                  {label && (
                    <span className={cn('hidden shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black sm:inline-block', tone?.badge ?? 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300')}>
                      {dt(label)}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                </Link>
              );
            })}
            <p className="px-1 pt-2 text-xs text-slate-500">
              {dt('Lista ruhet në këtë pajisje. Në një pajisje tjetër, përdorni Track ID-në ose kyçuni në të njëjtën llogari.')}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
