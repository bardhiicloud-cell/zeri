/**
 * Paneli i Komunës — /komuna
 *
 * Zgjerimi i punëve që do t'i përfundojnë komuna për qytetin e vet. Ky është
 * kundërpesha e firewall-it editorial: faqja tregon me një vështrim gjithçka që
 * komuna MUND të bëjë, dhe nuk ofron asgjë që nuk mundet — as e grisur.
 *
 * Seksionet:
 *   1. Radha e punëve   — raportimet e aprovuara të komunës, sipas prioritetit
 *   2. Punimet e mia    — fakte pune që komuna i ka regjistruar, me status
 *   3. Performanca      — afatet, koha mesatare, punët e vonuara
 *   4. Regjistri        — veprimet e komunës, përfshirë refuzimet
 *   5. Politika         — çka lejohet dhe çka jo, drejtpërdrejt nga kodi
 *
 * Kufizimi bazohet në `editorialFirewall.ts`, jo në këtë faqe. Çdo buton që
 * shfaqet e kalon një kontroll burimi, dhe çdo veprim regjistrohet.
 */
import { useEffect, useMemo, useState } from 'react';
import { dt } from '../lib/dt';
import { useStore } from '../lib/store';
import { sessionFacts } from '../lib/workFactQueue';
import {
  MUNICIPALITY_MAY,
  MUNICIPALITY_MAY_NOT,
  canSeeReportStatus,
  canAddWorkFacts,
  evaluateEditorialAction,
  type EditorialAction,
} from '../lib/editorialFirewall';
import { appendEditorialEvent, getSessionEvents, countDeniedAttempts } from '../lib/editorialLog';
import { BAD_WORDS } from '../lib/moderation';
import { classifyRisk } from '../lib/moderationCenter';
import { isSpecificScope, scopeKey } from '../lib/municipalityScope';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';
import {
  Building2, ClipboardList, FileCheck2, Scale, Search, AlertTriangle, Clock,
  CheckCircle2, MapPin, ArrowRight, Flame, Gavel, FileText, ShieldCheck, Ban,
} from 'lucide-react';

type Tab = 'queue' | 'works' | 'performance' | 'log' | 'policy';

const TABS: { id: Tab; label: string; icon: typeof ClipboardList }[] = [
  { id: 'queue', label: 'Radha e punëve', icon: ClipboardList },
  { id: 'works', label: 'Punimet e mia', icon: FileCheck2 },
  { id: 'performance', label: 'Performanca', icon: Clock },
  { id: 'log', label: 'Regjistri', icon: FileText },
  { id: 'policy', label: 'Politika', icon: Scale },
];

const STATUS_COLORS: Record<string, string> = {
  Approved: 'bg-emerald-100 text-emerald-700',
  Assigned: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-indigo-100 text-indigo-700',
  Resolved: 'bg-green-100 text-green-700',
  Overdue: 'bg-red-100 text-red-700',
};

const URGENCY_WEIGHT: Record<string, number> = { Kritike: 4, 'E lartë': 3, Mesatare: 2, 'E ulët': 1 };

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('sq-AL', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/** Sa orë kanë kaluar që nga një moment. */
const hoursSince = (iso?: string) => {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 36e5)) : 0;
};

/** A ka kaluar afati i përgjigjes që i është caktuar raportimit. */
const isOverdue = (dueAt?: string, status?: string) =>
  !!dueAt && status !== 'Resolved' && Date.parse(dueAt) < Date.now();

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

export default function MunicipalityPanelPage() {
  const currentUser = useStore((s) => s.currentUser);
  const reports = useStore((s) => s.reports ?? []);
  const addAuditLog = useStore((s) => s.addAuditLog);

  const [tab, setTab] = useState<Tab>('queue');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [tick, setTick] = useState(0);

  /** Komuna e kësaj llogarie. Bosh = llogari e pascaktuar. */
  const ownMunicipality = useMemo(() => {
    const explicit = (currentUser?.municipality ?? '').trim();
    if (explicit) return explicit;
    const scope = useStore.getState().userMunicipality;
    return isSpecificScope(scope) ? scopeKey(scope) : '';
  }, [currentUser?.municipality]);

  /**
   * Kush e hap këtë panel: një llogari komunale, ose një administrator që
   * inspekton punën e një komune. Rolet e terrenit nuk e hapin — ata kanë
   * /agent.
   */
  const isMunicipal = currentUser?.role === 'municipality';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  /** A grant from the agent form (`permissions: ['municipalities']`) also opens this. */
  const hasGrant = (currentUser?.permissions ?? []).includes('municipalities' as never);
  const allowed = (isMunicipal && !!ownMunicipality) || isAdmin || hasGrant;

  /**
   * An administrator inspecting the panel picks a municipality to look at;
   * a municipal account is always pinned to its own.
   */
  const [inspectMunicipality, setInspectMunicipality] = useState('');
  const effectiveMunicipality = isAdmin && !isMunicipal ? inspectMunicipality : ownMunicipality;

  /** Punët që i lejohen kësaj komune: vetëm të vetat, vetëm të aprovuara. */
  const queue = useMemo(() => {
    if (!effectiveMunicipality) return [];
    return reports.filter(
      (r) =>
        (r.location?.municipality ?? '') === effectiveMunicipality &&
        canSeeReportStatus(currentUser, r.status)
    );
  }, [reports, effectiveMunicipality, currentUser]);

  const filteredQueue = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...queue]
      .filter((r) => {
        if (!needle) return true;
        return (
          r.title?.toLowerCase().includes(needle) ||
          (r.trackingId ?? '').toLowerCase().includes(needle) ||
          (r.category ?? '').toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        // Punët e vonuara dhe urgjencat e larta janë gjithmonë në krye.
        const overdueA = isOverdue(a.responseDueAt, a.status) ? 1 : 0;
        const overdueB = isOverdue(b.responseDueAt, b.status) ? 1 : 0;
        if (overdueA !== overdueB) return overdueB - overdueA;
        const urgency = (URGENCY_WEIGHT[b.urgency] ?? 1) - (URGENCY_WEIGHT[a.urgency] ?? 1);
        if (urgency !== 0) return urgency;
        return hoursSince(b.createdAt) - hoursSince(a.createdAt);
      });
  }, [queue, query]);

  const selected = filteredQueue.find((r) => r.id === selectedId) ?? null;

  /** Punimet e regjistruara nga kjo komunë, sipas raportit. */
  const [myFacts, setMyFacts] = useState<Array<{ id: string; reportId: string; description: string; at: string }>>([]);

  useEffect(() => {
    setMyFacts(sessionFacts(effectiveMunicipality).map((f) => ({
      id: f.id,
      reportId: f.reportId,
      description: f.description,
      at: f.at,
    })));
  }, [effectiveMunicipality, tick]);

  /** Veprimet e kësaj komune, përfshirë ato të refuzuara. */
  const events = getSessionEvents().filter(
    (e) => !effectiveMunicipality || e.actorMunicipality === effectiveMunicipality
  );

  /** Afatet dhe performanca. */
  const performance = useMemo(() => {
    const resolved = queue.filter((r) => r.status === 'Resolved');
    let sum = 0;
    let n = 0;
    for (const r of resolved) {
      const start = Date.parse(r.createdAt);
      const end = Date.parse(r.resolvedAt ?? r.updatedAt ?? '');
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        sum += end - start;
        n += 1;
      }
    }
    return {
      total: queue.length,
      overdue: queue.filter((r) => isOverdue(r.responseDueAt, r.status)).length,
      inProgress: queue.filter((r) => r.status === 'In Progress').length,
      resolved: resolved.length,
      avgHours: n > 0 ? Math.round(sum / n / 36e5) : 0,
      denied: countDeniedAttempts(effectiveMunicipality),
    };
  }, [queue, effectiveMunicipality, tick]);

  /**
   * Regjistron një veprim editorial përmes firewall-it.
   *
   * Kontrolli bëhet gjithmonë përmes `evaluateEditorialAction`. Refuzimi
   * regjistrohet po ashtu — është pikërisht ai rresht që një mosmarrëveshje e
   * mëvonshme do të kishte për objekt.
   */
  const runAction = (action: EditorialAction) => {
    if (!selected || !currentUser) return;
    const decision = evaluateEditorialAction(currentUser, action);
    appendEditorialEvent({
      kind: decision.allowed ? 'response_published' : 'action_denied',
      subjectId: selected.id,
      subjectType: 'report',
      actorMunicipality: effectiveMunicipality,
      actorUserId: currentUser.id,
      actorEmail: currentUser.email ?? '',
      attemptedAction: action,
      denied: !decision.allowed,
      denialReason: decision.allowed ? undefined : decision.reason,
      note: note.trim() || undefined,
    });
    addAuditLog(
      decision.allowed ? `Komuna: ${action}` : `Komuna REFUZUAR: ${action}`,
      decision.allowed ? 'success' : 'danger',
      `${selected.trackingId ?? selected.id} — ${selected.title}`
    );
    if (decision.allowed) setNote('');
    setTick((v) => v + 1);
  };

  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 text-xl font-black text-slate-900 dark:text-white">{dt('Akses i kufizuar')}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {dt('Ky panel është i dedikuar llogarive komunale. Administratori e inspekton në /moderim.')}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-700 text-white">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-serif text-2xl font-black text-slate-950 dark:text-white">
              {effectiveMunicipality || dt('Pa komunë të caktuar')}
            </h1>
            <p className="text-xs text-slate-500">
              {currentUser?.name} · {dt('zgjerimi i punëve për qytetin tuaj')}
            </p>
          </div>
        </div>

        {/* An administrator picks which municipality to inspect; an account is
            already pinned to one. */}
        {isAdmin && !isMunicipal && (          <select
            value={inspectMunicipality}
            onChange={(e) => setInspectMunicipality(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
          >
            <option value="">{dt('Zgjidhni një komunë për të inspektuar…')}</option>
            {KOSOVO_MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">{queue.length} {dt('punë')}</span>
          {performance.overdue > 0 && (
            <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">{performance.overdue} {dt('të vonuara')}</span>
          )}
          {performance.denied > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">{performance.denied} {dt('refuzime')}</span>
          )}
        </div>
      </header>

      {/* Permanent reminder — the firewall, stated where the temptation arises. */}
      <p className="mb-6 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] leading-relaxed text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06] dark:text-emerald-200">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        {dt('Kjo llogari shton kontekst dhe nuk heq asgjë. Çdo përpjekje për heqje regjistrohet dhe nuk zbatohet.')}
      </p>

      {/* Tabs */}
      <nav className="mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-white/10 dark:bg-slate-900">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${tab === id ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
          >
            <Icon className="h-4 w-4" />
            {dt(label)}
          </button>
        ))}
      </nav>

      {/* ============ QUEUE ============ */}
      {tab === 'queue' && (
        <section className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dt('Kërko punë sipas titullit, kodit ose kategorisë…')}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
            <div className="space-y-2">
              {filteredQueue.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10">
                  {dt('Nuk ka punë aktive për komunën tuaj.')}
                </p>
              ) : (
                filteredQueue.map((r) => {
                  const risk = classifyRisk(`${r.title ?? ''} ${r.description ?? ''}`, BAD_WORDS);
                  const overdue = isOverdue(r.responseDueAt, r.status);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      aria-pressed={selectedId === r.id}
                      className={`block w-full rounded-xl border p-4 text-left transition-colors ${selectedId === r.id
                          ? 'border-emerald-400 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-500/10'
                          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-slate-900'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[r.status] ?? 'bg-slate-100 text-slate-600'}`}>
                              {r.status}
                            </span>
                            {overdue && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                                <Flame className="h-3 w-3" /> {dt('Afati i kaluar')}
                              </span>
                            )}
                            {risk !== 'clean' && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                {dt('Përmbajtje për kujdes')}
                              </span>
                            )}
                          </span>
                          <span className="mt-1 block truncate text-sm font-semibold text-slate-900 dark:text-white">{r.title}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {r.category} · {fmtDate(r.createdAt)} · {hoursSince(r.createdAt)} {dt('orë')}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-xs text-slate-500">
                          <span className="block">{(r.comments ?? []).length} 💬</span>
                          <span className="block">{r.upvotes ?? 0} 👍</span>
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Action panel */}
            <aside className="space-y-3">
              {!selected ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-white/10">
                  {dt('Zgjidhni një punë për të vepruar.')}
                </p>
              ) : (
                <>
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
                    <h2 className="text-sm font-black text-slate-900 dark:text-white">{selected.title}</h2>
                    <p className="text-[11px] text-slate-500">
                      <MapPin className="mr-1 inline h-3 w-3" /> {selected.location?.municipality} · {selected.category}
                    </p>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{selected.description}</p>

                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={4}
                      maxLength={1200}
                      placeholder={dt('Përgjigja zyrtare, korrigjimi ose arsyeja…')}
                      className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                    />

                    {/*
                      The four constructive actions, and nothing else. A denied
                      action is still shown — greyed with its reason — so the
                      municipality learns the boundary from the interface rather
                      than from a rejected request.
                    */}
                    <div className="space-y-1.5">
                      {([
                        ['respond', 'Dërgo përgjigje zyrtare'],
                        ['attach_document', 'Ngarko dokument'],
                        ['correct_fact', 'Kërko korrigjim fakti'],
                        ['dispute', 'Kundërshto raportin'],
                      ] as [EditorialAction, string][]).map(([action, label]) => {
                        const decision = evaluateEditorialAction(currentUser, action);
                        return (
                          <button
                            key={action}
                            type="button"
                            onClick={() => runAction(action)}
                            disabled={!decision.allowed || !note.trim()}
                            className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            {dt(label)}
                          </button>
                        );
                      })}
                    </div>

                    <p className="border-t border-slate-100 pt-3 text-[10px] leading-relaxed text-slate-400 dark:border-white/10">
                      {dt('Komuna nuk mund të fshijë, fshehë ose ndryshojë raportime qytetarësh.')}
                    </p>
                  </div>

                  {/* Work facts — the one thing the municipality adds about itself. */}
                  <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]">
                    <h3 className="text-xs font-black text-slate-900 dark:text-white">{dt('Fakte për punimet e kryera')}</h3>
                    {!canAddWorkFacts(currentUser, selected).allowed ? (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                        {dt(canAddWorkFacts(currentUser, selected).reason)}
                      </p>
                    ) : (
                      <p className="text-[10px] leading-relaxed text-slate-500">
                        {dt('Përshkruani çka është rregulluar. Redaksia e verifikon para publikimit.')}
                      </p>
                    )}
                    <a
                      href="/komuna-panel"
                      className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 hover:underline dark:text-emerald-300"
                    >
                      {dt('Regjistro faktet e punimeve')} <ArrowRight className="h-3 w-3" />
                    </a>
                  </div>
                </>
              )}

              {/* The rules, always visible. */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{dt('Komuna mund të')}</h3>
                <ul className="mt-2 space-y-1">
                  {MUNICIPALITY_MAY.map((x) => (
                    <li key={x} className="flex gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="text-emerald-600">✓</span>{dt(x)}
                    </li>
                  ))}
                </ul>
                <h3 className="mt-4 text-[11px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">{dt('Komuna nuk mund të')}</h3>
                <ul className="mt-2 space-y-1">
                  {MUNICIPALITY_MAY_NOT.map((x) => (
                    <li key={x} className="flex gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="text-rose-600">✕</span>{dt(x)}
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </section>
      )}

      {/* ============ WORKS ============ */}
      {tab === 'works' && (
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Fakte të regjistruara" value={myFacts.length} tone="emerald" />
            <Stat label="Në verifikim" value={myFacts.length} tone="amber" />
            <Stat label="Punë të përfunduara" value={performance.resolved} tone="emerald" />
            <Stat label="Punë në punim" value={performance.inProgress} tone="indigo" />
          </div>

          {myFacts.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-slate-900">
              <FileCheck2 className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">{dt('Nuk ka fakte punimesh të regjistruara në këtë sesion.')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myFacts.map((f) => {
                const report = reports.find((r) => r.id === f.reportId);
                return (
                  <div key={f.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{report?.title ?? f.reportId}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{f.description}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                      <span>{fmtDate(f.at)}</span>
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                        {dt('Në verifikim')}
                      </span>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ============ PERFORMANCE ============ */}
      {tab === 'performance' && (
        <section className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Punë gjithsej" value={performance.total} tone="blue" />
            <Stat label="Të vonuara" value={performance.overdue} tone="rose" />
            <Stat label="Në punim" value={performance.inProgress} tone="indigo" />
            <Stat label="Të përfunduara" value={performance.resolved} tone="emerald" />
            <Stat label="Ora mes. zgjidhje" value={performance.avgHours} />
            <Stat label="Refuzime të regjistruara" value={performance.denied} tone="amber" />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Clock className="h-4 w-4 text-indigo-600" /> {dt('Afatet më të afërta')}
            </h3>
            {filteredQueue.filter((r) => r.responseDueAt && r.status !== 'Resolved').length === 0 ? (
              <p className="text-xs text-slate-500">{dt('Asnjë afat i caktuar.')}</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredQueue
                  .filter((r) => r.responseDueAt && r.status !== 'Resolved')
                  .sort((a, b) => Date.parse(a.responseDueAt!) - Date.parse(b.responseDueAt!))
                  .slice(0, 12)
                  .map((r) => {
                    const overdue = isOverdue(r.responseDueAt, r.status);
                    return (
                      <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold text-slate-800 dark:text-slate-200">{r.title}</span>
                          <span className="text-[10px] text-slate-400">{fmtDate(r.responseDueAt)}</span>
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${overdue ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                          {overdue ? dt('E vonuar') : dt('Në afat')}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* ============ LOG ============ */}
      {tab === 'log' && (
        <section className="space-y-3">
          <p className="text-xs text-slate-500">
            {dt('Regjistër i pandryshueshëm. Edhe përpjekjet e refuzuara ruhen.')}
          </p>
          {events.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-slate-900">
              <p className="text-sm text-slate-500">{dt('Asnjë veprim në këtë sesion.')}</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-white/5 dark:border-white/10 dark:bg-slate-900">
              {events.map((e) => (
                <li key={e.id} className="flex items-start gap-3 p-4">
                  <span className={`mt-0.5 ${e.denied ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {e.denied ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                      {dt(e.kind.replace(/_/g, ' '))}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {e.attemptedAction} · {fmtDate(e.at)}
                    </span>
                    {e.denialReason && (
                      <span className="mt-0.5 block text-[11px] text-rose-600">{dt(e.denialReason)}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ============ POLICY ============ */}
      {tab === 'policy' && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]">
            <h2 className="flex items-center gap-2 text-sm font-black text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4" /> {dt('Komuna mund të')}
            </h2>
            <ul className="mt-3 space-y-1.5 text-xs text-emerald-900/90 dark:text-emerald-100/80">
              {MUNICIPALITY_MAY.map((x) => (
                <li key={x}>✓ {dt(x)}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-500/20 dark:bg-rose-500/[0.06]">
            <h2 className="flex items-center gap-2 text-sm font-black text-rose-900 dark:text-rose-200">
              <Gavel className="h-4 w-4" /> {dt('Komuna nuk mund të')}
            </h2>
            <ul className="mt-3 space-y-1.5 text-xs text-rose-900/90 dark:text-rose-100/80">
              {MUNICIPALITY_MAY_NOT.map((x) => (
                <li key={x}>✕ {dt(x)}</li>
              ))}
            </ul>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500 md:col-span-2">
            <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
            {dt('Këto kufizime zbatohen në kod, jo vetëm në kontratë. Pagesa e abonimit nuk jep kontroll mbi përmbajtjen.')}
          </p>
        </section>
      )}
    </div>
  );
}
