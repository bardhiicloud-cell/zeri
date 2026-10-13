import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock, HelpCircle, Loader2, UserRound } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import { auth } from '../../lib/firebase';
import { nextStep } from '../../lib/reportNextStep';
import { loadMyCase, provideMyInfo, type CaseThread } from '../../lib/reportCaseApi';

/**
 * What the citizen needs to know now, and, if the staff asked them something, the
 * place to answer.
 *
 * "What happens next" is shown to everyone who opens a report. The question and the
 * answer box are shown only to the person who filed it: the server finds the report
 * by the tracking number AND their own account, so for anyone else this card simply
 * shows the next step and nothing more.
 */
export interface CitizenCaseCardProps {
  trackingId: string;
  status: string;
  municipality?: string;
  late?: boolean;
}

const WHO: Record<string, { label: string; icon: typeof Clock }> = {
  citizen: { label: 'Radha juaj', icon: UserRound },
  staff: { label: 'Radha e platformës', icon: Clock },
  municipality: { label: 'Radha e komunës', icon: Clock },
  nobody: { label: 'Përfunduar', icon: CheckCircle2 },
};

export default function CitizenCaseCard({ trackingId, status, municipality, late }: CitizenCaseCardProps) {
  const [thread, setThread] = useState<CaseThread | null>(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    if (!auth.currentUser) { setThread(null); return; }
    try { setThread(await loadMyCase(trackingId)); } catch { setThread(null); }
  };
  useEffect(() => { void reload(); }, [trackingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = nextStep({ status, municipality, late, awaitingInfo: thread?.awaitingInfo === true });
  const who = WHO[step.who] ?? WHO.staff;
  const WhoIcon = who.icon;
  const question = [...(thread?.items ?? [])].reverse().find(item => item.kind === 'info_request');

  const send = async () => {
    setBusy(true);
    try {
      await provideMyInfo(trackingId, answer.trim());
      toast.success(dt('Informacioni u dërgua. Faleminderit.'));
      setAnswer('');
      await reload();
    } catch (error) {
      toast.error((error as Error).message || dt('Informacioni nuk u dërgua.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={cn('rounded-3xl border p-5 sm:p-6', step.who === 'citizen' ? 'border-sky-300 bg-sky-50 dark:border-sky-500/40 dark:bg-sky-500/10' : 'border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900')} aria-label={dt('Çfarë ndodh më pas')}>
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400"><WhoIcon className="h-3.5 w-3.5" aria-hidden="true" />{dt(who.label)} · {dt('Çfarë ndodh më pas')}</p>
      <h3 className="mt-2 font-serif text-xl font-black text-slate-950 dark:text-white">{dt(step.title)}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{dt(step.text)}</p>

      {thread?.awaitingInfo && question && (
        <div className="mt-4 rounded-2xl bg-white p-4 dark:bg-slate-900">
          <p className="flex items-center gap-1.5 text-xs font-bold text-sky-800 dark:text-sky-300"><HelpCircle className="h-4 w-4" aria-hidden="true" />{dt('Pyetja e stafit')}</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">{question.text}</p>
          <label htmlFor="case-answer" className="mt-4 block text-xs font-bold text-slate-600 dark:text-slate-300">{dt('Përgjigjja juaj')}</label>
          <textarea
            id="case-answer"
            value={answer}
            onChange={event => setAnswer(event.target.value)}
            rows={4}
            maxLength={1200}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-white/15 dark:bg-slate-800 dark:text-white"
            placeholder={dt('Shkruani informacionin që u kërkua…')}
          />
          <p className="mt-1 text-[11px] text-slate-400">{dt('Përgjigjen e lexon vetëm stafi. Në historikun publik shfaqet vetëm që keni dhënë informacion.')}</p>
          <button type="button" disabled={busy || answer.trim().length < 5} onClick={() => void send()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-40">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{dt('Dërgo informacionin')}
          </button>
        </div>
      )}
    </section>
  );
}
