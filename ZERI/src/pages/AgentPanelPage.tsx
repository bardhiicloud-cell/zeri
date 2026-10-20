/**
 * Paneli i Agjentëve — /agent
 *
 * Zgjerimi profesional i punës për agjentët e terrenit. Ndërtuar mbi të njëjtat
 * burime si `/moderim` (users, reports, auditLogs) dhe mbi `agentActivity.ts`,
 * pra asnjë numër nuk rikalkulohet në JSX dhe asnjë shifër nuk shpiket.
 *
 * Seksionet:
 *   1. Kuti hyrëse    — punët e mia, sipas prioritetit real (SLA + urgjencë)
 *   2. Punë aktive    — ajo që kam marrë përsipër, me hap tjetër të qartë
 *   3. Performanca    — veprimet, aprovimet, koha mesatare, norma e suksesit
 *   4. Historia ime   — audit log i pandryshueshëm, vetëm veprimet e mia
 *   5. Politika       — çka mund / nuk mund të bëjë një agjent
 *
 * Kufizimi kryesor: një agjent sheh VETËM veprimet e veta dhe punët brenda
 * komunës së caktuar. Asnjë email qytetari, asnjë veprim i kolegëve.
 */
import { useMemo, useState } from 'react';
import { dt } from '../lib/dt';
import { useStore } from '../lib/store';
import type { Report } from '../types';
import { useAgentActivity } from '../lib/agentActivity';
import { classifyRisk } from '../lib/moderationCenter';
import ReviewCard from '../components/review/ReviewCard';
import { stageOf, STAGE_LABELS, STAGE_TONES, type Transition } from '../lib/approvalPipeline';
import { BAD_WORDS } from '../lib/moderation';
import TeamOverviewPanel from '../components/admin/TeamOverviewPanel';
import ReportTasksPanel from '../components/admin/workflow/ReportTasksPanel';
import ReportQueuesPanel from '../components/admin/workflow/ReportQueuesPanel';
import { isSpecificScope, scopeKey, ALL_SCOPE } from '../lib/municipalityScope';
import {
  Inbox, ClipboardList, Activity, ScrollText, Scale, Search, ArrowRight,
  AlertTriangle, CheckCircle2, Clock, MapPin, CircleDot, Flame, FileText,
  ShieldCheck, Ban, TrendingUp,
} from 'lucide-react';

type Tab = 'inbox' | 'mine' | 'performance' | 'history' | 'policy';

const TABS: { id: Tab; label: string; icon: typeof Inbox }[] = [
  { id: 'inbox', label: 'Detyrat e mia', icon: Inbox },
  { id: 'mine', label: 'Raportet sipas fazës', icon: ClipboardList },
  { id: 'performance', label: 'Performanca', icon: TrendingUp },
  { id: 'history', label: 'Historia ime', icon: ScrollText },
  { id: 'policy', label: 'Politika', icon: Scale },
];

/** Rolet që e hapin këtë panel: agjentët, plus administratorët që inspektojnë
 * punën e tyre. Super Admini i shikon të gjitha nga /moderim, por nuk ka arsye
 * të bllokohet kur hap drejtpërdrejt panelin e një agjenti. */
const AGENT_ROLES = ['agent', 'responder', 'dispatcher', 'moderator', 'admin', 'superadmin'] as const;

const URGENCY_WEIGHT: Record<string, number> = {
  Kritike: 4,
  'E lartë': 3,
  Mesatare: 2,
  'E ulët': 1,
};

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-600',
  'Pending Review': 'bg-amber-100 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Assigned: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-indigo-100 text-indigo-700',
  Resolved: 'bg-green-100 text-green-700',
  Rejected: 'bg-rose-100 text-rose-700',
  Overdue: 'bg-red-100 text-red-700',
};

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('sq-AL', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/** Sa orë ka pritur një raportim — baza e prioritetit, jo e pëlqimit. */
function hoursWaiting(report: Report): number {
  const start = Date.parse(report.createdAt);
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.round((Date.now() - start) / 36e5));
}

/**
 * Prioriteti i një pune.
 *
 * Urgjenca është ajo që ka deklaruar qytetari; pritja është ajo që e bën atë
 * urgjente vërtet. Pesha e pritjes rritet shpejt, sepse një "e ulët" e harruar
 * dy javë është më e rëndë se një "kritike" e sotme.
 */
function priorityScore(report: Report): number {
  const urgency = URGENCY_WEIGHT[report.urgency] ?? 1;
  const hours = hoursWaiting(report);
  return urgency * 10 + Math.min(60, Math.floor(hours / 6));
}

function Stat({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: string }) {
  const tones: Record<string, string> = {
    slate: 'text-slate-900 dark:text-white',
    amber: 'text-amber-600',
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
    indigo: 'text-indigo-600',
    blue: 'text-blue-600',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <div className={`text-2xl font-black tabular-nums ${tones[tone] ?? tones.slate}`}>{value}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{dt(label)}</div>
    </div>
  );
}

/** Një rresht pune, me të gjitha fasadat e nevojshme për një vendim të shpejtë. */
function WorkRow({
  report, children,
}: { report: Report; children?: React.ReactNode }) {
  const risk = classifyRisk(`${report.title ?? ''} ${report.description ?? ''}`, BAD_WORDS);
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STAGE_TONES[stageOf(report)]}`}>
            {dt(STAGE_LABELS[stageOf(report)])}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_COLORS[report.status] ?? 'bg-slate-100 text-slate-600'}`}>
            {report.status}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {report.urgency}
          </span>
          {risk !== 'clean' && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${risk === 'violation' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
              {risk === 'violation' ? dt('Gjuhë jo e përshtatshme') : dt('E dyshimtë')}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">{report.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {report.location?.municipality ?? '—'}
          </span>
          <span>· {fmtDate(report.createdAt)}</span>
          <span>· {hoursWaiting(report)} {dt('orë në pritje')}</span>
        </p>
      </div>
      <div className="shrink-0 text-right text-xs text-slate-500">{children}</div>
    </div>
  );
}

export default function AgentPanelPage() {
  const currentUser = useStore((s) => s.currentUser);
  const reports = useStore((s) => s.reports ?? []);
  const auditLogs = useStore((s) => s.auditLogs ?? []);
  const scope = useStore((s) => s.userMunicipality);
  const updateReportStatus = useStore((s) => s.updateReportStatus);
  const assignReport = useStore((s) => s.assignReport);
  const addAuditLog = useStore((s) => s.addAuditLog);

  const [tab, setTab] = useState<Tab>('inbox');
  const [query, setQuery] = useState('');
  /** The report open for detailed review, if any. */
  const [reviewId, setReviewId] = useState<string | null>(null);
  /** Images the reviewer marked as not useful for this inspection. */
  const [markedImages, setMarkedImages] = useState<string[]>([]);
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  /* --- Guard: rolet e terrenit, një administrator, ose një grant i dhënë
         drejtpërdrejt nga formulari i agjentit (`permissions: ['agents']`). --- */
  const allowed =
    !!currentUser &&
    ((AGENT_ROLES as readonly string[]).includes(currentUser.role) ||
      (currentUser.permissions ?? []).includes('agents' as never));
  /**
   * An administrator inspecting an agent's console sees every agent's work, not
   * a single name's. An agent sees only their own.
   */
  const isOverseer = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  /**
   * Punët që i perkasin këtij agjenti.
   *
   * Për një agjent, filtrim mbi komunën e vet. Për një administrator që
   * inspekton, nuk filtrohet as nga komuna as nga emri — ai sheh pamjen e plotë.
   */
  const ownMunicipality = useMemo(() => {
    if (isOverseer) return ALL_SCOPE;
    const explicit = (currentUser?.municipality ?? '').trim();
    if (explicit) return explicit;
    return isSpecificScope(scope) ? scopeKey(scope) : ALL_SCOPE;
  }, [isOverseer, currentUser?.municipality, scope]);

  const inScope = useMemo(() => {
    if (ownMunicipality === ALL_SCOPE) return reports;
    return reports.filter((r) => (r.location?.municipality ?? '') === ownMunicipality);
  }, [reports, ownMunicipality]);

  /**
   * Kutia hyrëse: punë që askush nuk i ka marrë ende, të renditura sipas prioritetit real.
   *
   * Vetëm raportimet në shqyrtim (Draft, Pending Review) merren përsipër nga agjenti: pasi
   * aprovohen janë të komunës. Para kësaj, kutia tregonte edhe raportime të aprovuara, dhe
   * "Merr përsipër" mbi to refuzohej nga serveri, sikur të duhej caktim nga dikush tjetër.
   * Tani agjenti që e shtyp e merr menjëherë (serveri e regjistron me llogarinë e tij).
   */
  const inbox = useMemo(() => {
    const open = inScope.filter((r) =>
      ['Draft', 'Pending Review'].includes(r.status) &&
      !(r.assignedToUid || (r.assignedTo ?? '').trim())
    );
    const needle = query.trim().toLowerCase();
    return open
      .filter((r) => {
        if (onlyUrgent && !['Kritike', 'E lartë'].includes(r.urgency)) return false;
        if (!needle) return true;
        return (
          r.title?.toLowerCase().includes(needle) ||
          r.description?.toLowerCase().includes(needle) ||
          (r.trackingId ?? '').toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => priorityScore(b) - priorityScore(a));
  }, [inScope, query, onlyUrgent]);

  /** Punët që ky agjent i ka marrë përsipër; një administrator sheh të gjitha. */
  const mine = useMemo(() => {
    const uid = currentUser?.id ?? '';
    const name = currentUser?.name ?? '';
    // By account, not by display name: two agents with one name are two people.
    const assigned = isOverseer
      ? inScope.filter((r) => Boolean(r.assignedToUid) || (r.assignedTo ?? '').trim() !== '')
      : inScope.filter((r) => (r.assignedToUid ? r.assignedToUid === uid : (r.assignedTo ?? '') === name));
    return assigned.sort((a, b) => priorityScore(b) - priorityScore(a));
  }, [inScope, currentUser?.id, currentUser?.name, isOverseer]);

  /** Performanca: një rresht, llogaritur nga hook-u i përbashkët. */
  const activity = useAgentActivity(
    useMemo(
      () => (currentUser ? [{ id: currentUser.id, name: currentUser.name, email: currentUser.email ?? '', role: currentUser.role }] : []),
      [currentUser]
    )
  );
  const me = activity[0];

  /** Historia: vetëm veprimet e mia, më të rejat në krye. */
  const myLogs = useMemo(() => {
    if (!currentUser) return [];
    return auditLogs
      .filter((l) => l.userId === currentUser.id || (l.userName && l.userName === currentUser.name))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [auditLogs, currentUser]);

  /** Koha mesatare e zgjidhjes nga raportimet e mia të përfunduara. */
  const avgResolution = useMemo(() => {
    let sum = 0;
    let n = 0;
    for (const r of mine) {
      if (r.status !== 'Resolved') continue;
      const start = Date.parse(r.createdAt);
      const end = Date.parse(r.resolvedAt ?? r.updatedAt ?? '');
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        sum += end - start;
        n += 1;
      }
    }
    return n > 0 ? Math.round(sum / n / 36e5) : 0;
  }, [mine]);

  // Hooks stay above the access check below: the number of hooks must not depend on who is looking.
  /**
   * The report open in the detailed review screen, resolved from the current
   * scope so an update elsewhere in the app is reflected immediately.
   */
  const reviewReport = useMemo(
    () => (reviewId ? inScope.find((r) => r.id === reviewId) ?? null : null),
    [reviewId, inScope]
  );

  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 text-xl font-black text-slate-900 dark:text-white">{dt('Akses i kufizuar')}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {dt('Ky panel është vetëm për agjentët e terrenit dhe përgjegjësit e radhës.')}
        </p>
      </div>
    );
  }

  /** Merr një punë përsipër dhe e shënon në regjistrin e pandryshueshëm. */
  const claim = async (report: Report) => {
    if (!currentUser) return;
    setBusyId(report.id);
    try {
      await assignReport(report.id, currentUser.name);
      addAuditLog('Punë e marrë përsipër', 'success', `${report.trackingId ?? report.id} — ${report.title}`);
      setTab('mine');
    } catch (error) {
      // The server owns the gate; its refusal explains itself in Albanian.
      alert((error as Error)?.message || dt('Puna nuk mund të merrej përsipër.'));
    } finally {
      setBusyId(null);
    }
  };

  /** Përfundon një punë, me shënimin e rezultatit në histori. */
  const resolve = async (report: Report) => {
    if (!currentUser) return;
    setBusyId(report.id);
    try {
      await updateReportStatus(report.id, 'Resolved', dt('E përfunduar nga agjenti.'));
      addAuditLog('Punë e përfunduar', 'success', `${report.trackingId ?? report.id} — ${report.title}`);
    } catch (error) {
      alert((error as Error)?.message || dt('Statusi nuk u ndryshua.'));
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Apply a pipeline transition from the review screen.
   *
   * The note is mandatory for a rejection: dismissing a citizen's report without
   * a stated reason is the single most common complaint about a platform of this
   * kind, and the reason is what the citizen is shown.
   */
  const applyTransition = async (transition: Transition, note: string) => {
    if (!currentUser || !reviewReport) return;
    if (transition === 'reject' && !note.trim()) {
      addAuditLog('Refuzim i bllokuar', 'warning', 'Refuzimi kërkon arsye të shkruar.');
      alert(dt('Refuzimi kërkon arsye të shkruar.'));
      return;
    }

    const statusFor: Partial<Record<Transition, 'Pending Review' | 'Approved' | 'In Progress' | 'Resolved' | 'Rejected'>> = {
      claim: 'Pending Review',
      pass_to_municipality: 'Approved',
      municipality_accept: 'In Progress',
      municipality_done: 'In Progress',
      staff_return: 'In Progress',
      staff_verify: 'Resolved',
      reject: 'Rejected',
    };

    const next = statusFor[transition];

    setBusyId(reviewReport.id);
    try {
      if (next) {
        await updateReportStatus(reviewReport.id, next, note.trim() || undefined);
      }

      addAuditLog(
        next === 'Approved' ? 'Raportim i pasuar te komuna' : 'Veprim i agjentit',
        'success',
        `${reviewReport.trackingId ?? reviewReport.id} — ${note.trim() || transition}`
      );
      setReviewId(null);
      setMarkedImages([]);
    } catch (error) {
      // The pipeline is enforced server-side now, so a transition this account
      // does not own comes back as a refusal rather than a silent success.
      addAuditLog('Veprim i refuzuar nga rrjedha', 'danger', `${reviewReport.trackingId ?? reviewReport.id} — ${(error as Error)?.message ?? transition}`);
      alert((error as Error)?.message || dt('Veprimi nuk u lejua nga rrjedha e aprovimit.'));
    } finally {
      setBusyId(null);
    }
  };

  /** Marks an image as not useful for this inspection; the citizen's file stays. */
  const markImage = (url: string) => {
    setMarkedImages((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-700 text-white">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-serif text-2xl font-black text-slate-950 dark:text-white">
              {dt('Paneli i Agjentit')}
            </h1>
            <p className="text-xs text-slate-500">
              {currentUser?.name} · {dt('Komuna')}: {ownMunicipality === ALL_SCOPE ? dt('Të gjitha') : ownMunicipality}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-700">{mine.length} {dt('të mia')}</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">{myLogs.length} {dt('veprime')}</span>
        </div>
      </header>

      {/* Tabs */}
      <nav className="mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-white/10 dark:bg-slate-900">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${tab === id ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
          >
            <Icon className="h-4 w-4" />
            {dt(label)}
          </button>
        ))}
      </nav>

      {/*
        Detailed review.

        Replaces the list while open, rather than appearing beside it: the
        review needs the full width for the photo gallery, and an agent working
        on a phone cannot use a two-column layout.
      */}
      {reviewReport ? (
        <section className="space-y-4">
          <button
            type="button"
            onClick={() => { setReviewId(null); setMarkedImages([]); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            ← {dt('Kthehu te lista')}
          </button>

          <ReviewCard
            report={reviewReport}
            role="agent"
            onTransition={applyTransition}
            onMarkImage={markImage}
            markedImages={markedImages}
          />
        </section>
      ) : (
        <>

      {/* ============ MY TASKS (assigned by the system or a manager, never claimed) ============ */}
      {tab === 'inbox' && currentUser?.role === 'dispatcher' && (
        <section className="mb-6" aria-label={dt('Ngarkesa e ekipit')}>
          <TeamOverviewPanel />
        </section>
      )}
      {tab === 'inbox' && <ReportTasksPanel embedded />}

      {/* ============ REPORTS BY STAGE ============ */}
      {tab === 'mine' && <ReportQueuesPanel />}

      {/* ============ PERFORMANCE ============ */}
      {tab === 'performance' && (
        <section className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Veprime 24h" value={me?.last24h ?? 0} tone="blue" />
            <Stat label="Veprime 7 ditë" value={me?.last7d ?? 0} tone="indigo" />
            <Stat label="Total veprime" value={me?.total ?? 0} />
            <Stat label="Norma e aprovimit" value={`${me?.approvalRate ?? 0}%`} tone="emerald" />
            <Stat label="Në shqyrtim / flamur" value={me?.flagged ?? 0} tone="rose" />
            <Stat label="Në skop" value={me?.inScope ?? 0} />
            <Stat label="Punë të përfunduara" value={mine.filter((r) => r.status === 'Resolved').length} tone="emerald" />
            <Stat label="Ora mes. zgjidhje" value={avgResolution} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <MapPin className="h-4 w-4 text-blue-600" /> {dt('Komunat ku kam vepruar')}
              </h3>
              {(me?.municipalities ?? []).length === 0 ? (
                <p className="text-xs text-slate-500">{dt('Nuk ka veprime të regjistruara.')}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {me?.municipalities.map((m) => (
                    <span key={m} className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">{m}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Clock className="h-4 w-4 text-indigo-600" /> {dt('Veprimi i fundit')}
              </h3>
              {me?.lastAction ? (
                <>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{me.lastAction.action}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{fmtDate(me.lastAction.at)}</p>
                </>
              ) : (
                <p className="text-xs text-slate-500">{dt('Pa veprime akoma.')}</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ============ HISTORY ============ */}
      {tab === 'history' && (
        <section className="space-y-3">
          <p className="text-xs text-slate-500">
            {dt('Regjistër i pandryshueshëm i veprimeve tuaja. Vetëm ju dhe Super Admini e shihni.')}
          </p>
          {myLogs.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-slate-900">
              <Activity className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">{dt('Nuk ka veprime të regjistruara.')}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="px-4 py-2 font-semibold">{dt('Veprimi')}</th>
                    <th className="px-4 py-2 font-semibold">{dt('Detaje')}</th>
                    <th className="px-4 py-2 font-semibold">{dt('Komuna')}</th>
                    <th className="px-4 py-2 font-semibold">{dt('Statusi')}</th>
                    <th className="px-4 py-2 font-semibold">{dt('Data')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {myLogs.slice(0, 200).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-200">{log.action}</td>
                      <td className="max-w-xs truncate px-4 py-2 text-slate-600 dark:text-slate-300">{log.details ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{log.municipality ?? '—'}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 font-bold ${log.status === 'danger' ? 'bg-rose-100 text-rose-700'
                            : log.status === 'warning' ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-500">{fmtDate(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ============ POLICY ============ */}
      {tab === 'policy' && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]">
            <h2 className="flex items-center gap-2 text-sm font-black text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4" /> {dt('Agjenti mund të')}
            </h2>
            <ul className="mt-3 space-y-1.5 text-xs text-emerald-900/90 dark:text-emerald-100/80">
              <li>· {dt('Kryejë detyrat që i cakton sistemi ose menaxheri, brenda lejeve të veta')}</li>
              <li>· {dt('Aprovojë raportime të verifikuara')}</li>
              <li>· {dt('Përditësojë statusin dhe të shtojë shënim')}</li>
              <li>· {dt('Shtojë fakte për punimet e kryera')}</li>
              <li>· {dt('Përgjigjet qytetarëve në forum')}</li>
              <li>· {dt('Shohë historinë e vet të plotë')}</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-500/20 dark:bg-rose-500/[0.06]">
            <h2 className="flex items-center gap-2 text-sm font-black text-rose-900 dark:text-rose-200">
              <Ban className="h-4 w-4" /> {dt('Agjenti nuk mund të')}
            </h2>
            <ul className="mt-3 space-y-1.5 text-xs text-rose-900/90 dark:text-rose-100/80">
              <li>· {dt('Fshijë ose fshehë raportime')}</li>
              <li>· {dt('Ndryshojë tekstin origjinal të qytetarit')}</li>
              <li>· {dt('Shohë email-in ose telefonin e qytetarëve')}</li>
              <li>· {dt('Veprojë jashtë komunës së caktuar')}</li>
              <li>· {dt('Shohë veprimet e agjentëve të tjerë')}</li>
              <li>· {dt('Ndryshojë rolet ose lejet e stafit')}</li>
            </ul>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500 md:col-span-2">
            <FileText className="mr-1 inline h-3.5 w-3.5" />
            {dt('Çdo veprim regjistrohet me emrin, komunën dhe kohën. Super Admini i shikon të gjitha në /moderim.')}
          </p>
        </section>
      )}
        </>
      )}
    </div>
  );
}
