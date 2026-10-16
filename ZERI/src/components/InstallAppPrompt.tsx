import { useEffect, useState } from 'react';
import { Download, Share, X, PlusSquare } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { useInstallApp } from '@/src/lib/useInstallApp';
import { BrandMark } from '@/src/components/BrandLogo';

function IosSteps() {
  return (
    <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
      <li className="flex items-center gap-2"><Share className="h-4 w-4 shrink-0 text-blue-600 dark:text-cyan-300" aria-hidden="true" />{dt('Shtyp butonin Ndaj (Share) poshtë në Safari')}</li>
      <li className="flex items-center gap-2"><PlusSquare className="h-4 w-4 shrink-0 text-blue-600 dark:text-cyan-300" aria-hidden="true" />{dt('Zgjidh “Shto në ekranin kryesor” (Add to Home Screen)')}</li>
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
 * One-time, dismissible offer on phones. Shown a little after arrival so it never covers the first screen,
 * and not again for two weeks once dismissed.
 */
export function InstallAppBanner() {
  const { canPrompt, needsManual, recentlyDismissed, install, dismiss } = useInstallApp();
  const [ready, setReady] = useState(false);
  const [steps, setSteps] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 25_000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!ready || recentlyDismissed || (!canPrompt && !needsManual)) return null;

  return (
    <div
      role="dialog"
      aria-label={dt('Instalo aplikacionin')}
      className="fixed inset-x-3 bottom-24 z-[60] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_18px_50px_-18px_rgba(2,6,23,0.55)] dark:border-white/10 dark:bg-slate-900 md:hidden"
    >
      <div className="flex items-start gap-3">
        <BrandMark className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900 dark:text-white">{dt('Zëri Qytetarëve si aplikacion')}</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">{dt('Hape nga ekrani kryesor, pa shiritin e shfletuesit.')}</p>
          {needsManual && steps && <IosSteps />}
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => (canPrompt ? void install().then(dismiss) : setSteps(true))}
              className="min-h-9 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-3.5 text-xs font-extrabold text-white"
            >
              {canPrompt ? dt('Instalo') : dt('Si ta shtoj?')}
            </button>
            <button type="button" onClick={dismiss} className="min-h-9 rounded-lg px-3 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
              {dt('Jo tani')}
            </button>
          </div>
        </div>
        <button type="button" onClick={dismiss} aria-label={dt('Mbyll')} className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
