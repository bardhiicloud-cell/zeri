/**
 * Municipality provisioning panel — the super admin's tool for creating a
 * municipal account.
 *
 * Built as an explicit four-step agent rather than one long form, because the
 * steps have a real dependency order and the consent step is a legal gate:
 *
 *   1. Identity      — who is the official, what is their email
 *   2. Jurisdiction  — which municipality, which subscription tier
 *   3. Consent       — the editorial firewall clause, shown in full and accepted
 *   4. Review        — everything re-validated, then activated
 *
 * Step 3 is deliberately not a checkbox buried under a form. The clause is
 * rendered in full and must be scrolled and accepted, because the entire business
 * relationship depends on the municipality understanding — before they pay — that
 * they are buying data tools, not editorial influence.
 */
import { useState } from 'react';
import { dt } from '../../lib/dt';
import { useStore } from '../../lib/store';
import { requireAdminToken, describeApiFailure } from '../../lib/adminApi';
import { KOSOVO_MUNICIPALITIES } from '../../lib/constants';
import MunicipalityAccountManager from './MunicipalityAccountManager';
import { EDITORIAL_FIREWALL_CLAUSE, MUNICIPALITY_MAY, MUNICIPALITY_MAY_NOT } from '../../lib/editorialFirewall';
import {
  EMPTY_DRAFT,
  MUNICIPALITY_PLANS,
  PLAN_DISCLAIMER,
  STEP_TITLES,
  acceptClause,
  buildMunicipalityAccount,
  nextStep,
  previousStep,
  validateStep,
  type MunicipalityDraft,
  type ProvisioningStep,
} from '../../lib/municipalityProvisioning';
import { Building2, Check, ChevronLeft, ChevronRight, ShieldCheck, AlertTriangle, LayoutGrid, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Municipality provisioning — super admin only.
 *
 * A four-step agent rather than one form, because the steps depend on each
 * other and step three is a legal gate. The consent step is not a checkbox
 * tucked under a form: the clause is rendered in full and must be scrolled
 * before it can be accepted, so nobody activates an account on a
 * municipality's behalf without that municipality having been shown what it
 * is agreeing to.
 *
 * The role check is repeated here for the UI's benefit. The authoritative check
 * is the server's — a client-side guard only decides what is drawn.
 */
export default function MunicipalityProvisioning() {
  const currentUser = useStore((s) => s.currentUser);
  const isSuperAdmin = currentUser?.role === 'superadmin';

  const [step, setStep] = useState<ProvisioningStep>('identity');
  const [draft, setDraft] = useState<MunicipalityDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [clauseRead, setClauseRead] = useState(false);
  const [created, setCreated] = useState<Record<string, unknown> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  /**
   * Two jobs, one screen.
   *
   * Creating an account and running an existing one are different tasks for the
   * same person, so they are modes of this panel rather than two menu entries —
   * the operator does not have to remember which admin tab owns which.
   */
  const [mode, setMode] = useState<'create' | 'manage'>('create');

  const set = <K extends keyof MunicipalityDraft>(key: K, value: MunicipalityDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const stepIndex = ['identity', 'jurisdiction', 'consent', 'review'].indexOf(step);

  const advance = () => {
    const result = validateStep(step, draft);
    if (!result.ok) {
      setErrors(result.errors);
      toast.error(dt('Plotësoni fushat e detyrueshme.'));
      return;
    }
    setErrors({});
    setStep(nextStep(step));
  };

  const activate = async () => {
    const built = buildMunicipalityAccount(draft);
    if (!built.ok) {
      setErrors(built.errors);
      toast.error(dt('Të dhënat nuk janë të plota.'));
      return;
    }

    /**
     * The account is created on the server, not here.
     *
     * The client cannot create a Firebase Auth user, and it must not be able to —
     * the role, the custom claims and the firewall timestamp are all decided
     * server-side. This call sends the reviewed draft and the server returns the
     * uid it actually created, which is what is shown on the final step.
     */
    setIsSaving(true);
    setSaveError('');
    try {
      const token = await requireAdminToken();

      const response = await fetch('/api/v1/admin/municipalities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...built.account,
          // The server reads these two keys by name; the rest of the account
          // fields are the draft as reviewed.
          plan: draft.plan,
          internalNote: draft.internalNote,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(describeApiFailure(response.status, result));

      setCreated(result);
      setStep('done');
      toast.success(dt('Llogaria komunale u krijua.'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Llogaria komunale nuk u krijua.';
      setSaveError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 text-lg font-black text-slate-900 dark:text-white">
          {dt('Vetëm Super Admin')}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {dt('Krijimi i llogarive komunale kërkon të drejta Super Admin.')}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <header className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-700 text-white">
          <Building2 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-serif text-xl font-black text-slate-950 dark:text-white">
            {dt('Krijo llogari komune')}
          </h1>
          <p className="text-xs text-slate-500">
            {dt('Provisionim me firewall editorial të detyrueshëm.')}
          </p>
        </div>
      </header>

      <div className="mb-5 flex gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-white/10 dark:bg-slate-900">
        {([
          { id: 'create', label: 'Krijo llogari të re', icon: UserPlus },
          { id: 'manage', label: 'Menaxho llogaritë', icon: LayoutGrid },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            aria-pressed={mode === id}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
              mode === id ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <Icon className="h-4 w-4" />
            {dt(label)}
          </button>
        ))}
      </div>

      {mode === 'manage' ? (
        <MunicipalityAccountManager />
      ) : (
        <>
      {/* Progress */}
      {step !== 'done' && (
        <ol className="flex items-center gap-2">
          {(['identity', 'jurisdiction', 'consent', 'review'] as const).map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-black ${i < stepIndex
                    ? 'bg-emerald-500 text-white'
                    : i === stepIndex
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
              >
                {i < stepIndex ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={`hidden text-[11px] font-bold sm:block ${i === stepIndex ? 'text-slate-900 dark:text-white' : 'text-slate-400'
                }`}>
                {dt(STEP_TITLES[s])}
              </span>
              {i < 3 && <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />}
            </li>
          ))}
        </ol>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
        {/* STEP 1 — identity */}
        {step === 'identity' && (
          <div className="space-y-4">
            <h2 className="text-sm font-black text-slate-900 dark:text-white">{dt('Zyrtari përgjegjës')}</h2>
            {([
              ['contactName', 'Emri dhe mbiemri', 'text'],
              ['contactRole', 'Roli / pozita', 'text'],
              ['contactEmail', 'Email-i zyrtar (bëhet adresa e hyrjes)', 'email'],
              ['contactPhone', 'Telefoni (opsional)', 'tel'],
            ] as const).map(([key, label, type]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">{dt(label)}</span>
                <input
                  type={type}
                  value={String(draft[key])}
                  onChange={(e) => set(key, e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none dark:bg-slate-950 dark:text-white ${errors[key] ? 'border-rose-400' : 'border-slate-200 dark:border-white/10 focus:border-blue-500'
                    }`}
                />
                {errors[key] && <span className="mt-1 block text-[11px] text-rose-600">{dt(errors[key])}</span>}
              </label>
            ))}
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {dt('Fjalëkalim fillestar (opsional — përndryje dërgohet email)')}
              </span>
              <input
                type="password"
                value={draft.initialPassword}
                onChange={(e) => set('initialPassword', e.target.value)}
                placeholder="min. 8 shenja, shkronja + numra"
                autoComplete="new-password"
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none dark:bg-slate-950 dark:text-white ${errors.initialPassword ? 'border-rose-400' : 'border-slate-200 dark:border-white/10 focus:border-blue-500'}`}
              />
              {errors.initialPassword && <span className="mt-1 block text-[11px] text-rose-600">{dt(errors.initialPassword)}</span>}
              <span className="mt-1 block text-[11px] text-slate-400">
                {dt('Nëse e lë bosh, zyrtari merr email për të vendosur fjalëkalimin vetë.')}
              </span>
            </label>
          </div>
        )}

        {/* STEP 2 — jurisdiction */}
        {step === 'jurisdiction' && (
          <div className="space-y-4">
            <h2 className="text-sm font-black text-slate-900 dark:text-white">{dt('Komuna dhe plani')}</h2>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">{dt('Komuna')}</span>
              <select
                value={draft.municipality}
                onChange={(e) => set('municipality', e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none dark:bg-slate-950 dark:text-white ${errors.municipality ? 'border-rose-400' : 'border-slate-200 dark:border-white/10'
                  }`}
              >
                <option value="">{dt('Zgjidhni komunën...')}</option>
                {KOSOVO_MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              {errors.municipality && <span className="mt-1 block text-[11px] text-rose-600">{dt(errors.municipality)}</span>}
            </label>

            <div className="space-y-2">
              <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">{dt('Plani i abonimit')}</span>
              {MUNICIPALITY_PLANS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => set('plan', p.id)}
                  aria-pressed={draft.plan === p.id}
                  className={`block w-full rounded-xl border p-3 text-left transition-colors ${draft.plan === p.id
                      ? 'border-blue-400 bg-blue-50/60 dark:border-blue-500/40 dark:bg-blue-500/10'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-slate-800'
                    }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 dark:text-white">{dt(p.name)}</span>
                    <span className="text-xs font-black text-blue-700 dark:text-blue-300">{p.pricePerMonth} €/{dt('muaj')}</span>
                  </span>
                  <ul className="mt-2 space-y-0.5">
                    {p.features.map((f: string) => (
                      <li key={f} className="text-[11px] text-slate-500 dark:text-slate-400">· {dt(f)}</li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            {/* Stated once, prominently, at the moment a plan is chosen. */}
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/[0.06] dark:text-amber-200">
              <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
              {dt(PLAN_DISCLAIMER)}
            </p>
          </div>
        )}

        {/* STEP 3 — consent */}
        {step === 'consent' && (
          <div className="space-y-4">
            <h2 className="text-sm font-black text-slate-900 dark:text-white">{dt('Firewall-i editorial')}</h2>
            <p className="text-[11px] text-slate-500">
              {dt('Lexoni dhe pranoni klauzolën. Ajo bëhet pjesë e kontratës.')}
            </p>

            <div
              className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950"
              onScroll={(e) => {
                const el = e.currentTarget;
                // Requiring a scroll to the bottom is a small friction that
                // prevents "accept" being clicked without the clause ever being
                // on screen.
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setClauseRead(true);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    {dt('Komuna mund të')}
                  </h3>
                  <ul className="mt-2 space-y-1">
                    {MUNICIPALITY_MAY.map((x: string) => (
                      <li key={x} className="flex gap-2 text-[11px] text-slate-700 dark:text-slate-300">
                        <span className="text-emerald-600">✓</span>{x}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">
                    {dt('Komuna nuk mund të')}
                  </h3>
                  <ul className="mt-2 space-y-1">
                    {MUNICIPALITY_MAY_NOT.map((x: string) => (
                      <li key={x} className="flex gap-2 text-[11px] text-slate-700 dark:text-slate-300">
                        <span className="text-rose-600">✕</span>{x}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <pre className="mt-4 whitespace-pre-wrap border-t border-slate-200 pt-3 font-sans text-[11px] leading-relaxed text-slate-500 dark:border-white/10">
                {EDITORIAL_FIREWALL_CLAUSE}
              </pre>
            </div>

            {!clauseRead && (
              <p className="text-[11px] text-slate-400">{dt('Lëvizni deri në fund për të aktivizuar pranimin.')}</p>
            )}

            <label className={`flex items-start gap-3 ${clauseRead ? '' : 'pointer-events-none opacity-40'}`}>
              <input
                type="checkbox"
                checked={draft.clauseAccepted}
                onChange={(e) => setDraft(acceptClause(draft, e.target.checked))}
                className="mt-0.5 h-4 w-4 accent-blue-700"
              />
              <span className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                {dt('Pranoj klauzolën e firewall-it editorial. Kuptoj që abonimi nuk jep kontroll mbi përmbajtjen dhe që përpjekjet për heqje regjistrohen.')}
              </span>
            </label>
            {errors.clauseAccepted && (
              <span className="block text-[11px] text-rose-600">{dt(errors.clauseAccepted)}</span>
            )}
            {draft.clauseAcceptedAt && (
              <p className="text-[11px] text-slate-400">
                {dt('Pranuar:')} {new Date(draft.clauseAcceptedAt).toLocaleString('sq-AL')}
              </p>
            )}
          </div>
        )}

        {/* STEP 4 — review */}
        {step === 'review' && (
          <div className="space-y-4">
            <h2 className="text-sm font-black text-slate-900 dark:text-white">{dt('Përmbledhje')}</h2>
            <dl className="divide-y divide-slate-100 text-xs dark:divide-white/5">
              {([
                ['Zyrtari', draft.contactName],
                ['Roli', draft.contactRole],
                ['Email', draft.contactEmail],
                ['Telefoni', draft.contactPhone || '—'],
                ['Komuna', draft.municipality],
                ['Plani', MUNICIPALITY_PLANS.find((p) => p.id === draft.plan)?.name ?? draft.plan],
                ['Fjalëkalimi', draft.initialPassword ? dt('Vendosur direkt') : dt('Do dërgohet me email')],
                ['Klauzola', draft.clauseAccepted ? dt('Pranuar') : dt('E papranuar')],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 py-2">
                  <dt className="font-bold text-slate-500">{dt(k)}</dt>
                  <dd className="text-right font-semibold text-slate-900 dark:text-white">{v}</dd>
                </div>
              ))}
            </dl>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {dt('Shënim i brendshëm (vetëm stafi)')}
              </span>
              <textarea
                value={draft.internalNote}
                onChange={(e) => set('internalNote', e.target.value)}
                rows={2}
                maxLength={500}
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
              />
            </label>

            {/* The server is the authority; a refusal is shown where the
                activation happens rather than in a toast that disappears. */}
            {saveError && (
              <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] leading-relaxed text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {saveError}
              </p>
            )}
          </div>
        )}

        {/* DONE */}
        {step === 'done' && created && (
          <div className="space-y-4 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-500/10">
              <Check className="h-6 w-6 text-emerald-600" />
            </span>
            <h2 className="text-sm font-black text-slate-900 dark:text-white">
              {dt('Llogaria komunale u krijua')}
            </h2>
            <p className="text-xs text-slate-500">
              {String(created.municipality ?? draft.municipality)} · {String(created.email ?? draft.contactEmail)}
            </p>
            {/*
              What actually happened with the password, in plain language.
              This is the one thing the operator needs to relay to the
              municipality, so it is not left to be inferred from the JSON.
            */}
            <p className={`mx-auto max-w-lg rounded-xl border p-3 text-[11px] leading-relaxed ${
              created.passwordSet
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06] dark:text-emerald-200'
                : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/[0.06] dark:text-amber-200'
            }`}>
              {created.passwordSet
                ? dt('Fjalëkalimi është vendosur. Llogaria mund të hyjë menjëherë me email-in dhe fjalëkalimin e dhënë.')
                : dt('Pa fjalëkalim fillestar. Komuna duhet të përdorë "harruar fjalëkalimin" për të hyrë herën e parë.')}
            </p>
            <pre className="mx-auto max-w-lg overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-[11px] leading-relaxed text-slate-600 dark:border-white/10 dark:bg-slate-950 dark:text-slate-400">
              {JSON.stringify(created, null, 2)}
            </pre>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <a
                href="/komuna"
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-blue-800"
              >
                {dt('Hap panelin e komunës')}
              </a>
              <button
                type="button"
                onClick={() => { setDraft(EMPTY_DRAFT); setCreated(null); setStep('identity'); setClauseRead(false); setSaveError(''); }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {dt('Krijo një komunë tjetër')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      {step !== 'done' && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep(previousStep(step))}
            disabled={step === 'identity' || isSaving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> {dt('Kthehu')}
          </button>
          {step === 'review' ? (
            <button
              type="button"
              onClick={activate}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-black text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {isSaving ? dt('Po krijohet…') : dt('Aktivizo llogarinë')}
            </button>
          ) : (
            <button
              type="button"
              onClick={advance}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-5 py-2 text-xs font-black text-white transition-colors hover:bg-blue-800"
            >
              {dt('Vazhdo')} <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
}