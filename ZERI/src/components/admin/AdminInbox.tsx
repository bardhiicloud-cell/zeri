import React, { useEffect, useMemo, useState } from 'react';
import { useInboxReports } from '../../lib/useInboxReports';
import {
  CheckCircle2, ChevronRight, ClipboardCheck, FileText, Headphones, Heart, HeartPulse, Megaphone, Pill, Send,
} from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import { useStore } from '../../lib/store';
import { canAccessSection, type AdminSection } from '../../lib/adminPermissions';
import { reportDueAt } from '../../lib/reportDue';
import { isSpecificScope, normalizeScope, recordMatchesScope, scopeKey } from '../../lib/municipalityScope';
import {
  INBOX_KINDS,
  adRequestItem,
  muniRequestItem,
  chatItem,
  countByKind,
  donationItem,
  filterInbox,
  healthItem,
  isOverdueItem,
  reportItem,
  shortageItem,
  sortInbox,
  workFactItem,
  type InboxItem,
  type InboxKind,
} from '../../lib/adminInbox';
import { dueInfo } from '../../lib/reportQueue';
import { useInboxSources } from '../../lib/useInboxSources';
import { AgeText } from './dashboard/DashboardParts';

/**
 * "Kutia e Punës" — everything waiting on you, across every kind of record.
 *
 * Each of these used to be a separate section to visit and check. Here they share
 * one list, most urgent first: past-deadline items, then critical ones, then by
 * deadline, then by how long they have waited. Clicking an item opens the section
 * that handles it (a report opens straight onto that report).
 */

const KIND_ICON: Record<InboxKind, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  report: FileText,
  workfact: ClipboardCheck,
  health: HeartPulse,
  shortage: Pill,
  chat: Headphones,
  donation: Heart,
  adrequest: Megaphone,
  munirequest: Send,
};

const PAGE = 50;

export default function AdminInbox({
  onOpen,
}: {
  onOpen: (section: AdminSection, params?: { open?: string }) => void;
}) {
  const currentUser = useStore(state => state.currentUser);
  const browserReports = useStore(state => state.reports);
  const reportsStatus = useStore(state => state.reportsStatus);
  const donationCauses = useStore(state => state.donationCauses);
  const scope = useStore(state => state.userMunicipality);

  const access = useMemo(
    () => ({
      reports: canAccessSection(currentUser, 'reports'),
      workfacts: canAccessSection(currentUser, 'workfacts'),
      health: canAccessSection(currentUser, 'health'),
      support: canAccessSection(currentUser, 'support'),
      donations: canAccessSection(currentUser, 'donations'),
      ads: canAccessSection(currentUser, 'ads'),
    }),
    [currentUser]
  );

  // Reports come from the server over the whole collection (longest-waiting first);
  // the browser's copy is only the fallback when the server cannot answer.
  const municipalityScope = isSpecificScope(scope) ? scopeKey(scope) : undefined;
  const serverReports = useInboxReports(access.reports, municipalityScope);
  const reports = serverReports.status === 'ready' ? serverReports.items : browserReports;

  const sources = useInboxSources({
    workfacts: access.workfacts,
    health: access.health,
    support: access.support,
    ads: access.ads,
  });

  // Deadlines and waiting times move without any data changing.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const [kind, setKind] = useState<InboxKind | ''>('');
  const [shown, setShown] = useState(PAGE);

  const allItems = useMemo(() => {
    const items: InboxItem[] = [];
    const push = (item: InboxItem | null) => item && items.push(item);

    if (access.reports) {
      for (const report of reports) {
        push(reportItem(report, reportDueAt(report), now));
      }
    }
    if (access.workfacts) {
      sources.workFacts.forEach(raw => push(workFactItem(raw)));
      sources.muniRequests.forEach(raw => push(muniRequestItem(raw)));
    }
    if (access.health) {
      sources.health.forEach(raw => push(healthItem(raw)));
      sources.shortages.forEach(raw => push(shortageItem(raw)));
    }
    if (access.support) sources.chats.forEach(raw => push(chatItem(raw)));
    if (access.donations) donationCauses.forEach(cause => push(donationItem({ ...cause } as never)));
    if (access.ads) sources.adRequests.forEach(raw => push(adRequestItem(raw)));
    return items;
  }, [access, reports, donationCauses, sources.workFacts, sources.muniRequests, sources.health, sources.shortages, sources.chats, sources.adRequests, now]);

  // The header's municipality scope applies here too. Items that belong to no
  // municipality (chats, donation appeals) are national and always stay.
  const scoped = isSpecificScope(scope);
  const inScope = useMemo(
    () => filterInbox(allItems, {
      inMunicipality: scoped ? item => !item.municipality || recordMatchesScope({ municipality: item.municipality }, scope) : undefined,
    }),
    [allItems, scoped, scope]
  );

  const counts = useMemo(() => countByKind(inScope), [inScope]);
  const sorted = useMemo(() => sortInbox(filterInbox(inScope, { kind }), now), [inScope, kind, now]);
  const overdue = useMemo(() => inScope.filter(item => isOverdueItem(item, now)).length, [inScope, now]);

  const visibleKinds = (Object.keys(INBOX_KINDS) as InboxKind[]).filter(key => {
    const section = INBOX_KINDS[key].section;
    return canAccessSection(currentUser, section);
  });

  const loading = (access.reports && (serverReports.status === 'loading' || (serverReports.status === 'error' && reportsStatus === 'loading'))) || !sources.ready;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{dt(`Kutia e Punës`)}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
            {loading
              ? dt(`Duke ngarkuar…`)
              : inScope.length === 0
                ? dt(`Asgjë nuk pret veprim.`)
                : `${inScope.length} ${dt(`gjëra presin veprim`)}${overdue > 0 ? ` · ${overdue} ${dt(`të vonuara`)}` : ''}`}
            {scoped && <span className="text-rose-600 dark:text-rose-400"> · {normalizeScope(scope)}</span>}
          </p>
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto pb-0.5" role="tablist" aria-label={dt(`Lloji i punës`)}>
        {[{ key: '' as const, label: dt(`Të gjitha`), count: inScope.length }, ...visibleKinds.map(key => ({ key, label: dt(INBOX_KINDS[key].label), count: counts[key] }))].map(tab => {
          const active = kind === tab.key;
          return (
            <button
              key={tab.key || 'all'}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setKind(tab.key);
                setShown(PAGE);
              }}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors',
                active ? 'bg-slate-900 text-white dark:bg-rose-600' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              )}
            >
              {tab.label}
              <span className={cn('rounded-full px-1.5 py-0.5 text-[11px] tabular-nums', active ? 'bg-white/20' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {sources.unavailable.length > 0 && (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {dt(`Disa burime nuk u ngarkuan dhe mungojnë nga lista`)}.
        </p>
      )}

      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-slate-900">
        {loading && sorted.length === 0 ? (
          <div className="space-y-3 p-4" aria-label={dt(`Duke ngarkuar`)}>
            {[0, 1, 2, 3].map(index => (
              <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {kind ? dt(`Asgjë e këtij lloji nuk pret veprim.`) : dt(`Gjithçka është në rregull.`)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {scoped
                ? `${dt(`Kufizimi aktiv:`)} ${normalizeScope(scope)}. ${dt(`Ndryshojeni lart djathtas për të parë të gjithë vendin.`)}`
                : dt(`Raportet e reja dhe kërkesat do të shfaqen këtu.`)}
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 dark:divide-white/10">
              {sorted.slice(0, shown).map(item => {
                const Icon = KIND_ICON[item.kind];
                const due = dueInfo(item.dueAt, 'Pending Review', now);
                const late = isOverdueItem(item, now);
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => onOpen(item.section, item.kind === 'report' ? { open: item.recordId } : undefined)}
                      className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-500 dark:hover:bg-slate-800/40"
                    >
                      <span
                        className={cn(
                          'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                          item.urgency === 'critical'
                            ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                            : item.urgency === 'high'
                              ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden={true} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-900 group-hover:text-rose-600 dark:text-white">{item.title}</span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-semibold">{item.reason}</span>
                          {item.subtitle && <> · {item.subtitle}</>}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-right text-[11px] sm:block">
                        {late ? (
                          <span className="block font-bold text-red-600 dark:text-red-400">
                            {dt(`Vonuar`)}{due.state === 'overdue' ? ` ${due.days} ${dt(`ditë`)}` : ''}
                          </span>
                        ) : due.state === 'soon' ? (
                          <span className="block font-bold text-amber-600 dark:text-amber-400">{dt(`Afati sot`)}</span>
                        ) : null}
                        <span className="block text-slate-400"><AgeText iso={item.createdAt} now={now} /></span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-rose-500" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
            {sorted.length > shown && (
              <div className="border-t border-slate-100 p-3 text-center dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShown(count => count + PAGE)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {dt(`Shfaq më shumë`)} ({sorted.length - shown})
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
