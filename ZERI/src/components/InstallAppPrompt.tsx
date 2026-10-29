import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Download, Share, X, PlusSquare } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { useInstallApp } from '@/src/lib/useInstallApp';
import { BrandMark } from '@/src/components/BrandLogo';

function IosSteps() {
  return (
    <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
      <li className="flex items-center gap-2"><Share className="h-4 w-4 shrink-0 text-blue-600 dark:text-cyan-300" aria-hidden="true" />{dt('Shtyp butonin Ndaj (Share) në shfletues')}</li>
      <li className="flex items-center gap-2"><PlusSquare className="h-4 w-4 shrink-0 text-blue-600 dark:text-cyan-300" aria-hidden="true" />{dt('Zgjidh “Shto në ekranin kryesor” (Add to Home Screen), pastaj Shto')}</li>
    </ol>
  );
}

/** Footer button: installs where the browser allows it, shows the Add-to-Home-Screen steps on iPhone/iPad. */
export function InstallAppButton() {
  const { canPrompt, needsManual, install } = useInstallApp();
  const [showSteps, setShowSteps] = useState(false);
  if (!canPrompt && !needsManual) return null;
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => (canPrompt ? void install() : setShowSteps((v) => !v))}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {dt('Instalo aplikacionin')}
      </button>
      {needsManual && showSteps && <IosSteps />}
    </div>
  );
}

/**
 * Asked exactly once, ever (see mayOffer); the footer button remains for anyone who wants it later.
 * Automatic install on phones. On iPhone/iPad (where the OS forbids any automatic install) a sheet opens by itself, sooner for returning visitors and later for first-timers, installs by itself on Android (the first tap opens the system dialog, no banner), and on iPhone/iPad points at the Share
 * button. Once shown it never returns on its own, and neither does it after an install.
 */
export function InstallAppBanner() {
  const { canPrompt, needsManual, inAppBrowser, platform, shouldOffer: mayOfferNow, returning, install, markOffered } = useInstallApp();
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  // Decided once, on arrival: recording the offer must not close the sheet that is showing it.
  const shouldOffer = useRef(mayOfferNow).current;

  // One deliberate, delayed offer on phones. Desktop users keep the footer install control.
  const eligible = shouldOffer && (canPrompt || needsManual || inAppBrowser);

  useEffect(() => {
    if (!eligible) return undefined;
    const timer = window.setTimeout(() => setReady(true), returning ? 6_000 : 20_000);
    return () => window.clearTimeout(timer);
  }, [eligible, returning]);

  useEffect(() => {
    if (!ready) return undefined;
    markOffered();
    const frame = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [ready, markOffered]);

  if (!ready || !eligible) return null;

  const close = () => {
    setVisible(false);
    window.setTimeout(() => setReady(false), 250);
  };

  return (
    <div
      role="dialog"
      aria-label={dt('Instalo aplikacionin')}
      style={{ paddingBottom: 'max(0.875rem, env(safe-area-inset-bottom))' }}
      className={`fixed inset-x-0 bottom-0 z-[60] rounded-t-3xl border-t border-slate-200 bg-white px-4 pt-4 shadow-[0_-18px_50px_-18px_rgba(2,6,23,0.55)] transition-transform duration-300 ease-out dark:border-white/10 dark:bg-slate-900 md:hidden ${visible ? 'translate-y-0' : 'translate-y-full'}`}
    >
      <div className="mx-auto max-w-md">
        <div className="flex items-start gap-3">
          <BrandMark className="h-12 w-12 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-900 dark:text-white">{dt('Zëri Qytetarëve si aplikacion')}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {inAppBrowser
                ? dt('Hape këtë faqe në Safari ose Chrome për ta shtuar në ekranin kryesor.')
                : dt('Hape nga ekrani kryesor, pa shiritin e shfletuesit, me njoftime dhe më shpejt.')}
            </p>
          </div>
          <button type="button" onClick={close} aria-label={dt('Mbyll')} className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {needsManual && <IosSteps />}

        {!inAppBrowser && (
          <div className="mt-3 flex items-center gap-2">
            {canPrompt && (
              <button
                type="button"
                onClick={() => { markOffered(); void install(); close(); }}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-extrabold text-white"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {dt('Instalo aplikacionin')}
              </button>
            )}
            {needsManual && (
              <button
                type="button"
                onClick={() => {
                  // iOS has no direct "Add to Home Screen" API; the share sheet is the closest we can open for them.
                  if (typeof navigator.share === 'function') {
                    void navigator.share({ title: document.title, url: window.location.origin + '/?source=pwa' }).catch(() => undefined);
                  }
                }}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-extrabold text-white"
              >
                <Share className="h-4 w-4" aria-hidden="true" />
                {dt('Hap menynë Ndaj')}
              </button>
            )}
            <button type="button" onClick={close} className="min-h-11 rounded-xl px-4 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
              {dt('Jo tani')}
            </button>
          </div>
        )}

        {/* Safari puts Share in the bottom bar on iPhone: point straight at it. */}
        {platform === 'ios-safari' && (
          <div className="mt-2 flex justify-center text-blue-600 dark:text-cyan-300" aria-hidden="true">
            <ArrowDown className="h-5 w-5 animate-bounce" />
          </div>
        )}
      </div>
    </div>
  );
}
