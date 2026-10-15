import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Cookie, ShieldCheck, X, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { dt } from '@/src/lib/dt';
import {
  announceAgeVerified,
  announceConsentChange,
  CATEGORY_LABELS,
  hasDecided,
  OPTIONAL_CATEGORIES,
  readConsent,
  writeConsent,
  type ConsentCategory,
  type ConsentState,
} from '../lib/consent';

const AGE_VERIFICATION_KEY = 'zeri_age_verified_v1';

/**
 * Cookie consent banner — Law 06/L-082 compliant.
 *
 * The banner is a hard gate, not a decoration: until the citizen answers, the
 * optional categories are false, so Google Analytics is never initialised and
 * NearbyAlerts never asks for geolocation. Rejecting is exactly as easy as
 * accepting, as Article 9 requires.
 */
export default function CookieConsentBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [ageRequired, setAgeRequired] = useState(false);
  const [ageInput, setAgeInput] = useState('');
  const [ageError, setAgeError] = useState('');
  const [isUnderage, setIsUnderage] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Ask age before showing consent. Store only that the threshold was passed,
  // never the entered age or date of birth.
  useEffect(() => {
    if (window.localStorage.getItem(AGE_VERIFICATION_KEY) !== 'passed') {
      setAgeRequired(true);
    } else if (!hasDecided()) {
      setIsOpen(true);
    }
  }, []);

  // Lock body scroll while the banner is up so the page behind it cannot move.
  useEffect(() => {
    if (!isOpen && !ageRequired) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen, ageRequired]);

  const verifyAge = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    const age = Number(ageInput);
    if (!Number.isInteger(age) || age < 1 || age > 120) {
      setAgeError(dt('Shkruani moshën tuaj si numër të plotë.'));
      setIsUnderage(false);
      return;
    }
    if (age < 16) {
      setAgeError('');
      setIsUnderage(true);
      return;
    }

    window.localStorage.setItem(AGE_VERIFICATION_KEY, 'passed');
    announceAgeVerified();
    setAgeRequired(false);
    setIsUnderage(false);
    if (!hasDecided()) setIsOpen(true);
  }, [ageInput]);

  // Escape closes the preferences view but never the banner itself: a dismissal
  // without a decision would leave the visitor in the undecided state.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowPreferences(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const apply = useCallback((next: { analytics: boolean; marketing: boolean }) => {
    setIsSaving(true);
    const saved: ConsentState = writeConsent(next);
    // Announce synchronously so the analytics bootstrap and the geolocation
    // gate react to the new value within the same tick, before any re-render.
    announceConsentChange(saved);
    window.setTimeout(() => {
      setIsSaving(false);
      setIsOpen(false);
    }, 180);
  }, []);

  const acceptAll = useCallback(() => {
    apply({ analytics: true, marketing: true });
  }, [apply]);

  const rejectOptional = useCallback(() => {
    apply({ analytics: false, marketing: false });
  }, [apply]);

  const savePreferences = useCallback(() => {
    apply({ analytics, marketing });
  }, [apply, analytics, marketing]);

  const categoryToggles: { key: ConsentCategory; checked: boolean; onChange: (value: boolean) => void; locked?: boolean }[] = [
    { key: 'essential', checked: true, onChange: () => { }, locked: true },
    { key: 'analytics', checked: analytics, onChange: setAnalytics },
    { key: 'marketing', checked: marketing, onChange: setMarketing },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-consent-title"
          className="fixed inset-0 z-[100000] flex items-end justify-center sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
            className="luxury-card relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900"
          >
            <div className="flex items-start gap-3.5 border-b border-slate-100 p-5 dark:border-white/5 sm:p-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                <Cookie className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2
                  id="cookie-consent-title"
                  className="title-serif text-lg font-black tracking-tight text-slate-900 dark:text-white"
                >
                  {dt('Politika e privatësisë dhe Cookies')}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {dt('Ligji Nr. 06/L-082 për Mbrojtjen e të Dhënave Personale në Kosovë kërkon pëlqimin tuaj të qartë dhe të lirë për çdo Cookies jo-esenciale dhe çdo gjurmim të lokacionit.')}
                </p>
              </div>
              {showPreferences && (
                <button
                  type="button"
                  onClick={() => setShowPreferences(false)}
                  aria-label={dt('Mbyll menunë')}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              {!showPreferences ? (
                <div className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  <p>
                    {dt('Ne përdorim Cookies dhe teknologji të ngjashme për të mbajtur sesionin tuaj, për të matur sa të përdoret platforma dhe për të shfaqur reklama.')} {dt('Pa pëlqimin tuaj, asnjë Cookies analitike apo marketingu nuk ngarkohet.')}
                  </p>
                  <ul className="space-y-1.5">
                    {OPTIONAL_CATEGORIES.map((key) => (
                      <li key={key} className="flex items-start gap-2">
                        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                        <span>
                          <strong className="font-bold text-slate-800 dark:text-white">{CATEGORY_LABELS[key].sq}</strong>
                          {' — '}
                          {CATEGORY_LABELS[key].descriptionSq}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {dt('Mund ta ndryshoni vendimin në çdo kohë nga këtu:')} {''}
                    <button
                      type="button"
                      onClick={() => setShowPreferences(true)}
                      className="font-bold text-blue-700 underline underline-offset-2 dark:text-blue-300"
                    >
                      {dt('Menaxho preferencat')}
                    </button>
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {dt('Aktivizoni ose çaktivizoni secilën kategori. Cookies të domosdoshme nuk mund të çaktivizohen sepse pa to platforma nuk funksionon.')}
                  </p>

                  {categoryToggles.map((toggle) => (
                    <label
                      key={toggle.key}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors',
                        toggle.locked
                          ? 'cursor-not-allowed border-slate-200 bg-slate-50 dark:border-white/5 dark:bg-slate-800/40'
                          : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 dark:border-white/10 dark:hover:border-blue-500/40 dark:hover:bg-slate-800/50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={toggle.checked}
                        disabled={toggle.locked}
                        onChange={(event) => toggle.onChange(event.target.checked)}
                        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-blue-600 disabled:cursor-not-allowed"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-slate-900 dark:text-white">
                          {CATEGORY_LABELS[toggle.key].sq}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          {CATEGORY_LABELS[toggle.key].descriptionSq}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 p-4 dark:border-white/5 sm:flex-row sm:justify-end sm:p-5">
              {showPreferences ? (
                <>
                  <button
                    type="button"
                    onClick={rejectOptional}
                    disabled={isSaving}
                    className="min-h-11 rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {dt('Refuzo jo-esencialet')}
                  </button>
                  <button
                    type="button"
                    onClick={savePreferences}
                    disabled={isSaving}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-900 px-5 py-2.5 text-xs font-black text-white transition-all hover:brightness-110 disabled:opacity-60"
                  >
                    {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    {dt('Ruaj preferencat')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={rejectOptional}
                    disabled={isSaving}
                    className="min-h-11 rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {dt('Refuzo jo-esencialet')}
                  </button>
                  <button
                    type="button"
                    onClick={acceptAll}
                    disabled={isSaving}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-900 px-5 py-2.5 text-xs font-black text-white transition-all hover:brightness-110 disabled:opacity-60"
                  >
                    {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    {dt('Prano të gjitha')}
                  </button>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowPreferences((open) => !open)}
              className="flex items-center justify-center gap-1.5 border-t border-slate-100 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 transition-colors hover:bg-slate-50 dark:border-white/5 dark:hover:bg-slate-800/60"
            >
              {showPreferences ? dt('Kthehu te përmbledhja') : dt('Detajet e cookies')}
              <ChevronDown className={cn('h-3 w-3 transition-transform', showPreferences && 'rotate-180')} aria-hidden="true" />
            </button>
          </motion.div>
        </div>
      )}
      {ageRequired && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="age-verification-title"
          className="fixed inset-0 z-[100001] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
        >
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900 sm:p-8"
          >
            <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-lg font-black text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">16+</div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">{dt('Para vazhdimit')}</p>
            <h2 id="age-verification-title" className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
              {dt('Sa vjeç jeni?')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {dt('Platforma është për persona 16 vjeç e lart. Shkruani moshën tuaj për të vazhduar. Mosha nuk ruhet.')}
            </p>
            <form onSubmit={verifyAge} noValidate className="mt-6 space-y-4">
              <label htmlFor="age-verification-input" className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                {dt('Mosha juaj')}
              </label>
              <input
                id="age-verification-input"
                type="number"
                inputMode="numeric"
                min="1"
                max="120"
                step="1"
                required
                autoFocus
                value={ageInput}
                onChange={event => {
                  setAgeInput(event.target.value);
                  setAgeError('');
                  setIsUnderage(false);
                }}
                placeholder={dt('p.sh. 17')}
                aria-describedby={isUnderage ? 'age-verification-blocked' : ageError ? 'age-verification-error' : undefined}
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-lg font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
              {ageError && <p id="age-verification-error" role="alert" className="text-xs font-semibold text-rose-700 dark:text-rose-300">{ageError}</p>}
              {isUnderage && (
                <p id="age-verification-blocked" role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold leading-relaxed text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
                  {dt('Nuk mund të vazhdoni në platformë nëse jeni nën 16 vjeç.')}
                </p>
              )}
              <button type="submit" className="min-h-12 w-full rounded-xl bg-blue-700 px-4 text-sm font-black text-white transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-500/30">
                {dt('Vazhdo')}
              </button>
            </form>
            <p className="mt-4 text-center text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {dt('Për verifikim ruhet vetëm shenja se mosha minimale është plotësuar; mosha që shkruani nuk regjistrohet.')}
            </p>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * Small re-openable entry point for the footer and the settings screen.
 *
 * A visitor must be able to change their mind at any time — that is a
 * substantive right under Article 9, not a nicety — so this reads the stored
 * state on mount and pre-fills the toggles.
 */
export function CookiePreferencesButton({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const stored = readConsent();
    setAnalytics(stored?.analytics ?? false);
    setMarketing(stored?.marketing ?? false);
  }, []);

  const save = useCallback((next: { analytics: boolean; marketing: boolean }) => {
    setIsSaving(true);
    const state = writeConsent(next);
    announceConsentChange(state);
    window.setTimeout(() => {
      setIsSaving(false);
      setIsOpen(false);
    }, 180);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn('inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400', className)}
      >
        <Cookie className="h-3.5 w-3.5" aria-hidden="true" />
        {dt('Menaxho Cookies')}
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100000] flex items-end justify-center sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cookie-preferences-title"
              className="luxury-card relative w-full max-w-lg overflow-hidden rounded-[26px] border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900 sm:p-6"
            >
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  <Cookie className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3
                  id="cookie-preferences-title"
                  className="title-serif flex-1 text-lg font-black tracking-tight text-slate-900 dark:text-white"
                >
                  {dt('Preferencat tuaja të privatësisë')}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label={dt('Mbyll')}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="flex cursor-not-allowed items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/5 dark:bg-slate-800/40">
                  <input type="checkbox" checked disabled className="mt-0.5 h-5 w-5 shrink-0 accent-blue-600" />
                  <span>
                    <span className="block text-sm font-black text-slate-900 dark:text-white">{CATEGORY_LABELS.essential.sq}</span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{CATEGORY_LABELS.essential.descriptionSq}</span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3.5 transition-colors hover:border-blue-300 dark:border-white/10 dark:hover:border-blue-500/40">
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(event) => setAnalytics(event.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-blue-600"
                  />
                  <span>
                    <span className="block text-sm font-black text-slate-900 dark:text-white">{CATEGORY_LABELS.analytics.sq}</span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{CATEGORY_LABELS.analytics.descriptionSq}</span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3.5 transition-colors hover:border-blue-300 dark:border-white/10 dark:hover:border-blue-500/40">
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(event) => setMarketing(event.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-blue-600"
                  />
                  <span>
                    <span className="block text-sm font-black text-slate-900 dark:text-white">{CATEGORY_LABELS.marketing.sq}</span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{CATEGORY_LABELS.marketing.descriptionSq}</span>
                  </span>
                </label>
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => save({ analytics: false, marketing: false })}
                  disabled={isSaving}
                  className="min-h-11 rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {dt('Refuzo të gjitha')}
                </button>
                <button
                  type="button"
                  onClick={() => save({ analytics, marketing })}
                  disabled={isSaving}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-900 px-5 py-2.5 text-xs font-black text-white transition-all hover:brightness-110 disabled:opacity-60"
                >
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  {dt('Ruaj preferencat')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
