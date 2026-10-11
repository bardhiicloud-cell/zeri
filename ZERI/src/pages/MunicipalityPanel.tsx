/**
 * Municipality panel.
 *
 * This is what a paying municipal account sees. It is the counterpart of the
 * editorial firewall: the firewall says what a municipality may NOT do, and this
 * screen is built so that everything it *can* do is one click away, while the
 * things it cannot do are absent from the interface entirely.
 *
 * The design choice that matters: there is no greyed-out delete button. A
 * disabled "Delete" control invites the reader to conclude that a higher tier,
 * or a phone call, would enable it. Instead the panel carries a short, permanent
 * notice of what the account cannot do, and the code behind it refuses the
 * action regardless of what the client sends.
 */
import React, { useMemo, useState } from 'react';
import { dt } from '../lib/dt';
import { useStore } from '../lib/store';
import { KOSOVO_MUNICIPALITIES } from '../lib/constants';
import {
  MUNICIPALITY_MAY,
  MUNICIPALITY_MAY_NOT,
  evaluateEditorialAction,
  canActOnMunicipality,
  canSeeReportStatus,
  canAddWorkFacts,
  validateWorkFact,
  WORK_FACT_LIMITS,
  type WorkFact,
} from '../lib/editorialFirewall';
import { appendEditorialEvent, getSessionEvents } from '../lib/editorialLog';
import { scheduleWorkFact } from '../lib/workFactQueue';
import { MunicipalityShield } from '../components/MunicipalityShield';
import toast from 'react-hot-toast';

/** What the municipality can do to one report. */
type MunicipalityAction = 'respond' | 'attach_document' | 'correct_fact' | 'dispute';

const ACTION_LABELS: Record<MunicipalityAction, string> = {
  respond: 'Dërgo përgjigje zyrtare',
  attach_document: 'Ngarko dokument',
  correct_fact: 'Kërko korrigjim fakti',
  dispute: 'Kundërshto raportin',
};

/** Empty work-fact form. */
const EMPTY_WORK_FACT = {
  description: '',
  completedAt: '',
  performedBy: '',
  cost: '',
};

export default function MunicipalityPanel() {
  const currentUser = useStore((s) => s.currentUser);
  const reports = useStore((s) => s.reports ?? []);

  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [action, setAction] = useState<MunicipalityAction>('respond');
  const [note, setNote] = useState('');
  const [tab, setTab] = useState<'queue' | 'log' | 'policy'>('queue');
  const [workFact, setWorkFact] = useState({ ...EMPTY_WORK_FACT });
  const [workFacts, setWorkFacts] = useState<WorkFact[]>([]);
  const [workFactError, setWorkFactError] = useState('');

  /** The municipality this account represents, and whether it is one at all. */
  const ownMunicipality = currentUser?.municipality ?? '';
  const isMunicipal = currentUser?.role === 'municipality';

  /**
   * The reports a municipality is allowed to see.
   *
   * Two filters, and both are policy rather than convenience:
   *   - only its own municipality (jurisdiction)
   *   - only approved-and-beyond statuses (canSeeReportStatus)
   *
   * A municipal account never sees 'Pending Review', 'Draft' or 'Rejected'. It is
   * a customer of the transparency system, not a moderator of it, so unverified
   * complaints about itself must not reach it — least of all ones that were
   * later dismissed.
   */
  const queue = useMemo(() => {
    if (!isMunicipal) return reports;
    return reports.filter(
      (r) =>
        (r.location?.municipality ?? '').toLowerCase() === ownMunicipality.toLowerCase() &&
        canSeeReportStatus(currentUser, r.status)
    );
  }, [reports, isMunicipal, ownMunicipality, currentUser]);

  // Work facts filed this session, newest first, for the selected report.
  const factsForSelected = useMemo(
    () => workFacts.filter((f) => f.reportId === selectedReportId).reverse(),
    [workFacts, selectedReportId]
  );

  /**
   * File a work fact against the selected report.
   *
   * Gated three ways, in order: the report must be approved, it must be in this
   * municipality's jurisdiction, and the description must be substantive enough
   * to verify. A denial is logged like any other.
   */
  const submitWorkFact = () => {
    if (!selected || !currentUser) return;

    const permission = canAddWorkFacts(currentUser, selected);
    if (!permission.allowed) {
      setWorkFactError(dt(permission.reason));
      appendEditorialEvent({
        kind: 'action_denied',
        subjectId: selected.id,
        subjectType: 'report',
        actorMunicipality: ownMunicipality,
        actorUserId: currentUser.id,
        actorEmail: currentUser.email,
        attemptedAction: 'add_work_facts',
        denied: true,
        denialReason: permission.reason,
      });
      return;
    }

    const valid = validateWorkFact({ description: workFact.description });
    if (!valid.ok) {
      setWorkFactError(dt(valid.error));
      return;
    }
    setWorkFactError('');
    const entry: WorkFact = {
      id: `wf_${Date.now().toString(36)}`,
      reportId: selected.id,
      description: workFact.description.trim(),
      completedAt: workFact.completedAt || undefined,
      performedBy: workFact.performedBy.trim() || undefined,
      cost: workFact.cost.trim() || undefined,
      municipality: ownMunicipality,
      authorUserId: currentUser.id,
      authorEmail: currentUser.email,
      createdAt: new Date().toISOString(),
      // Municipalities write claims, not confirmed record. The newsroom promotes
      // them once verified, which is what keeps this additive rather than a
      // rewrite of the citizen's account.
      review: 'pending',
    };
    setWorkFact({ ...EMPTY_WORK_FACT });

    // The same entry feeds the /komuna overview. Recording it in the shared
    // queue is what stops the two municipality surfaces from disagreeing about
    // what was filed this session.
    scheduleWorkFact({
      reportId: selected.id,
      description: entry.description,
      municipality: ownMunicipality,
    });

    appendEditorialEvent({
      kind: 'work_facts_added',
      subjectId: selected.id,
      subjectType: 'report',
      actorMunicipality: ownMunicipality,
      actorUserId: currentUser.id,
      actorEmail: currentUser.email,
      attemptedAction: 'add_work_facts',
      note: entry.description,
    });

    toast.success(dt('Faktet u regjistruan. Redaksia i verifikon para publikimit.'));
  };

  const selected = queue.find((r) => r.id === selectedReportId) ?? null;
  const events = getSessionEvents();

  /**
   * Submit an action through the firewall.
   *
   * Every path goes through `evaluateEditorialAction` first. The result is logged
   * either way — a refused attempt is exactly the record a later dispute would
   * be about, so it must not be discarded.
   */
  const submit = (chosen: MunicipalityAction) => {
    if (!selected || !currentUser) return;

    const jurisdiction = canActOnMunicipality(currentUser, selected.location?.municipality ?? '');
    if (!jurisdiction.allowed) {
      toast.error(dt(jurisdiction.reason));
      appendEditorialEvent({
        kind: 'action_denied',
        subjectId: selected.id,
        subjectType: 'report',
        actorMunicipality: ownMunicipality,
        actorUserId: currentUser.id,
        actorEmail: currentUser.email,
        attemptedAction: chosen,
        denied: true,
        denialReason: jurisdiction.reason,
      });
      return;
    }

    const decision = evaluateEditorialAction(currentUser, chosen);
    if (!decision.allowed) {
      toast.error(dt(decision.reason));
      appendEditorialEvent({
        kind: 'action_denied',
        subjectId: selected.id,
        subjectType: 'report',
        actorMunicipality: ownMunicipality,
        actorUserId: currentUser.id,
        actorEmail: currentUser.email,
        attemptedAction: chosen,
        denied: true,
        denialReason: decision.reason,
      });
      return;
    }

    const kindFor: Record<MunicipalityAction, Parameters<typeof appendEditorialEvent>[0]['kind']> = {
      respond: 'response_published',
      attach_document: 'document_attached',
      correct_fact: 'correction_requested',
      dispute: 'report_disputed',
    };

    appendEditorialEvent({
      kind: kindFor[chosen],
      subjectId: selected.id,
      subjectType: 'report',
      actorMunicipality: ownMunicipality,
      actorUserId: currentUser.id,
      actorEmail: currentUser.email,
      attemptedAction: chosen,
      note: note.trim() || undefined,
    });

    toast.success(
      decision.requiresReview
        ? dt('Kërkesa u regjistrua. Redaksia e shqyrton.')
        : dt('Përgjigja u publikua.')
    );
    setNote('');
  };

  if (!isMunicipal) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-black text-slate-900 dark:text-white">{dt('Qasje e kufizuar')}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {dt('Ky panel është i dedikuar llogarive të komunave.')}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
        <MunicipalityShield name={ownMunicipality || KOSOVO_MUNICIPALITIES[0]} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">
            {dt('Llogari komunale')}
          </p>
          <h1 className="mt-1 truncate font-serif text-2xl font-black text-slate-950 dark:text-white">
            {ownMunicipality || dt('Pa komunë të caktuar')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {currentUser.name} · {currentUser.email}
          </p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
          {currentUser.municipalityPlan ? dt(`Plani ${currentUser.municipalityPlan}`) : dt('Aktiv')}
        </span>
      </header>

      {/* Tabs */}
      <nav className="flex gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-white/10 dark:bg-slate-900">
        {([
          { id: 'queue', label: 'Raportimet e komunës' },
          { id: 'log', label: 'Regjistri i veprimeve' },
          { id: 'policy', label: 'Firewall-i editorial' },
        ] as const).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${tab === id
                ? 'bg-blue-700 text-white'
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
          >
            {dt(label)}
          </button>
        ))}
      </nav>

      {tab === 'queue' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          {/* Report list */}
          <section className="space-y-2">
            {queue.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10">
                {dt('Nuk ka raportime për komunën tuaj.')}
              </p>
            )}
            {queue.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => setSelectedReportId(report.id)}
                aria-pressed={selectedReportId === report.id}
                className={`block w-full rounded-xl border p-4 text-left transition-colors ${selectedReportId === report.id
                    ? 'border-blue-400 bg-blue-50/60 dark:border-blue-500/40 dark:bg-blue-500/10'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-slate-900'
                  }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">
                      {report.title}
                    </span>
                    <span className="mt-1 block text-[11px] text-slate-500">
                      {report.category} · {report.location?.municipality}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {report.status}
                  </span>
                </div>
              </button>
            ))}
          </section>

          {/* Action panel */}
          <aside className="space-y-4">
            {!selected ? (
              <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-white/10">
                {dt('Zgjidhni një raportim për të vepruar.')}
              </p>
            ) : (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
                <h2 className="text-sm font-black text-slate-900 dark:text-white">{selected.title}</h2>

                {/* Only the four constructive actions are offered. */}
                <div className="space-y-1.5">
                  {(Object.keys(ACTION_LABELS) as MunicipalityAction[]).map((a) => {
                    const decision = evaluateEditorialAction(currentUser, a);
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAction(a)}
                        aria-pressed={action === a}
                        disabled={!decision.allowed}
                        className={`block w-full rounded-lg border px-3 py-2 text-left text-xs font-bold transition-colors ${action === a
                            ? 'border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                      >
                        {dt(ACTION_LABELS[a])}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  maxLength={1200}
                  placeholder={dt('Shkruani përgjigjen, korrigjimin ose arsyen...')}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                />

                <button
                  type="button"
                  onClick={() => submit(action)}
                  disabled={!note.trim()}
                  className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-black text-white transition-colors hover:bg-blue-800 disabled:opacity-40"
                >
                  {dt(ACTION_LABELS[action])}
                </button>

                {/* The permanent reminder, stated where the temptation arises. */}
                <p className="border-t border-slate-100 pt-3 text-[10px] leading-relaxed text-slate-400 dark:border-white/10">
                  {dt('Llogaria komunale nuk mund të fshijë, fshehë ose ndryshojë raportime qytetarësh. Çdo përpjekje regjistrohet.')}
                </p>
              </div>
            )}

            {/*
              Work facts.

              The one contribution that is about the municipality itself rather
              than about the citizen's complaint: what it actually fixed. Only
              offered once the report is approved, because there is nothing
              verified to describe works against before that.

              Entries are filed as claims, not as record. The newsroom confirms
              them, which is what keeps this additive: the citizen's original
              account is never overwritten by the municipality's version of it.
            */}
            {selected && (
              <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-500/20 dark:bg-blue-500/[0.06]">
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white">
                    {dt('Fakte për punimet e kryera')}
                  </h3>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
                    {dt('Shtoni çka është rregulluar vërtet. Redaksia i verifikon para publikimit.')}
                  </p>
                </div>

                {!canAddWorkFacts(currentUser, selected).allowed && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                    {dt(canAddWorkFacts(currentUser, selected).reason)}
                  </p>
                )}

                <textarea
                  value={workFact.description}
                  onChange={(e) => { setWorkFact((w) => ({ ...w, description: e.target.value })); setWorkFactError(''); }}
                  rows={3}
                  maxLength={WORK_FACT_LIMITS.descriptionMax}
                  placeholder={dt('Përshkrimi i punimeve: çka u rregullua, kur dhe si...')}
                  disabled={!canAddWorkFacts(currentUser, selected).allowed}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 disabled:opacity-50 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                />

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold text-slate-600 dark:text-slate-300">{dt('Data e përfundimit')}</span>
                    <input
                      type="date"
                      value={workFact.completedAt}
                      onChange={(e) => setWorkFact((w) => ({ ...w, completedAt: e.target.value }))}
                      disabled={!canAddWorkFacts(currentUser, selected).allowed}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none disabled:opacity-50 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold text-slate-600 dark:text-slate-300">{dt('Kostoja')}</span>
                    <input
                      type="text"
                      value={workFact.cost}
                      onChange={(e) => setWorkFact((w) => ({ ...w, cost: e.target.value }))}
                      placeholder={dt('p.sh. 1,200 € ose Falas')}
                      disabled={!canAddWorkFacts(currentUser, selected).allowed}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none disabled:opacity-50 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold text-slate-600 dark:text-slate-300">{dt('Kryer nga')}</span>
                  <input
                    type="text"
                    value={workFact.performedBy}
                    onChange={(e) => setWorkFact((w) => ({ ...w, performedBy: e.target.value }))}
                    placeholder={dt('p.sh. Ndërmarrja Publike HORTIKULTURA')}
                    disabled={!canAddWorkFacts(currentUser, selected).allowed}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none disabled:opacity-50 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                  />
                </label>

                {workFactError && (
                  <p className="text-[10px] text-rose-600">{workFactError}</p>
                )}

                <button
                  type="button"
                  onClick={submitWorkFact}
                  disabled={!canAddWorkFacts(currentUser, selected).allowed || !workFact.description.trim()}
                  className="w-full rounded-lg bg-blue-700 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-blue-800 disabled:opacity-40"
                >
                  {dt('Regjistro faktet')}
                </button>

                {factsForSelected.length > 0 && (
                  <ul className="space-y-2 border-t border-blue-200 pt-3 dark:border-blue-500/20">
                    {factsForSelected.map((f) => (
                      <li key={f.id} className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-white/10 dark:bg-slate-900">
                        <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">{f.description}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                          {f.completedAt && <span>{dt('Përfunduar')}: {f.completedAt}</span>}
                          {f.cost && <span>· {f.cost}</span>}
                          {f.performedBy && <span>· {f.performedBy}</span>}
                          <span className={`rounded-full px-1.5 py-0.5 font-bold ${
                            f.review === 'confirmed'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                          }`}>
                            {f.review === 'confirmed' ? dt('Verifikuar') : dt('Në verifikim')}
                          </span>
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* The rules, always visible, so nobody fills a form they cannot send. */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                {dt('Komuna mund të')}
              </h3>
              <ul className="mt-2 space-y-1">
                {MUNICIPALITY_MAY.map((x) => (
                  <li key={x} className="flex gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="text-emerald-600">✓</span>{dt(x)}
                  </li>
                ))}
              </ul>
              <h3 className="mt-4 text-[11px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">
                {dt('Komuna nuk mund të')}
              </h3>
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
      )}

      {tab === 'log' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
          <h2 className="text-sm font-black text-slate-900 dark:text-white">{dt('Regjistri i veprimeve')}</h2>
          <p className="mt-1 text-[11px] text-slate-500">
            {dt('Regjistër i pandryshueshëm. Edhe përpjekjet e refuzuara regjistrohen.')}
          </p>
          {events.length === 0 ? (
            <p className="mt-4 text-xs text-slate-400">{dt('Asnjë veprim në këtë sesion.')}</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 dark:divide-white/5">
              {events.map((e) => (
                <li key={e.id} className="flex items-start gap-3 py-2.5">
                  <span className={`mt-0.5 text-xs ${e.denied ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {e.denied ? '✕' : '✓'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                      {dt(e.kind.replace(/_/g, ' '))}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {e.attemptedAction} · {new Date(e.at).toLocaleString('sq-AL')}
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

      {tab === 'policy' && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]">
            <h2 className="text-sm font-black text-emerald-900 dark:text-emerald-200">{dt('Komuna mund të')}</h2>
            <ul className="mt-3 space-y-1.5">
              {MUNICIPALITY_MAY.map((x) => (
                <li key={x} className="flex gap-2 text-xs text-emerald-900/90 dark:text-emerald-100/80">
                  <span>✓</span>{dt(x)}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-500/20 dark:bg-rose-500/[0.06]">
            <h2 className="text-sm font-black text-rose-900 dark:text-rose-200">{dt('Komuna nuk mund të')}</h2>
            <ul className="mt-3 space-y-1.5">
              {MUNICIPALITY_MAY_NOT.map((x) => (
                <li key={x} className="flex gap-2 text-xs text-rose-900/90 dark:text-rose-100/80">
                  <span>✕</span>{dt(x)}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            {dt('Këto kufizime zbatohen në kod, jo vetëm në kontratë. Pagesa e abonimit nuk jep kontroll mbi përmbajtjen.')}
          </p>
        </section>
      )}
    </div>
  );
}