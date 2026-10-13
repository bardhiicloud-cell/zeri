import { useMemo, useState } from 'react';
import { AtSign, Bell, CheckCheck, Heart, MessageCircle, Quote, Repeat2, UserPlus } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { sq } from 'date-fns/locale';
import { dt } from '@/src/lib/dt';
import { db } from '../../lib/firebase';
import { useStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import type { AppNotification } from '../../types';

/** Notification categories written by the debate, mapped to an icon and a tab. */
const KIND: Record<string, { icon: typeof Bell; tone: string; mention?: boolean }> = {
  forum_like: { icon: Heart, tone: 'text-rose-500 bg-rose-50 dark:bg-rose-950/30' },
  forum_repost: { icon: Repeat2, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  forum_quote: { icon: Quote, tone: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30' },
  forum_reply: { icon: MessageCircle, tone: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
  forum_mention: { icon: AtSign, tone: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30', mention: true },
  forum_follow: { icon: UserPlus, tone: 'text-sky-600 bg-sky-50 dark:bg-sky-950/30' },
  forum_dm: { icon: MessageCircle, tone: 'text-slate-600 bg-slate-100 dark:bg-zinc-800' },
};

type Tab = 'all' | 'mentions';

export function isForumNotification(n: AppNotification, userId?: string): boolean {
  const channel = (n as { channel?: string }).channel;
  return (channel === 'forum' || channel === 'forum_dm') && (!userId || n.userId === userId);
}

/** X-style notifications: "All" and "Mentions", newest first, with unread state. */
export function ForumNotificationsView({ onOpenMessages }: { onOpenMessages: () => void }) {
  const currentUser = useStore((s) => s.currentUser);
  const notifications = useStore((s) => s.notifications);
  const markRead = useStore((s) => s.markNotificationAsRead);
  const [tab, setTab] = useState<Tab>('all');
  const signedIn = Boolean(currentUser && currentUser.role !== 'guest');

  const mine = useMemo(
    () =>
      notifications
        .filter((n) => isForumNotification(n, currentUser?.id))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [notifications, currentUser?.id]
  );
  const visible = tab === 'mentions' ? mine.filter((n) => KIND[(n as any).category]?.mention) : mine;
  const unread = mine.filter((n) => !n.isRead);

  const persistRead = (n: AppNotification) => {
    if (n.isRead) return;
    markRead(n.id);
    updateDoc(doc(db, 'notifications', n.id), { isRead: true }).catch(() => {});
  };

  return (
    <section aria-label={dt('Njoftimet')} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 pt-3 dark:border-zinc-800">
        <h2 className="pb-2 text-lg font-black text-slate-900 dark:text-white">{dt('Njoftimet')}</h2>
        {unread.length > 0 && (
          <button type="button" onClick={() => unread.forEach(persistRead)} className="mb-2 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-zinc-800">
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            {dt('Shëno si të lexuara')}
          </button>
        )}
      </div>

      <div role="tablist" className="grid grid-cols-2 border-b border-slate-100 text-center text-sm font-bold dark:border-zinc-800">
        {([
          { id: 'all', label: 'Të gjitha' },
          { id: 'mentions', label: 'Përmendjet' },
        ] as const).map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={cn('relative min-h-11', tab === item.id ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800')}>
            {dt(item.label)}
            {tab === item.id && <span className="absolute inset-x-1/4 bottom-0 h-1 rounded-full bg-blue-500" />}
          </button>
        ))}
      </div>

      {!signedIn ? (
        <p className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">{dt('Hyni në llogari për të parë njoftimet e debatit.')}</p>
      ) : visible.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <Bell className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-xl font-black text-slate-900 dark:text-white">{tab === 'mentions' ? dt('Asnjë përmendje ende') : dt('Asgjë për të parë ende')}</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
            {dt('Pëlqimet, përgjigjet, ripostimet dhe përmendjet e tua shfaqen këtu.')}
          </p>
        </div>
      ) : (
        <ul>
          {visible.map((n) => {
            const kind = KIND[(n as any).category] ?? { icon: Bell, tone: 'text-slate-600 bg-slate-100 dark:bg-zinc-800' };
            const Icon = kind.icon;
            const body = (
              <>
                <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', kind.tone)}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900 dark:text-white">{n.title}</span>
                  {n.message && <span className="mt-0.5 line-clamp-2 block text-sm text-slate-600 dark:text-slate-300">{n.message}</span>}
                  <span className="mt-1 block text-[11px] text-slate-400">
                    {formatDistanceToNow(new Date(n.createdAt), { locale: sq, addSuffix: true })}
                  </span>
                </span>
                {!n.isRead && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" aria-label={dt('E palexuar')} />}
              </>
            );
            return (
              <li key={n.id} className="border-b border-slate-100 last:border-0 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    persistRead(n);
                    if ((n as any).channel === 'forum_dm') onOpenMessages();
                  }}
                  className={cn('flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-zinc-800/60', !n.isRead && 'bg-blue-50/40 dark:bg-blue-950/10')}
                >
                  {body}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
