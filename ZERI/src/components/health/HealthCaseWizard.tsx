import { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Camera, Check, FileText, Heart, Link as LinkIcon, Lock, Plus, ShieldCheck, Upload, UserRound, X,
} from 'lucide-react';
import { dt } from '../../lib/dt';
import { KOSOVO_MUNICIPALITIES } from '../../lib/constants';
import {
  CATEGORY_META, NEED_SUGGESTIONS, URGENCY_META, categoryMeta, urgencyMeta,
  type HealthCategory, type HealthUrgency,
} from '../../lib/healthCategories';
import { cn } from '../../lib/utils';
import type { HealthCase } from '../../types';

export interface HealthFormState {
  fullName: string;
  age: number;
  gender: HealthCase['gender'];
  municipality: string;
  neighborhood: string;
  category: HealthCategory;
  diagnosis: string;
  diagnosedYear: number;
  urgency: HealthUrgency;
  needsInput: string;
  description: string;
  contactPhone: string;
  contactName: string;
  isAnonymous: boolean;
  consentToProcessing: boolean;
  supportAmountNeeded: number;
  donationUrl: string;
  imageUrl: string;
  documentType: 'image' | 'pdf';
  documentName: string;
}

interface Props {
  form: HealthFormState;
  setForm: (updater: (prev: HealthFormState) => HealthFormState) => void;
  neighborhoods: string[];
  /** True when a real (non-anonymous-auth) account is signed in: documents and links need one. */
  canAttach: boolean;
  isSubmitting: boolean;
  isUploadingDocument: boolean;
  onPickDocument: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  onClose: () => void;
}

const STEPS = [
  { id: 'privacy', label: 'Privatësia' },
  { id: 'patient', label: 'Pacienti' },
  { id: 'condition', label: 'Gjendja' },
  { id: 'review', label: 'Dërgimi' },
] as const;

const field = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-rose-500 focus:bg-white focus:ring-2 focus:ring-rose-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:ring-rose-900/30';
const label = 'mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300';

const parseNeeds = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 10);

export function HealthCaseWizard({
  form, setForm, neighborhoods, canAttach, isSubmitting, isUploadingDocument, onPickDocument, onSubmit, onClose,
}: Props) {
  const [step, setStep] = useState(0);
  const [needDraft, setNeedDraft] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof HealthFormState>(key: K, value: HealthFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const needs = useMemo(() => parseNeeds(form.needsInput), [form.needsInput]);
  const setNeeds = (next: string[]) => set('needsInput', next.join(', '));
  const addNeed = (raw: string) => {
    const value = raw.trim().slice(0, 120);
    if (!value || needs.some((need) => need.toLowerCase() === value.toLowerCase()) || needs.length >= 10) return;
    setNeeds([...needs, value]);
  };

  /** Returns a message when the current step cannot be left yet. */
  const problem = (index: number): string => {
    if (index === 1) {
      if (!form.isAnonymous && !form.fullName.trim()) return 'Shënoni emrin e pacientit ose zgjidhni regjistrimin anonim.';
      if (form.age < 0 || form.age > 120) return 'Mosha duhet të jetë mes 0 dhe 120.';
    }
    if (index === 2 && !form.diagnosis.trim()) return 'Shënoni diagnozën specifike.';
    if (index === 3 && !form.consentToProcessing) return 'Konfirmoni pëlqimin për përpunimin konfidencial.';
    return '';
  };

  const next = () => {
    const message = problem(step);
    setError(message);
    if (!message) setStep((value) => Math.min(STEPS.length - 1, value + 1));
  };
  const back = () => { setError(''); setStep((value) => Math.max(0, value - 1)); };

  const cat = categoryMeta(form.category);
  const urg = urgencyMeta(form.urgency);
  const isLast = step === STEPS.length - 1;

  return (
    <form
      onSubmit={(event) => { event.preventDefault(); if (isLast) { const m = problem(3); setError(m); if (!m) onSubmit(); } else next(); }}
      className="flex min-h-0 flex-1 flex-col"
    >
      {/* Progress */}
      <ol className="flex items-center gap-2 px-6 pt-4" aria-label={dt('Hapat e formularit')}>
        {STEPS.map((item, index) => (
          <li key={item.id} className="flex flex-1 flex-col gap-1.5" aria-current={index === step ? 'step' : undefined}>
            <span className={cn('h-1.5 rounded-full transition-colors', index <= step ? 'bg-rose-500' : 'bg-slate-200 dark:bg-zinc-700')} />
            <span className={cn('text-xs font-bold uppercase tracking-wider', index === step ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400')}>
              {index + 1}. {dt(item.label)}
            </span>
          </li>
        ))}
      </ol>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {step === 0 && (
          <>
            <div>
              <h4 className="text-base font-black text-slate-900 dark:text-white">{dt('Si dëshironi ta dërgoni kërkesën?')}</h4>
              <p className="mt-1 text-xs text-slate-500">{dt('Mund ta ndryshoni zgjedhjen para dërgimit.')}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { anonymous: true, icon: Lock, title: 'Anonim', tone: 'rose', points: ['Pa emër, telefon ose lagje', 'Pa dokumente dhe pa link donacioni', 'Kodi i rastit për ndjekje'] },
                { anonymous: false, icon: UserRound, title: 'Me identitet', tone: 'blue', points: ['Emri ruhet privatisht për verifikim', 'Mund të bashkëngjitni dokument', 'Stafi mund t’ju kontaktojë'] },
              ].map((option) => {
                const selected = form.isAnonymous === option.anonymous;
                return (
                  <button
                    key={option.title}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setForm((prev) => option.anonymous
                      ? { ...prev, isAnonymous: true, fullName: '', contactPhone: '', contactName: '', imageUrl: '', documentName: '', donationUrl: '' }
                      : { ...prev, isAnonymous: false })}
                    className={cn(
                      'rounded-2xl border-2 p-4 text-left transition',
                      selected
                        ? option.tone === 'rose' ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30' : 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                        : 'border-slate-200 hover:border-slate-300 dark:border-zinc-700',
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', option.tone === 'rose' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60' : 'bg-blue-100 text-blue-600 dark:bg-blue-950/60')}>
                        <option.icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      {selected && <Check className="h-5 w-5 text-emerald-600" aria-hidden="true" />}
                    </span>
                    <span className="mt-3 block text-sm font-black text-slate-900 dark:text-white">{dt(option.title)}</span>
                    <ul className="mt-2 space-y-1">
                      {option.points.map((point) => (
                        <li key={point} className="flex gap-1.5 text-xs leading-snug text-slate-600 dark:text-slate-400">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" aria-hidden="true" />{dt(point)}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
            <p className="flex gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-zinc-800/60 dark:text-slate-400">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              {dt('Rasti nuk publikohet kurrë. Të dhënat mjekësore shihen vetëm nga stafi i autorizuar. Mos shkruani emra në përshkrim.')}
            </p>
          </>
        )}

        {step === 1 && (
          <>
            {!form.isAnonymous && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={label} htmlFor="hc-name">{dt('Emri i pacientit')} *</label>
                  <input id="hc-name" className={field} maxLength={120} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder={dt('Shfaqet vetëm për stafin e autorizuar')} />
                </div>
                <div>
                  <label className={label} htmlFor="hc-phone">{dt('Telefoni / kontakti')}</label>
                  <input id="hc-phone" className={field} maxLength={40} value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} placeholder="+383 44 123 456" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <label className={label} htmlFor="hc-age">{dt('Mosha (vjeç)')}</label>
                <input id="hc-age" type="number" min={0} max={120} className={field} value={form.age} onChange={(e) => set('age', parseInt(e.target.value) || 0)} />
              </div>
              <div className="col-span-2 sm:col-span-2">
                <span className={label}>{dt('Gjinia')}</span>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-zinc-800" role="radiogroup" aria-label={dt('Gjinia')}>
                  {(['Mashkull', 'Femër', 'Tjetër'] as const).map((g) => (
                    <button key={g} type="button" role="radio" aria-checked={form.gender === g} onClick={() => set('gender', g)}
                      className={cn('rounded-lg py-2 text-xs font-bold transition', form.gender === g ? 'bg-white text-rose-700 shadow-sm dark:bg-zinc-700 dark:text-rose-300' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200')}>
                      {g === 'Tjetër' ? dt('Gjini tjetër') : dt(g)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="hc-mun">{dt('Komuna (nga 38 Komunat)')} *</label>
                <select id="hc-mun" className={field} value={form.municipality} onChange={(e) => setForm((prev) => ({ ...prev, municipality: e.target.value, neighborhood: '' }))}>
                  {KOSOVO_MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {!form.isAnonymous ? (
                <div>
                  <label className={label} htmlFor="hc-nb">{dt('Lagjja / Fshati')}</label>
                  {neighborhoods.length > 0 ? (
                    <select id="hc-nb" className={field} value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)}>
                      <option value="">{dt('Zgjidh lagjen…')}</option>
                      {neighborhoods.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  ) : (
                    <input id="hc-nb" className={field} value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} placeholder="psh. Qendra, Dardania" />
                  )}
                </div>
              ) : (
                <p className="self-end rounded-xl bg-slate-50 p-3 text-xs leading-snug text-slate-500 dark:bg-zinc-800/60">
                  {dt('Në regjistrimin anonim ruhet vetëm komuna, që rasti të drejtohet te institucioni i duhur.')}
                </p>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <span className={label}>{dt('Kategoria e sëmundjes')} *</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={dt('Kategoria e sëmundjes')}>
                {CATEGORY_META.map((item) => {
                  const selected = form.category === item.id;
                  return (
                    <button key={item.id} type="button" role="radio" aria-checked={selected} onClick={() => set('category', item.id)}
                      className={cn('flex flex-col items-center gap-1.5 rounded-xl border-2 p-2.5 text-center transition', selected ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30' : 'border-slate-200 hover:border-slate-300 dark:border-zinc-700')}>
                      <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', item.tile)}><item.icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                      <span className="text-xs font-bold leading-tight text-slate-800 dark:text-slate-200">{dt(item.name)}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">{dt(cat.hint)}</p>
            </div>

            <div>
              <span className={label}>{dt('Niveli i urgjencës')}</span>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={dt('Niveli i urgjencës')}>
                {URGENCY_META.map((item) => {
                  const selected = form.urgency === item.id;
                  return (
                    <button key={item.id} type="button" role="radio" aria-checked={selected} onClick={() => set('urgency', item.id)}
                      className={cn('rounded-xl border-2 p-3 text-left transition', selected ? item.card : 'border-slate-200 hover:border-slate-300 dark:border-zinc-700')}>
                      <span className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                        <span className={cn('h-2.5 w-2.5 rounded-full', item.dot)} />{dt(item.label)}
                      </span>
                      <span className="mt-1 block text-xs leading-snug text-slate-500">{dt(item.description)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <div>
                <label className={label} htmlFor="hc-diag">{dt('Diagnoza specifike')} *</label>
                <input id="hc-diag" className={field} maxLength={300} value={form.diagnosis} onChange={(e) => set('diagnosis', e.target.value)} placeholder={dt('psh. Adenokarcinomë, Kardiomiopati e Dilatuar, SPOK, Leuçemi...')} />
              </div>
              <div>
                <label className={label} htmlFor="hc-year">{dt('Viti i diagnozës')}</label>
                <input id="hc-year" type="number" min={1980} max={new Date().getFullYear()} className={field} value={form.diagnosedYear} onChange={(e) => set('diagnosedYear', parseInt(e.target.value) || new Date().getFullYear())} />
              </div>
            </div>

            <div>
              <label className={label} htmlFor="hc-need">{dt('Nevojat kryesore')}</label>
              {needs.length > 0 && (
                <ul className="mb-2 flex flex-wrap gap-1.5">
                  {needs.map((need) => (
                    <li key={need} className="inline-flex items-center gap-1 rounded-full bg-rose-50 py-1 pl-2.5 pr-1.5 text-xs font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                      {need}
                      <button type="button" onClick={() => setNeeds(needs.filter((item) => item !== need))} aria-label={`${dt('Hiq')} ${need}`} className="rounded-full p-0.5 hover:bg-rose-100 dark:hover:bg-rose-900/50"><X className="h-3 w-3" /></button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <input id="hc-need" className={field} value={needDraft} maxLength={120} onChange={(e) => setNeedDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addNeed(needDraft); setNeedDraft(''); } }}
                  placeholder={dt('Shkruaj një nevojë dhe shtyp Enter')} />
                <button type="button" onClick={() => { addNeed(needDraft); setNeedDraft(''); }} className="shrink-0 rounded-xl bg-slate-900 px-3 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900" aria-label={dt('Shto nevojën')}><Plus className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {NEED_SUGGESTIONS[form.category].filter((s) => !needs.includes(s)).map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => addNeed(suggestion)} className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-rose-400 hover:text-rose-700 dark:border-zinc-600 dark:text-slate-300">
                    + {dt(suggestion)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={cn(label, 'flex items-center justify-between')} htmlFor="hc-desc">
                <span>{dt('Përshkrimi i situatës')}</span>
                <span className="font-medium text-slate-400">{form.description.length}/2000</span>
              </label>
              <textarea id="hc-desc" rows={4} maxLength={2000} className={cn(field, 'resize-none')} value={form.description} onChange={(e) => set('description', e.target.value)}
                placeholder={dt('Shpjegoni shkurtimisht gjendjen shëndetësore, barnat që mungojnë në spital apo nevojën për trajtim...')} />
            </div>

            {!form.isAnonymous && canAttach && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span className={label}>{dt('Dokument mjekësor (opsionale)')}</span>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" onChange={onPickDocument} className="hidden" />
                  {form.imageUrl ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-zinc-700 dark:bg-zinc-800">
                      <span className="flex min-w-0 items-center gap-2 text-xs font-bold">
                        {form.documentType === 'pdf' ? <FileText className="h-4 w-4 shrink-0 text-rose-600" /> : <Camera className="h-4 w-4 shrink-0 text-rose-600" />}
                        <span className="truncate">{form.documentName || dt('Dokumenti u ngarkua')}</span>
                      </span>
                      <button type="button" onClick={() => setForm((prev) => ({ ...prev, imageUrl: '', documentName: '' }))} className="text-xs font-bold text-rose-600 hover:underline">{dt('Hiqe')}</button>
                    </div>
                  ) : (
                    <button type="button" disabled={isUploadingDocument} onClick={() => fileRef.current?.click()}
                      className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-300 p-4 text-center hover:border-rose-400 dark:border-zinc-600">
                      <Upload className="h-5 w-5 text-slate-400" aria-hidden="true" />
                      <span className="text-xs font-bold">{isUploadingDocument ? dt('Duke ngarkuar…') : dt('Ngarko epikrizë ose recetë')}</span>
                      <span className="text-xs text-slate-400">{dt('JPG, PNG, WEBP ose PDF · deri 5MB · private')}</span>
                    </button>
                  )}
                </div>
                <div>
                  <label className={label} htmlFor="hc-donate">{dt('Link donacioni (opsionale)')}</label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                    <input id="hc-donate" type="url" className={cn(field, 'pl-9')} value={form.donationUrl} onChange={(e) => set('donationUrl', e.target.value)} placeholder="https://www.gofundme.com/f/…" />
                  </div>
                </div>
              </div>
            )}
            {!form.isAnonymous && !canAttach && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                {dt('Bashkëngjitja e dokumenteve është opsionale dhe kërkon llogari të kyçur. Kërkesën mund ta dërgoni tani pa dokument.')}
              </p>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <h4 className="text-base font-black text-slate-900 dark:text-white">{dt('Rishikoni kërkesën')}</h4>
              <p className="mt-1 text-xs text-slate-500">{dt('Kontrolloni të dhënat para dërgimit. Mund të ktheheni për t’i ndryshuar.')}</p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-700">
              <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/60">
                <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl', cat.tile)}><cat.icon className="h-5 w-5" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-slate-900 dark:text-white">{form.diagnosis || '—'}</p>
                  <p className="text-xs text-slate-500">{dt(cat.name)}</p>
                </div>
                <span className={cn('rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-wider', urg.pill)}>{dt(urg.label)}</span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 p-3 text-xs sm:grid-cols-3">
                {[
                  [dt('Regjistrimi'), form.isAnonymous ? dt('Anonim') : form.fullName || '—'],
                  [dt('Mosha / Gjinia'), `${form.age} · ${form.gender === 'Tjetër' ? dt('Gjini tjetër') : dt(form.gender)}`],
                  [dt('Komuna'), form.municipality + (form.neighborhood && !form.isAnonymous ? ` · ${form.neighborhood}` : '')],
                  [dt('Viti i diagnozës'), String(form.diagnosedYear)],
                  [dt('Dokument'), form.imageUrl ? (form.documentName || dt('Po')) : dt('Jo')],
                  [dt('Nevojat'), needs.length ? needs.join(', ') : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">{k}</dt>
                    <dd className="mt-0.5 truncate font-semibold text-slate-800 dark:text-slate-200" title={v}>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-xs leading-relaxed text-slate-700 dark:border-zinc-700 dark:text-slate-300">
              <input type="checkbox" checked={form.consentToProcessing} onChange={(e) => set('consentToProcessing', e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-rose-600" />
              <span>{dt('Pajtohem që këto të dhëna shëndetësore të përpunohen vetëm për shqyrtimin e kërkesës nga stafi i autorizuar. E kuptoj se kërkesa nuk është publike dhe se kodi shërben për referim gjatë komunikimit me stafin. *')}</span>
            </label>
          </>
        )}

        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{dt(error)}</p>}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 dark:border-zinc-800">
        <button type="button" onClick={step === 0 ? onClose : back} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white">
          {step > 0 && <ArrowLeft className="h-4 w-4" aria-hidden="true" />}{step === 0 ? dt('Anulo') : dt('Prapa')}
        </button>
        <button type="submit" disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-rose-600/20 transition hover:bg-rose-700 active:scale-95 disabled:opacity-50">
          {isLast ? <><Heart className="h-4 w-4" aria-hidden="true" />{isSubmitting ? dt('Duke regjistruar...') : dt('Dërgo në Regjistër')}</> : <>{dt('Vazhdo')}<ArrowRight className="h-4 w-4" aria-hidden="true" /></>}
        </button>
      </div>
    </form>
  );
}
