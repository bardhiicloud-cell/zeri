import { AlertTriangle, Lock, MessageCircleQuestion, MessageSquareReply, StickyNote } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import type { CaseItem, CaseThread } from '../../lib/reportCaseApi';

/**
 * What has been said about this report: the questions to the citizen and their
 * answers, and the staff's internal notes, in the order they happened. Internal
 * entries carry a lock so nobody mistakes them for something the citizen can read.
 */
const META: Record<CaseItem['kind'], { label: string; icon: typeof StickyNote; tone: string }> = {
  info_request: { label: 'Pyetje për qytetarin', icon: MessageCircleQuestion, tone: 'border-sky-200 bg-sky-50 dark:border-sky-500/30 dark:bg-sky-500/10' },
  info_response: { label: 'Përgjigje e qytetarit', icon: MessageSquareReply, tone: 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10' },
  note: { label: 'Shënim i brendshëm', icon: StickyNote, tone: 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-800/60' },
  escalation: { label: 'Eskalim', icon: AlertTriangle, tone: 'border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10' },
  escalation_resolved: { label: 'Eskalimi u mbyll', icon: AlertTriangle, tone: 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-800/60' },
};

const when = (iso: string | null) => (iso && Number.isFinite(Date.parse(iso)) ? new Date(iso).toLocaleString('sq-AL', { dateStyle: 'short', timeStyle: 'short' }) : '');

export default function CaseThreadPanel({ thread }: { thread: CaseThread | null }) {
  if (!thread) return null;
  const nothing = thread.items.length === 0 && !thread.awaitingInfo && !thread.escalated;
  if (nothing) return null;

  return (
    <section className="mt-5 space-y-2" aria-label={dt('Biseda e raportit')}>
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{dt('Biseda e raportit')}</h3>
      {thread.awaitingInfo && (
        <p className="rounded-lg bg-sky-100 px-3 py-2 text-xs font-semibold text-sky-900 dark:bg-sky-500/15 dark:text-sky-200">{dt('Pret përgjigjen e qytetarit. Raporti nuk aprovohet derisa të përgjigjet ose ta vendosni ju.')}</p>
      )}
      {thread.escalated && (
        <p className="rounded-lg bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-900 dark:bg-rose-500/15 dark:text-rose-200">{dt('Ky raportim është i eskaluar te administratori.')}</p>
      )}
      <ol className="space-y-2">
        {thread.items.map(item => {
          const meta = META[item.kind] ?? META.note;
          const Icon = meta.icon;
          return (
            <li key={item.id} className={cn('rounded-lg border p-2.5 text-xs', meta.tone)}>
              <div className="flex flex-wrap items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {dt(meta.label)}
                {item.internal && <span className="inline-flex items-center gap-0.5 rounded bg-slate-900 px-1.5 py-0.5 text-[9px] text-white dark:bg-white dark:text-slate-900"><Lock className="h-2.5 w-2.5" aria-hidden="true" />{dt('vetëm stafi')}</span>}
                <span className="ml-auto font-normal text-slate-400">{item.byLabel} · {when(item.at)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300">{item.text}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
