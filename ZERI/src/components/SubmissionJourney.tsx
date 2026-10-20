import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Mail } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { BrandMark } from './BrandLogo';

/**
 * Waiting screen for a submission: the Zëri mark turns into a message, travels to the
 * institution and the bar fills to 100%. While the request is in flight the bar eases
 * toward 92% (it never claims more than is known); `done` completes it to 100%.
 */
export default function SubmissionJourney({ done = false, stage = '', institution }: { done?: boolean; stage?: string; institution?: string }) {
  const [pct, setPct] = useState(4);

  useEffect(() => {
    if (done) { setPct(100); return; }
    const timer = window.setInterval(() => {
      setPct(p => (p >= 92 ? p : p + Math.max(0.4, (92 - p) * 0.045)));
    }, 140);
    return () => window.clearInterval(timer);
  }, [done]);

  const value = Math.round(pct);
  // 0-33 the logo, 33-66 the message on its way, 66+ arriving at the institution.
  const phase = done ? 3 : value < 34 ? 0 : value < 67 ? 1 : 2;
  const travel = Math.min(100, pct);

  return (
    <div className="relative z-10 w-full max-w-md" role="status" aria-live="polite">
      <div className="relative mx-auto h-28 w-full">
        <div className="absolute left-6 right-6 top-1/2 h-0.5 -translate-y-1/2 rounded bg-slate-200 dark:bg-white/10" />
        <div className="absolute left-6 top-1/2 h-0.5 -translate-y-1/2 rounded bg-gradient-to-r from-blue-500 to-emerald-500 transition-[width] duration-300" style={{ width: `calc((100% - 3rem) * ${travel / 100})` }} />
        <div className="absolute left-0 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-2xl bg-white shadow-md dark:bg-slate-800">
          <BrandMark className="h-9 w-9" />
        </div>
        <div className={`absolute right-0 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-2xl shadow-md transition-colors duration-500 ${done ? 'bg-emerald-500 text-white' : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200'}`}>
          {done ? <CheckCircle2 className="h-7 w-7" aria-hidden="true" /> : <Building2 className="h-7 w-7" aria-hidden="true" />}
        </div>
        {!done && (
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-300" style={{ left: `calc(1.75rem + (100% - 3.5rem) * ${travel / 100})` }}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg transition-colors duration-500 motion-safe:animate-bounce ${phase === 0 ? 'bg-transparent shadow-none' : 'bg-blue-600'}`}>
              {phase === 0
                ? <BrandMark className="h-9 w-9 motion-safe:animate-pulse" />
                : <Mail className="h-5 w-5" aria-hidden="true" />}
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 transition-[width] duration-300" style={{ width: `${value}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs font-black text-slate-600 dark:text-slate-300">
        <span>{done ? dt('U dërgua te institucioni') : phase === 0 ? dt('Po përgatitet raporti') : phase === 1 ? dt('Mesazhi është nisur') : dt('Po arrin te institucioni')}{institution ? ` · ${institution}` : ''}</span>
        <span className="tabular-nums">{value}%</span>
      </div>
      {stage && !done && <p className="mt-3 text-xs font-bold text-indigo-700 dark:text-indigo-300">{stage}</p>}
    </div>
  );
}
