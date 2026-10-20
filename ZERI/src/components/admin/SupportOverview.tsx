import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock, Headphones, Loader2, MessagesSquare, Trash2, UserCheck, Users } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import { useStore } from '../../lib/store';
import { supportDesk, type SupportOverview as Overview } from '../../lib/supportDeskApi';
import { askConfirm } from '../../lib/dialogs';

const ROLE_LABEL: Record<string, string> = { agent: 'Agjent', responder: 'Përgjegjës', dispatcher: 'Menaxher', approver: 'Zyrtar aprovimi', admin: 'Admin', superadmin: 'Superadmin' };

/**
 * The head of the support center: how many citizens wait and for how long, how fast the team answers,
 * and who has access to conversations right now — with how many each holds and whether they are free.
 * A new request goes to every agent listed here; the first FREE one to accept takes it.
 */
export default function SupportOverview() {
  const role = useStore(s => s.currentUser?.role);
  const isOwner = role === 'admin' || role === 'superadmin';
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await supportDesk.overview()); setError(''); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const clear = async () => {
    if (!await askConfirm(dt('Të fshihen përgjithmonë të gjitha bisedat e mbyllura (me historikun e tyre)? Bisedat e hapura nuk preken.'))) return;
    setClearing(true);
    try {
      const removed = await supportDesk.clearResolved();
      toast.success(`${removed} ${dt('biseda të mbyllura u pastruan.')}`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setClearing(false);
    }
  };

  const stat = (icon: typeof Clock, label: string, value: string, tone = '') => {
    const Icon = icon;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500"><Icon className="h-3.5 w-3.5" aria-hidden="true" />{dt(label)}</p>
        <p className={cn('mt-1 text-2xl font-black tabular-nums text-slate-900 dark:text-white', tone)}>{value}</p>
      </div>
    );
  };

  return (
    <section className="mx-auto mb-4 max-w-[1600px] space-y-3" aria-label={dt('Pamja e qendrës së mbështetjes')}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-white"><Headphones className="h-5 w-5" aria-hidden="true" />{dt('Qendra e mbështetjes')}</h1>
          <p className="text-xs text-slate-500">{dt('Kur një qytetar kërkon agjent, e marrin vesh të gjithë agjentët me qasje. E para që e pranon (dhe është e lirë) e merr bisedën; pastaj është vetëm e saj.')}</p>
        </div>
        {isOwner && (
          <button type="button" onClick={() => void clear()} disabled={clearing} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-300 px-3.5 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/40 dark:text-rose-300">
            {clearing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}{dt('Pastro bisedat e mbyllura')}
          </button>
        )}
      </header>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {stat(MessagesSquare, 'Në pritje', String(data.waiting), data.waiting > 0 ? 'text-amber-600' : '')}
            {stat(Clock, 'Pret më gjatë', data.waiting ? `${data.oldestWaitingMin} min` : '—', data.oldestWaitingMin >= 10 ? 'text-rose-600' : '')}
            {stat(UserCheck, 'Aktive tani', String(data.active))}
            {stat(Clock, 'Përgjigja e parë (mes.)', data.avgFirstResponseMin === null ? '—' : `${data.avgFirstResponseMin} min`)}
            {stat(Users, 'Të mbyllura sot', String(data.resolvedToday))}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
            <h2 className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">{dt('Agjentët me qasje në komunikim')} ({data.agents.length})</h2>
            {data.agents.length === 0 ? <p className="text-sm text-rose-600">{dt('Askush nuk ka qasje në mbështetje. Jepini rolin agjent një personi te Agjentët.')}</p> : (
              <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                {data.agents.map(a => (
                  <li key={a.uid} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-white/5">
                    <span className="min-w-0"><span className="block truncate font-semibold text-slate-900 dark:text-white">{a.name}</span><span className="text-[11px] text-slate-500">{dt(ROLE_LABEL[a.role] ?? a.role)}</span></span>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', a.free ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300')}>
                      {a.free ? dt('I lirë') : dt('I zënë')} · {a.load}/{data.maxActivePerAgent}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
