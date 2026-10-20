import { useMemo, useState } from 'react';
import { BadgeCheck, CalendarPlus, Mail, Phone, ShieldOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { dt } from '@/src/lib/dt';
import { cn } from '../../lib/utils';
import {
  adRequests,
  formatWhen,
  setAdRequestStatus,
  verifiedAccounts,
  verifiedAction,
  type AdRequestRow,
} from '../../lib/debateApi';
import { Badge, Empty, ErrorNote, Panel, Spinner, btn, inputClass, useLoad } from './ui';
import { askConfirm } from '../../lib/dialogs';

const AD_STATUSES: ReadonlyArray<{ id: AdRequestRow['status']; label: string; tone: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' }> = [
  { id: 'pending', label: 'Në pritje', tone: 'amber' },
  { id: 'contacted', label: 'Të kontaktuar', tone: 'blue' },
  { id: 'approved', label: 'Të aprovuar', tone: 'emerald' },
  { id: 'active', label: 'Aktive', tone: 'emerald' },
  { id: 'completed', label: 'Të përfunduara', tone: 'slate' },
  { id: 'rejected', label: 'Të refuzuara', tone: 'rose' },
];

/** Requests made through "Kërko Reklamë" and the ad packages, with their payment state. */
export function DebateAds() {
  const { data, error, loading, reload } = useLoad(adRequests, []);
  const [filter, setFilter] = useState<AdRequestRow['status'] | 'all'>('all');
  const [busy, setBusy] = useState('');

  const items = useMemo(() => (data?.items ?? []).filter((i) => filter === 'all' || i.status === filter), [data, filter]);
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of data?.items ?? []) map[item.status] = (map[item.status] ?? 0) + 1;
    return map;
  }, [data]);

  const change = async (id: string, status: AdRequestRow['status']) => {
    setBusy(id);
    try {
      await setAdRequestStatus(id, status);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')} className={cn('min-h-9 rounded-full border px-3.5 text-xs font-bold', filter === 'all' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-700 dark:border-white/15 dark:text-slate-200')}>
            {dt('Të gjitha')} ({data?.items.length ?? 0})
          </button>
          {AD_STATUSES.map((s) => (
            <button key={s.id} type="button" aria-pressed={filter === s.id} onClick={() => setFilter(s.id)} className={cn('min-h-9 rounded-full border px-3.5 text-xs font-bold', filter === s.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-700 dark:border-white/15 dark:text-slate-200')}>
              {dt(s.label)} ({counts[s.id] ?? 0})
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {dt('Reklamat e postimeve (Promovo) menaxhohen te “Postimet”. Këtu janë kërkesat e biznesve për reklamim.')}
        </p>
      </Panel>

      <ErrorNote message={error} />
      {loading && !data ? <Panel><Spinner /></Panel> : items.length === 0 ? (
        <Panel><Empty>{dt('Asnjë kërkesë reklame.')}</Empty></Panel>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const meta = AD_STATUSES.find((s) => s.id === item.status)!;
            return (
              <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-black text-slate-900 dark:text-white">{item.businessName || item.name || '—'}</p>
                    <p className="text-xs text-slate-500">{formatWhen(item.createdAtMs)}{item.packageName ? ` · ${item.packageName}` : ''}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={meta.tone}>{dt(meta.label)}</Badge>
                    <Badge tone={item.paymentStatus === 'paid' ? 'emerald' : 'slate'}>{item.paymentStatus === 'paid' ? `${dt('Paguar')} ${item.paymentCode}` : dt('Pa pagesë')}</Badge>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700 dark:text-slate-200">
                  {item.phone && <a href={`tel:${item.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1.5 hover:underline"><Phone className="h-3.5 w-3.5" aria-hidden="true" />{item.phone}</a>}
                  {item.email && <a href={`mailto:${item.email}`} className="inline-flex items-center gap-1.5 hover:underline"><Mail className="h-3.5 w-3.5" aria-hidden="true" />{item.email}</a>}
                </div>
                {item.notes && <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">{item.notes}</p>}
                <div className="mt-3 flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300" htmlFor={`st-${item.id}`}>{dt('Statusi')}</label>
                  <select id={`st-${item.id}`} value={item.status} disabled={busy === item.id} onChange={(e) => void change(item.id, e.target.value as AdRequestRow['status'])} className={cn(inputClass, 'max-w-48')}>
                    {AD_STATUSES.map((s) => <option key={s.id} value={s.id}>{dt(s.label)}</option>)}
                  </select>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Accounts with an active tick: extend by a month or revoke. */
export function DebateTicks() {
  const { data, error, loading, reload } = useLoad(verifiedAccounts, []);
  const [busy, setBusy] = useState('');

  const act = async (uid: string, action: 'extend' | 'revoke') => {
    if (action === 'revoke' && !await askConfirm(dt('Hiqni tickun e kësaj llogarie?'))) return;
    setBusy(uid);
    try {
      await verifiedAction(uid, action);
      toast.success(action === 'extend' ? dt('Ticku u zgjat me 30 ditë.') : dt('Ticku u hoq.'));
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const items = data?.items ?? [];
  return (
    <Panel>
      <h3 className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-white">
        <BadgeCheck className="h-5 w-5 fill-blue-500 text-white" aria-hidden="true" />
        {dt('Llogaritë me tick')} ({items.length})
      </h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{dt('Ticku aktivizohet vetë kur konfirmohet pagesa dhe skadon pas 30 ditësh.')}</p>
      <div className="mt-3"><ErrorNote message={error} /></div>
      {loading && !data ? <div className="py-6 text-center"><Spinner /></div> : items.length === 0 ? <Empty>{dt('Asnjë llogari e verifikuar.')}</Empty> : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
          {items.map((item) => {
            const expired = item.untilMs !== null && item.untilMs < Date.now();
            return (
              <li key={item.uid} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900 dark:text-white">{item.name || item.uid}</p>
                  <p className="text-xs text-slate-500">
                    {item.untilMs ? `${expired ? dt('Skaduar më') : dt('Deri më')} ${new Date(item.untilMs).toLocaleDateString('sq-AL')}` : dt('Pa datë skadimi')}
                    {expired && <Badge tone="amber">{dt('skaduar')}</Badge>}
                  </p>
                </div>
                <button type="button" disabled={busy === item.uid} onClick={() => void act(item.uid, 'extend')} className={cn(btn.ghost, 'min-h-9 px-3 text-xs')}><CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />{dt('+30 ditë')}</button>
                <button type="button" disabled={busy === item.uid} onClick={() => void act(item.uid, 'revoke')} className={cn(btn.ghost, 'min-h-9 px-3 text-xs text-rose-700 dark:text-rose-300')}><ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />{dt('Hiq')}</button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
