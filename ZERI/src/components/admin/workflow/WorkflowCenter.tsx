import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Heart, HeartPulse, ListChecks, Newspaper, FileText } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { db } from '../../../lib/firebase';
import { useStore } from '../../../lib/store';
import { cn } from '../../../lib/utils';
import { canAccessSection, type AdminSection } from '../../../lib/adminPermissions';
import { STAFF_LIMITS } from '../../../lib/loadLimits';
import { filterByScope, isSpecificScope, normalizeScope } from '../../../lib/municipalityScope';
import { useServerReports } from '../../../lib/adminReportsApi';
import { takeDecision } from '../../../lib/decisionsApi';
import { DECISION_KINDS } from '../../../lib/decisionRules';
import {
  docStage,
  pipelineRoleFor,
  planDocMove,
  planReportMove,
  reportStage,
  type Actor,
  type BoardKind,
  type DocBoardKind,
  type StageKey,
} from '../../../lib/workflowStages';
import type { Report } from '../../../types';
import ReportDetailModal from '../../ReportDetailModal.tsx';
import { StageBoard, type BoardItem, type MoveCheck } from './StageBoard';

interface Domain {
  kind: BoardKind;
  label: string;
  section: AdminSection;
  icon: typeof FileText;
}

const DOMAINS: readonly Domain[] = [
  { kind: 'report', label: 'Raportet', section: 'reports', icon: FileText },
  { kind: 'donation', label: 'Donacionet', section: 'donations', icon: Heart },
  { kind: 'health', label: 'Regjistri shëndetësor', section: 'health', icon: HeartPulse },
  { kind: 'news', label: 'Lajmet', section: 'news', icon: Newspaper },
];

/** A date that may be an ISO string, a Firestore timestamp or missing. */
function shortDate(value: unknown): string {
  let date: Date | null = null;
  if (typeof value === 'string') date = new Date(value);
  else if (value && typeof (value as any).toDate === 'function') date = (value as any).toDate();
  else if (value && typeof (value as any).seconds === 'number') date = new Date((value as any).seconds * 1000);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('sq-AL') : '';
}

/**
 * "Rrjedha e Aprovimit": reports, donation appeals, health cases and news on one set of
 * stages - Raportuar, Aprovuar, Në pritje, Përgjigje, Përfunduar (and Refuzuar) - with
 * select, select-all and bulk moves. Each tab shows only what the account may reach.
 */
export default function WorkflowCenter() {
  const currentUser = useStore(s => s.currentUser);
  const domains = DOMAINS.filter(d => {
    if (!canAccessSection(currentUser, d.section)) return false;
    // A municipality answers reports and health cases; appeals and news are not its to move.
    return !(currentUser?.role === 'municipality' && (d.kind === 'donation' || d.kind === 'news'));
  });
  const [kind, setKind] = useState<BoardKind | null>(null);
  const active = domains.find(d => d.kind === kind) ?? domains[0];

  if (!active) {
    return <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">{dt('Nuk keni qasje në asnjë fushë të kësaj rrjedhe.')}</p>;
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white"><ListChecks className="h-5 w-5" aria-hidden="true" /></span>
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">{dt('Rrjedha e Aprovimit')}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">{dt('Zgjidh një ose të gjitha dhe i zhvendos nga një fazë te tjetra. Çdo lëvizje kontrollohet nga serveri dhe regjistrohet.')}</p>
        </div>
      </header>

      {domains.length > 1 && (
        <div role="tablist" aria-label={dt('Fusha')} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {domains.map(({ kind: k, label, icon: Icon }) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={active.kind === k}
              onClick={() => setKind(k)}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold transition',
                active.kind === k ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/10'
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {dt(label)}
            </button>
          ))}
        </div>
      )}

      {active.kind === 'report' ? <ReportsBoard key="report" /> : <DocBoard key={active.kind} kind={active.kind} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

const STATUS_FOR: Record<string, 'Approved' | 'In Progress' | 'Resolved' | 'Rejected'> = {
  pass_to_municipality: 'Approved',
  municipality_accept: 'In Progress',
  municipality_done: 'Resolved',
  reject: 'Rejected',
};

function ReportsBoard() {
  const currentUser = useStore(s => s.currentUser);
  const scope = useStore(s => s.userMunicipality);
  const storeReports = useStore(s => s.reports);
  const updateReportStatus = useStore(s => s.updateReportStatus);
  const scopeName = isSpecificScope(scope) ? normalizeScope(scope) : undefined;
  const list = useServerReports({ municipality: scopeName }, true);
  const [openId, setOpenId] = useState<string | null>(null);

  const fromServer = list.status !== 'error';
  const reports = useMemo<Report[]>(
    () => (fromServer ? list.items : filterByScope(storeReports, scope)),
    [fromServer, list.items, storeReports, scope]
  );
  const role = pipelineRoleFor(currentUser?.role ?? '', currentUser?.permissions ?? []);
  const byId = useMemo(() => new Map(reports.map(r => [r.id, r])), [reports]);

  const items = useMemo<BoardItem[]>(
    () => reports.map(r => ({
      id: r.id,
      title: r.title || r.trackingId || r.id,
      subtitle: [r.location?.municipality, r.category].filter(Boolean).join(' · '),
      meta: [r.trackingId, shortDate(r.createdAt)].filter(Boolean).join(' · '),
      tag: r.urgency,
      stage: reportStage(r),
    })),
    [reports]
  );

  const check = useCallback((item: BoardItem, target: StageKey): MoveCheck => {
    const report = byId.get(item.id);
    if (!report) return { ok: false, reason: dt('Raporti nuk është më në listë.') };
    const plan = planReportMove(report, target, role);
    return plan.ok === false ? { ok: false, reason: plan.reason } : { ok: true, note: plan.note };
  }, [byId, role]);

  const move = useCallback(async (item: BoardItem, target: StageKey, note: string) => {
    const report = byId.get(item.id);
    if (!report) throw new Error(dt('Raporti nuk është më në listë.'));
    const plan = planReportMove(report, target, role);
    if (plan.ok === false) throw new Error(plan.reason);
    await updateReportStatus(report.id, STATUS_FOR[plan.transition], note || undefined);
  }, [byId, role, updateReportStatus]);

  const opened = openId ? byId.get(openId) : undefined;

  return (
    <>
      <StageBoard
        kind="report"
        items={items}
        loading={list.status === 'loading' || list.status === 'idle'}
        error={list.status === 'error' ? dt('Lista nga serveri nuk u ngarkua; po shfaqen raportet e ngarkuara në shfletues.') : null}
        check={check}
        move={move}
        onOpen={item => setOpenId(item.id)}
        onMoved={() => void list.refresh()}
        moreAvailable={fromServer && Boolean(list.nextCursor)}
        onLoadMore={list.loadMore}
        loadingMore={list.isLoadingMore}
      />
      {opened && <ReportDetailModal report={opened} onClose={() => { setOpenId(null); void list.refresh(); }} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Donations, health cases, news                                       */
/* ------------------------------------------------------------------ */

type Raw = Record<string, any> & { id: string };

/** The records of one kind, live. Donations come from the store, which already listens. */
function useRecords(kind: DocBoardKind): { rows: Raw[]; loading: boolean; error: string | null } {
  const donations = useStore(s => s.donationCauses);
  const [rows, setRows] = useState<Raw[]>([]);
  const [loading, setLoading] = useState(kind !== 'donation');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (kind === 'donation') return;
    setLoading(true);
    const source = kind === 'health'
      ? query(collection(db, 'healthRegistry'), orderBy('createdAt', 'desc'), limit(STAFF_LIMITS.healthCases))
      : query(collection(db, 'newsArticles'), orderBy('createdAt', 'desc'), limit(STAFF_LIMITS.newsArticles));
    return onSnapshot(
      source,
      snapshot => {
        setRows(snapshot.docs.map(d => ({ ...d.data(), id: d.id })));
        setError(null);
        setLoading(false);
      },
      caught => {
        setError(caught?.message || dt('Lista nuk u ngarkua.'));
        setLoading(false);
      }
    );
  }, [kind]);

  return kind === 'donation' ? { rows: donations as unknown as Raw[], loading: false, error: null } : { rows, loading, error };
}

function describe(kind: DocBoardKind, row: Raw): Omit<BoardItem, 'stage'> {
  if (kind === 'donation') {
    return { id: row.id, title: row.title || row.id, subtitle: row.category, meta: shortDate(row.createdAt) };
  }
  if (kind === 'health') {
    return {
      id: row.id,
      // A case filed anonymously stays anonymous here too.
      title: row.isAnonymous ? (row.trackingId || dt('Rast anonim')) : (row.fullName || row.trackingId || row.id),
      subtitle: [row.municipality, row.category].filter(Boolean).join(' · '),
      meta: shortDate(row.createdAt),
      tag: row.urgency,
    };
  }
  return {
    id: row.id,
    title: row.title || row.id,
    subtitle: [row.municipality, row.category].filter(Boolean).join(' · '),
    meta: shortDate(row.date || row.createdAt),
  };
}

function DocBoard({ kind }: { kind: DocBoardKind }) {
  const currentUser = useStore(s => s.currentUser);
  const scope = useStore(s => s.userMunicipality);
  const { rows, loading, error } = useRecords(kind);

  const actor = useMemo<Actor>(() => ({
    uid: currentUser?.id ?? '',
    role: currentUser?.role ?? '',
    municipality: currentUser?.municipality ?? '',
    permissions: currentUser?.permissions ?? [],
  }), [currentUser?.id, currentUser?.role, currentUser?.municipality, currentUser?.permissions]);

  // The header's municipality scope narrows the kinds that belong to a municipality.
  const scoped = useMemo(() => {
    if (kind === 'donation' || !isSpecificScope(scope)) return rows;
    const wanted = normalizeScope(scope);
    return rows.filter(r => normalizeScope(r.municipality) === wanted);
  }, [kind, rows, scope]);

  const byId = useMemo(() => new Map(scoped.map(r => [r.id, r])), [scoped]);
  const items = useMemo<BoardItem[]>(
    () => scoped.map(r => ({ ...describe(kind, r), stage: docStage(kind, r) })),
    [kind, scoped]
  );

  const check = useCallback((item: BoardItem, target: StageKey): MoveCheck => {
    const raw = byId.get(item.id);
    if (!raw) return { ok: false, reason: dt('Nuk është më në listë.') };
    const plan = planDocMove(kind, raw, target, actor);
    return plan.ok === false ? { ok: false, reason: plan.reason } : { ok: true, note: plan.needsReason ? 'required' : 'none' };
  }, [byId, kind, actor]);

  const move = useCallback(async (item: BoardItem, target: StageKey, note: string) => {
    const raw = byId.get(item.id);
    if (!raw) throw new Error(dt('Nuk është më në listë.'));
    const plan = planDocMove(kind, raw, target, actor);
    if (plan.ok === false) throw new Error(plan.reason);

    for (const [index, action] of plan.actions.entries()) {
      const needsReason = Boolean(DECISION_KINDS[kind].actions[action]?.needsReason);
      try {
        await takeDecision(kind as Parameters<typeof takeDecision>[0], item.id, action, needsReason ? { reason: note } : {});
      } catch (caught) {
        const message = (caught as Error)?.message || dt('Serveri e refuzoi.');
        // A chain that stops halfway leaves the record on an earlier stage; say so.
        throw new Error(index > 0 ? `${dt('Hapi')} ${index + 1}/${plan.actions.length}: ${message} (${dt('rekordi mbeti në një fazë të ndërmjetme')})` : message);
      }
    }
  }, [byId, kind, actor]);

  return <StageBoard kind={kind} items={items} loading={loading} error={error} check={check} move={move} />;
}
