import { dt } from '@/src/lib/dt';
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useStore } from '../../lib/store';
import { CONSENT_STORAGE_KEY } from '../../lib/consent';
import { Plus, Share, SquarePlus, X, Check } from 'lucide-react';

/**
 * "Add to home screen" invitation.
 *
 * Mobile only, never on first contact, never again for two weeks after a "not
 * now", never once the app already runs installed. Two paths:
 *
 *  - Chromium (Android): the browser's own `beforeinstallprompt` is held back
 *    and fired from our button, so the native dialog appears at a moment the
 *    citizen chose.
 *  - iOS Safari has no install API, so the sheet teaches the three taps instead,
 *    with the Share icon pulsing on step one.
 *
 * The mini-phone at the top is the explanation: the app icon drops onto a
 * home screen, a ring pulses, a "+" lands on it. Reduced-motion users get the
 * finished still frame.
 */

const STORAGE_KEY = 'zeri-install-prompt';
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
const VISITS_BEFORE_PROMPT = 2;
const MIN_DWELL_MS = 20_000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface Stored {
  visits: number;
  snoozedUntil: number;
  installed: boolean;
}

function readStored(): Stored {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      visits: Number(raw.visits) || 0,
      snoozedUntil: Number(raw.snoozedUntil) || 0,
      installed: raw.installed === true,
    };
  } catch {
    return { visits: 0, snoozedUntil: 0, installed: false };
  }
}

function writeStored(patch: Partial<Stored>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStored(), ...patch }));
  } catch {
    /* private mode: the prompt just falls back to once per page load */
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

/** In-app browsers (Facebook, Instagram, TikTok…) cannot install anything. */
function isInAppBrowser(): boolean {
  return /FBAN|FBAV|Instagram|Line\/|TikTok|Snapchat|; wv\)/i.test(navigator.userAgent);
}

function PhoneDemo({ still }: { still: boolean }) {
  const tiles = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#fb923c', '#38bdf8'];
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto h-[118px] w-[92px] shrink-0 overflow-hidden rounded-[18px] border-2 border-slate-300 bg-gradient-to-b from-sky-100 to-indigo-100 p-2 shadow-inner dark:border-slate-600 dark:from-slate-800 dark:to-slate-900"
    >
      <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-slate-300 dark:bg-slate-600" />
      <div className="grid grid-cols-3 gap-x-1.5 gap-y-2">
        {tiles.map((c, i) => (
          <span key={i} className="mx-auto block h-[18px] w-[18px] rounded-[5px]" style={{ background: c, opacity: 0.55 }} />
        ))}
        <span className="relative mx-auto block h-[18px] w-[18px]">
          {!still && (
            <motion.span
              className="absolute -inset-1.5 rounded-[9px] border-2 border-blue-500"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 0.9, 0], scale: [0.6, 1.5, 1.7] }}
              transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.2, delay: 1 }}
            />
          )}
          <motion.img
            src="/icon-192.png"
            alt=""
            className="relative block h-[18px] w-[18px] rounded-[5px] shadow-md"
            initial={still ? false : { y: -70, scale: 2.2, opacity: 0, rotate: -12 }}
            animate={{ y: 0, scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.5 }}
          />
          <motion.span
            className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white shadow"
            initial={still ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 1.1 }}
          >
            <Plus className="h-2.5 w-2.5" strokeWidth={4} />
          </motion.span>
        </span>
      </div>
    </div>
  );
}

export function InstallPrompt() {
  const reduceMotion = useReducedMotion() ?? false;
  const locationAnswered = useStore((state) => state.hasChosenMunicipality);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [eligible, setEligible] = useState(false);
  const [open, setOpen] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);
  const [done, setDone] = useState(false);

  const ios = typeof navigator !== 'undefined' && isIos();
  const inApp = typeof navigator !== 'undefined' && isInAppBrowser();

  // Count the visit once per page load, and decide whether this device qualifies.
  useEffect(() => {
    if (isStandalone()) return;
    const isPhone = window.matchMedia('(max-width: 767px)').matches && window.matchMedia('(pointer: coarse)').matches;
    const stored = readStored();
    writeStored({ visits: stored.visits + 1 });
    if (!isPhone || stored.installed || stored.snoozedUntil > Date.now()) return;
    setEligible(stored.visits + 1 >= VISITS_BEFORE_PROMPT);
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      writeStored({ installed: true });
      setDeferred(null);
      setDone(true);
      setOpen(true);
      window.setTimeout(() => setOpen(false), 2600);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Open after the visitor has actually spent time here, and only if we can really help install.
  const canInstall = Boolean(deferred) || ios;
  useEffect(() => {
    if (!eligible || !canInstall || done || !locationAnswered) return;
    // Never stack on top of the age gate, cookie consent or location prompt: wait until both are answered.
    const start = Date.now();
    const id = window.setInterval(() => {
      if (Date.now() - start < MIN_DWELL_MS) return;
      let gatesDone = false;
      try {
        gatesDone =
          localStorage.getItem('zeri_age_verified_v1') === 'passed' &&
          localStorage.getItem(CONSENT_STORAGE_KEY) !== null;
      } catch { /* storage blocked: stay quiet */ }
      if (gatesDone) { window.clearInterval(id); setOpen(true); }
    }, 2000);
    return () => window.clearInterval(id);
  }, [eligible, canInstall, done, locationAnswered]);

  const snooze = useCallback(() => {
    writeStored({ snoozedUntil: Date.now() + SNOOZE_MS });
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') snooze(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, snooze]);

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice.outcome === 'dismissed') snooze();
      else setOpen(false);
      return;
    }
    setShowIosSteps(true);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-label={dt('Shto Zërin në ekranin kryesor')}
          className="fixed inset-x-3 z-[9990] md:hidden"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 92px)' }}
          initial={reduceMotion ? { opacity: 0 } : { y: 140, opacity: 0 }}
          animate={reduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { y: 140, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        >
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
            <button
              type="button"
              onClick={snooze}
              aria-label={dt('Mbyll')}
              className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {done ? (
              <div className="flex items-center gap-3 py-2 pr-8" role="status">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-6 w-6" /></span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{dt('Zëri u shtua në ekranin tuaj kryesor.')}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 pr-8">
                  <PhoneDemo still={reduceMotion} />
                  <div className="min-w-0">
                    <p className="text-base font-extrabold leading-tight text-slate-900 dark:text-white">{dt('Zëri në ekranin tuaj kryesor')}</p>
                    <p className="mt-1 text-[13px] leading-snug text-slate-600 dark:text-slate-300">
                      {dt('Hape me një prekje, raporto më shpejt dhe ndiq Track ID pa e kërkuar faqen çdo herë.')}
                    </p>
                  </div>
                </div>

                {showIosSteps || (ios && !deferred) ? (
                  <ol className="mt-3 space-y-2 text-[13px] text-slate-700 dark:text-slate-200">
                    {inApp && (
                      <li className="rounded-xl bg-amber-50 p-2 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                        {dt('Ky shfletues nuk e lejon instalimin. Hape faqen në Safari ose Chrome.')}
                      </li>
                    )}
                    <li className="flex items-center gap-2">
                      <motion.span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white"
                        animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      >
                        <Share className="h-4 w-4" />
                      </motion.span>
                      <span>{dt('1. Prek butonin Ndaj (Share) në shiritin e Safarit.')}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white"><SquarePlus className="h-4 w-4" /></span>
                      <span>{dt('2. Zgjidh “Shto në ekranin kryesor”.')}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white"><Check className="h-4 w-4" /></span>
                      <span>{dt('3. Prek “Shto” — gati.')}</span>
                    </li>
                  </ol>
                ) : null}

                <div className="mt-3 flex gap-2">
                  {!(ios && !deferred) && (
                    <button
                      type="button"
                      onClick={install}
                      className="min-h-[44px] flex-1 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-lg shadow-blue-600/30 active:scale-[0.98]"
                    >
                      {dt('Shto tani')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={snooze}
                    className="min-h-[44px] flex-1 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {dt('Jo tani')}
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
