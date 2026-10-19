import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileText, HelpCircle, Map as MapIcon, Newspaper, Search, X, type LucideIcon } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { BrandMark } from '@/src/components/BrandLogo';

const SEEN_KEY = 'zeri:tour:v1';
/** Anything can re-open the tour with window.dispatchEvent(new Event('zeri:open-tour')). */
export const OPEN_TOUR_EVENT = 'zeri:open-tour';

interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
  /** Page the step's button opens; the last step has none. */
  to?: string;
  action?: string;
}

const STEPS: Step[] = [
  {
    icon: FileText,
    title: 'Raporto një problem',
    body: 'Gropa, ndriçim, mbeturina? Shkruaj çfarë po shikon, shto foto dhe vendndodhjen. Merr një Track ID.',
    to: '/raporto',
    action: 'Hape Raporto',
  },
  {
    icon: Search,
    title: 'Ndiq raportin tënd',
    body: 'Me Track ID shikon në çdo kohë se kush e ka marrë raportin dhe çfarë po bëhet me të.',
    to: '/trackid',
    action: 'Hape Gjurmimin',
  },
  {
    icon: MapIcon,
    title: 'Shiko hartën',
    body: 'Çfarë po raportohet pranë teje dhe në komunën tënde, në një hartë.',
    to: '/harta',
    action: 'Hape Hartën',
  },
  {
    icon: Newspaper,
    title: 'Lajme dhe sondazhe',
    body: 'Njoftime zyrtare nga komunat dhe sondazhe ku mund të japësh mendimin tënd.',
    to: '/lajme',
    action: 'Hape Lajmet',
  },
];

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Private mode: the prompt may reappear next visit, which is harmless.
  }
}

function alreadySeen() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

/**
 * First-visit helper. Asks once whether the visitor wants a short tour; "no" is remembered and the
 * tour stays reachable from the help page (or by dispatching OPEN_TOUR_EVENT).
 */
export function WelcomeTour() {
  const navigate = useNavigate();
  // 'ask' = the yes/no question, number = the step being shown, null = closed.
  const [stage, setStage] = useState<'ask' | number | null>(null);

  useEffect(() => {
    if (alreadySeen()) return;
    const timer = window.setTimeout(() => setStage('ask'), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const open = () => setStage(0);
    window.addEventListener(OPEN_TOUR_EVENT, open);
    return () => window.removeEventListener(OPEN_TOUR_EVENT, open);
  }, []);

  const close = useCallback(() => {
    markSeen();
    setStage(null);
  }, []);

  useEffect(() => {
    if (stage === null) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, close]);

  if (stage === null) return null;

  const step = typeof stage === 'number' ? STEPS[stage] : null;
  const last = typeof stage === 'number' && stage === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-slate-950/50 p-3 sm:items-center" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={dt('Mirë se vini në Zëri')}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
      >
        <div className="flex items-start gap-3">
          {step ? (
            <step.icon className="mt-0.5 h-10 w-10 shrink-0 rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-white/10 dark:text-cyan-300" aria-hidden="true" />
          ) : (
            <BrandMark className="h-10 w-10 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              {step ? dt(step.title) : dt('Mirë se vini në Zëri')}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {step ? dt(step.body) : dt('A keni nevojë për ndihmë? Ju tregojmë në 4 hapa të shkurtër çfarë mund të bëni këtu.')}
            </p>
          </div>
          <button type="button" onClick={close} aria-label={dt('Mbyll')} className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {step?.to && (
          <button
            type="button"
            onClick={() => {
              close();
              navigate(step.to!);
            }}
            className="mt-3 min-h-9 rounded-lg border border-blue-200 px-3 text-xs font-bold text-blue-700 hover:bg-blue-50 dark:border-cyan-300/30 dark:text-cyan-300 dark:hover:bg-white/5"
          >
            {dt(step.action ?? 'Hap')}
          </button>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          {stage === 'ask' ? (
            <>
              <button type="button" onClick={close} className="min-h-10 rounded-lg px-3 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
                {dt('Jo, faleminderit')}
              </button>
              <button type="button" onClick={() => setStage(0)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-extrabold text-white">
                <HelpCircle className="h-4 w-4" aria-hidden="true" />
                {dt('Po, më trego')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStage((s) => (typeof s === 'number' && s > 0 ? s - 1 : 'ask'))}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                {dt('Prapa')}
              </button>
              <span className="text-xs font-semibold text-slate-500" aria-live="polite">
                {(stage as number) + 1} / {STEPS.length}
              </span>
              <button
                type="button"
                onClick={() => (last ? close() : setStage((stage as number) + 1))}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-extrabold text-white"
              >
                {last ? dt('Mbaro') : dt('Vazhdo')}
                {!last && <ChevronRight className="h-4 w-4" aria-hidden="true" />}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
