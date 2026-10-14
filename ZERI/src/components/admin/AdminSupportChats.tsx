import { dt } from '@/src/lib/dt';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { ArrowLeft, Bot, CheckCircle2, Clipboard, Headphones, Info, MessageSquare, Search, Send, UserRound, X } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { supportDesk } from '../../lib/supportDeskApi';
import { useStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import { STAFF_LIMITS } from '../../lib/loadLimits';
import {
  getSupportSortTime,
  groupSupportMessages,
  normalizeSupportChat,
  SUPPORT_DEPARTMENTS,
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_ORDER,
  SupportChatRecord,
  SupportChatStatus,
} from '../../lib/supportChat';

type QueueFilter = 'all' | SupportChatStatus;

const statusTone: Record<SupportChatStatus, string> = {
  waiting_agent: 'bg-(--color-brand-accent)',
  active_agent: 'bg-emerald-500',
  bot: 'bg-blue-500',
  resolved: 'bg-slate-400',
};

function formatChatTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('sq-AL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}


export default function AdminSupportChats({ openChatId }: { openChatId?: string } = {}) {
  const currentUser = useStore((state) => state.currentUser);
  const [chats, setChats] = useState<SupportChatRecord[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(openChatId ?? null);
  // A link (or the "someone is waiting" card) can open one conversation directly.
  useEffect(() => { if (openChatId) setActiveChatId(openChatId); }, [openChatId]);
  const [queue, setQueue] = useState<QueueFilter>('all');
  const [search, setSearch] = useState('');
  const [input, setInput] = useState('');
  const [department, setDepartment] = useState('help');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<'conversation' | 'tracking' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const myUid = auth.currentUser?.uid || currentUser?.id || '';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const [agents, setAgents] = useState<Array<{ uid: string; name: string }>>([]);
  const [transferTo, setTransferTo] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  /**
   * An administrator sees every conversation. An agent sees two things only: the queue of
   * citizens waiting for someone, and the conversations they accepted. Once a colleague
   * accepts a conversation it disappears from everyone else's screen (firestore.rules
   * enforce the same, so this is not just a hidden row).
   */
  useEffect(() => {
    setIsLoading(true);
    const sources = isAdmin
      ? [query(collection(db, 'supportChats'), orderBy('updatedAt', 'desc'), limit(STAFF_LIMITS.chats))]
      : [
          query(collection(db, 'supportChats'), where('status', '==', 'waiting_agent'), limit(STAFF_LIMITS.chats)),
          query(collection(db, 'supportChats'), where('assignedTo', '==', myUid), limit(STAFF_LIMITS.chats)),
        ];
    const parts = new Map<number, SupportChatRecord[]>();
    const unsubscribes = sources.map((source, index) => onSnapshot(
      source,
      (snapshot) => {
        parts.set(index, snapshot.docs.map((snapshotDoc) => normalizeSupportChat(snapshotDoc.id, snapshotDoc.data())));
        const merged = new Map<string, SupportChatRecord>();
        for (const list of parts.values()) for (const chat of list) merged.set(chat.id, chat);
        setChats([...merged.values()].sort((a, b) => getSupportSortTime(b) - getSupportSortTime(a)));
        setIsLoading(false);
        setError(null);
      },
      (reason) => {
        console.error('Support chat queue failed', reason);
        setIsLoading(false);
        setError('Bisedat nuk mund të ngarkohen. Kontrolloni lejet ose lidhjen dhe provoni përsëri.');
      }
    ));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [isAdmin, myUid]);

  useEffect(() => { supportDesk.agents().then(setAgents).catch(() => setAgents([])); }, []);

  /** Run one desk action with feedback; the listener brings the new state. */
  const runDesk = async (label: string, action: () => Promise<unknown>, success?: string) => {
    setBusyAction(label);
    setError(null);
    try {
      await action();
      if (success) toast.success(success);
      return true;
    } catch (reason) {
      setError((reason as Error).message);
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  const queueCounts = useMemo(() => ({
    all: chats.length,
    waiting_agent: chats.filter((chat) => chat.status === 'waiting_agent').length,
    active_agent: chats.filter((chat) => chat.status === 'active_agent').length,
    bot: chats.filter((chat) => chat.status === 'bot').length,
    resolved: chats.filter((chat) => chat.status === 'resolved').length,
  }), [chats]);

  const visibleChats = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('sq');
    return chats
      .filter((chat) => queue === 'all' || chat.status === queue)
      .filter((chat) => {
        if (!query) return true;
        return [chat.userName, chat.userEmail, chat.id, chat.agentTrackId, chat.department]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase('sq').includes(query));
      })
      .sort((a, b) => {
        const statusPriority = SUPPORT_STATUS_ORDER.indexOf(a.status) - SUPPORT_STATUS_ORDER.indexOf(b.status);
        return statusPriority || getSupportSortTime(b) - getSupportSortTime(a);
      });
  }, [chats, queue, search]);

  useEffect(() => {
    if (activeChatId && !visibleChats.some((chat) => chat.id === activeChatId)) setActiveChatId(null);
  }, [activeChatId, visibleChats]);

  const activeChat = chats.find((chat) => chat.id === activeChatId) || null;

  useEffect(() => {
    setDepartment(activeChat?.department || 'help');
    setInput('');
    setIsDetailsOpen(false);
    setError(null);
  }, [activeChatId, activeChat?.department]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages]);

  const copyIdentifier = async (value: string, type: 'conversation' | 'tracking') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(type);
      window.setTimeout(() => setCopiedId(null), 1400);
    } catch (reason) {
      console.error('Copy chat identifier failed', reason);
    }
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeChat || !input.trim() || activeChat.status === 'resolved' || isSending) return;
    if (!navigator.onLine) {
      setError('Jeni jashtë linje. Përgjigjja nuk u dërgua.');
      return;
    }

    setIsSending(true);
    setError(null);
    try {
      await supportDesk.reply(activeChat.id, input.trim());
      setInput('');
    } catch (reason) {
      console.error('Agent reply failed', reason);
      setError(`${(reason as Error).message} Teksti juaj u ruajt në fushë.`);
    } finally {
      setIsSending(false);
    }
  };

  const handleResolve = async () => {
    if (!activeChat || activeChat.status === 'resolved') return;
    if (!window.confirm('A dëshironi ta shënoni këtë bisedë si të zgjidhur?')) return;
    const othersChat = Boolean(activeChat.assignedTo) && activeChat.assignedTo !== myUid;
    const reason = othersChat ? window.prompt('Kjo bisedë është e një agjenti tjetër. Pse e mbyllni? (të paktën 5 shenja)') ?? '' : '';
    if (othersChat && reason.trim().length < 5) return;
    await runDesk('resolve', () => supportDesk.resolve(activeChat.id, reason || undefined), 'Biseda u mbyll.');
  };

  const handleAccept = async () => {
    if (!activeChat) return;
    await runDesk('accept', () => supportDesk.accept(activeChat.id), 'E pranuat bisedën. Tani është vetëm e juaja.');
  };

  const handleRelease = async () => {
    if (!activeChat) return;
    const othersChat = Boolean(activeChat.assignedTo) && activeChat.assignedTo !== myUid;
    const reason = othersChat ? window.prompt('Pse ia merrni bisedën agjentit? (të paktën 5 shenja)') ?? '' : '';
    if (othersChat && reason.trim().length < 5) return;
    await runDesk('release', () => supportDesk.release(activeChat.id, reason || undefined), 'Biseda u kthye në radhë për një agjent tjetër.');
  };

  const handleTransfer = async (targetUid: string) => {
    if (!activeChat || !targetUid) return;
    const othersChat = Boolean(activeChat.assignedTo) && activeChat.assignedTo !== myUid;
    const reason = othersChat ? window.prompt('Pse e transferoni bisedën e një agjenti tjetër? (të paktën 5 shenja)') ?? '' : '';
    if (othersChat && reason.trim().length < 5) return;
    const ok = await runDesk('transfer', () => supportDesk.transfer(activeChat.id, targetUid, reason || undefined), targetUid === myUid ? 'E morët përsipër bisedën.' : 'Biseda u transferua.');
    if (ok) setTransferTo('');
  };

  const handleDepartmentChange = async (value: string) => {
    if (!activeChat || activeChat.status === 'resolved') return;
    setDepartment(value);
    await runDesk('department', () => supportDesk.department(activeChat.id, value));
  };

  const statusButtons: Array<{ id: QueueFilter; label: string }> = [
    { id: 'all', label: 'Të gjitha' },
    ...SUPPORT_STATUS_ORDER.map((status) => ({ id: status, label: SUPPORT_STATUS_LABELS[status] })),
  ];

  return (
    <div className="mx-auto flex h-[min(calc(100vh-10rem),820px)] min-h-[620px] max-w-[1600px] overflow-hidden rounded-[14px] border border-(--color-border-soft) bg-(--color-surface) shadow-(--shadow-control) dark:border-white/10 dark:bg-slate-900">
      <aside className={cn('w-full shrink-0 flex-col border-r border-(--color-border-soft) bg-(--color-surface) md:w-[280px] dark:border-white/10 dark:bg-slate-900 lg:w-[300px]', activeChatId ? 'hidden md:flex' : 'flex')}>
        <div className="border-b border-(--color-border-soft) p-4 dark:border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-(--color-brand-primary)">{dt('Bisedat e klientëve')}</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-(--color-text) dark:text-white">Qendra e mbështetjes</h2>
            </div>
            <Headphones className="mt-1 h-5 w-5 text-(--color-brand-primary)" aria-hidden="true" />
          </div>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={dt('Kërko bisedë...')} aria-label={dt('Kërko bisedë...')} className="min-h-10 w-full rounded-[10px] border border-(--color-border-soft) bg-(--color-surface-subtle) pl-9 pr-3 text-sm text-(--color-text) outline-none focus:border-(--color-brand-primary) dark:border-white/10 dark:bg-slate-800 dark:text-white" />
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-(--color-border-soft) p-2 dark:border-white/10">
          {statusButtons.map((item) => (
            <button type="button" key={item.id} onClick={() => setQueue(item.id)} aria-pressed={queue === item.id} className={cn('flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-black transition-colors', queue === item.id ? 'bg-(--color-surface-subtle) text-(--color-brand-primary)' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800')}>
              {item.id !== 'all' && <span className={cn('h-1.5 w-1.5 rounded-full', statusTone[item.id])} aria-hidden="true" />}
              <span>{item.label}</span><span className="font-mono text-[9px] text-slate-400">{queueCounts[item.id]}</span>
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="space-y-2 p-2"><div className="h-16 animate-pulse rounded-[10px] bg-slate-100 dark:bg-slate-800" /><div className="h-16 animate-pulse rounded-[10px] bg-slate-100 dark:bg-slate-800" /><div className="h-16 animate-pulse rounded-[10px] bg-slate-100 dark:bg-slate-800" /></div>
          ) : visibleChats.length === 0 ? (
            <div className="p-6 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">{search ? 'Nuk u gjet asnjë bisedë për këtë kërkim.' : 'Nuk ka biseda në këtë radhë.'}</div>
          ) : visibleChats.map((chat) => (
            <button type="button" key={chat.id} onClick={() => { setActiveChatId(chat.id); setIsDetailsOpen(false); }} className={cn('relative mb-1.5 w-full rounded-[10px] border-l-[3px] p-3 text-left transition-colors', activeChatId === chat.id ? 'border-(--color-brand-primary) bg-(--color-surface-subtle)' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800')}>
              <div className="flex items-start justify-between gap-2"><span className="truncate text-sm font-black text-(--color-text) dark:text-white">{chat.userName}</span><span className="shrink-0 text-[10px] font-semibold text-slate-400">{formatChatTime(chat.updatedAt)}</span></div>
              <div className="mt-1 flex items-center gap-1.5"><span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusTone[chat.status])} aria-hidden="true" /><span className="truncate text-[10px] font-bold text-slate-500 dark:text-slate-400">{SUPPORT_STATUS_LABELS[chat.status]}</span></div>
              <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{chat.messages.at(-1)?.content || 'Pa mesazhe'}</p>
              <p className="mt-1 truncate font-mono text-[9px] text-(--color-brand-primary)">{chat.agentTrackId || chat.id}</p>
            </button>
          ))}
        </div>
      </aside>

      <section className={cn('relative min-w-0 flex-1 flex-col bg-(--color-surface-subtle)', activeChatId ? 'flex' : 'hidden', 'md:flex')}>
        {activeChat ? (
          <>
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-(--color-border-soft) bg-(--color-surface) px-4 py-4 dark:border-white/10 dark:bg-slate-900 sm:px-5">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <button type="button" onClick={() => setActiveChatId(null)} className="grid min-h-10 min-w-10 place-items-center rounded-[10px] text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800" aria-label="Kthehu te bisedat"><ArrowLeft className="h-4 w-4" aria-hidden="true" /></button>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-(--color-surface-subtle) text-(--color-brand-primary)"><UserRound className="h-5 w-5" aria-hidden="true" /></div>
                <div className="min-w-0"><h2 className="truncate text-base font-black text-(--color-text) dark:text-white">{activeChat.userName}</h2><p className="truncate text-xs text-slate-500 dark:text-slate-400">{activeChat.userEmail || 'Nuk ka email'} · <span className="font-mono">{activeChat.id}</span></p><p className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-(--color-brand-primary)"><span className={cn('h-1.5 w-1.5 rounded-full', statusTone[activeChat.status])} />{SUPPORT_STATUS_LABELS[activeChat.status]} · {activeChat.agentTrackId || 'Pa ID ndjekjeje'}</p></div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => setIsDetailsOpen((open) => !open)} className="grid min-h-10 min-w-10 place-items-center rounded-[10px] border border-(--color-border-soft) text-slate-500 hover:text-(--color-brand-primary) lg:hidden" aria-label="Hap detajet"><Info className="h-4 w-4" aria-hidden="true" /></button>
                {activeChat.status !== 'resolved' && <button type="button" onClick={handleResolve} className="hidden min-h-10 items-center gap-1.5 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 transition-colors hover:bg-emerald-100 sm:inline-flex"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Shëno të zgjidhur</button>}
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-8">
              <div className="mx-auto max-w-3xl space-y-5">
                {groupSupportMessages(activeChat.messages).map((group, index) => (
                  <div key={`${group.role}-${index}`} className={cn('flex', group.role === 'agent' ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[86%] space-y-1.5', group.role === 'agent' ? 'items-end' : 'items-start')}>
                      <div className={cn('flex items-center gap-1.5 px-1 text-[10px] font-black uppercase tracking-wider', group.role === 'agent' ? 'justify-end text-(--color-brand-primary)' : 'text-slate-500')}>
                        {group.role === 'agent' ? <Headphones className="h-3 w-3" aria-hidden="true" /> : group.role === 'bot' ? <Bot className="h-3 w-3" aria-hidden="true" /> : <UserRound className="h-3 w-3" aria-hidden="true" />}
                        {group.role === 'agent' ? (activeChat.assignedAgentName || 'Agjent') : group.role === 'bot' ? 'AI Bot' : activeChat.userName}
                      </div>
                      {group.messages.map((message) => <div key={message.id} className={cn('rounded-[10px] px-4 py-3 text-sm leading-relaxed', group.role === 'agent' ? 'bg-(--color-brand-primary) text-white' : group.role === 'bot' ? 'border border-(--color-border-soft) bg-(--color-surface) text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200' : 'bg-white text-slate-800 shadow-(--shadow-control) dark:bg-slate-800 dark:text-slate-100')}>{message.content}</div>)}
                      <div className={cn('px-1 text-[10px] text-slate-400', group.role === 'agent' ? 'text-right' : 'text-left')}>{formatChatTime(group.messages.at(-1)?.createdAt)}</div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {activeChat.status === 'waiting_agent' ? (
              <div className="shrink-0 border-t border-(--color-border-soft) bg-amber-50 p-4 dark:border-white/10 dark:bg-amber-500/10">
                <p className="text-sm font-bold text-amber-900 dark:text-amber-200">{dt('Qytetari po pret një agjent.')} {activeChat.agentRequestedAt ? `${dt('Kërkuar më')} ${formatChatTime(activeChat.agentRequestedAt)}.` : ''}</p>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">{dt('Kur e pranoni, biseda bëhet vetëm e juaja dhe zhduket nga radha e agjentëve të tjerë.')}</p>
                {error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
                <button type="button" onClick={() => void handleAccept()} disabled={busyAction !== null} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />{busyAction === 'accept' ? dt('Duke pranuar…') : dt('Prano bisedën')}</button>
              </div>
            ) : activeChat.status === 'active_agent' && activeChat.assignedTo && activeChat.assignedTo !== myUid ? (
              <div className="shrink-0 border-t border-(--color-border-soft) bg-(--color-surface) p-4 text-sm dark:border-white/10 dark:bg-slate-900">
                <p className="font-semibold text-slate-600 dark:text-slate-300">{dt('Këtë bisedë e ka pranuar')} <strong>{activeChat.assignedAgentName || dt('një agjent tjetër')}</strong>.</p>
                {isAdmin && <button type="button" onClick={() => void handleTransfer(myUid)} disabled={busyAction !== null} className="mt-2 inline-flex min-h-10 items-center rounded-[10px] border border-(--color-border-soft) px-4 text-xs font-black text-(--color-brand-primary) disabled:opacity-50">{dt('Merre përsipër (me arsye)')}</button>}
                {error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
              </div>
            ) : activeChat.status === 'bot' ? (
              <div className="shrink-0 border-t border-(--color-border-soft) bg-(--color-surface) p-4 text-center text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400">{dt('Qytetari po flet me asistentin automatik dhe nuk ka kërkuar agjent.')}</div>
            ) : activeChat.status === 'resolved' ? <div className="shrink-0 border-t border-(--color-border-soft) bg-(--color-surface) p-4 text-center text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400">Kjo bisedë është shënuar e zgjidhur. Nuk mund të dërgoni më mesazhe.</div> : <form onSubmit={handleSend} className="shrink-0 border-t border-(--color-border-soft) bg-(--color-surface) p-4 dark:border-white/10 dark:bg-slate-900"><label htmlFor="support-agent-reply" className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Përgjigjja juaj</label><div className="flex gap-2"><input id="support-agent-reply" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Shkruaj përgjigjen si agjent..." disabled={isSending} className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-(--color-border-soft) bg-(--color-surface-subtle) px-3.5 text-sm text-(--color-text) outline-none focus:border-(--color-brand-primary) dark:border-white/10 dark:bg-slate-800 dark:text-white" /><button type="submit" disabled={!input.trim() || isSending} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-(--color-brand-primary) px-4 text-xs font-black text-white transition-colors hover:bg-(--color-brand-primary-hover) disabled:cursor-not-allowed disabled:opacity-50">{isSending ? 'Duke dërguar...' : 'Dërgo përgjigjen'}<Send className="h-4 w-4" aria-hidden="true" /></button></div>{error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}</form>}
          </>
        ) : <div className="flex flex-1 items-center justify-center p-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400"><MessageSquare className="mb-3 h-8 w-8 text-slate-300" aria-hidden="true" /><p>Zgjidhni një bisedë nga lista.</p></div>}
      </section>

      {activeChat && <aside className={cn('w-[240px] shrink-0 border-l border-(--color-border-soft) bg-(--color-surface) p-4 dark:border-white/10 dark:bg-slate-900', isDetailsOpen ? 'fixed inset-y-0 right-0 z-[120] block shadow-(--shadow-floating) lg:static lg:shadow-none' : 'hidden lg:block')}>
        <div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Detajet</p><button type="button" onClick={() => setIsDetailsOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800" aria-label="Mbyll detajet"><X className="h-4 w-4" aria-hidden="true" /></button></div>
        <div className="mt-5 space-y-5 text-sm">
          <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Statusi</p><p className="mt-1 flex items-center gap-2 font-bold text-(--color-text) dark:text-white"><span className={cn('h-2 w-2 rounded-full', statusTone[activeChat.status])} />{SUPPORT_STATUS_LABELS[activeChat.status]}</p></div>
          <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{dt('Agjenti')}</p><p className="mt-1 font-bold text-(--color-text) dark:text-white">{activeChat.assignedTo ? (activeChat.assignedTo === myUid ? dt('Ju') : activeChat.assignedAgentName || dt('Agjent tjetër')) : dt('Askush ende')}</p></div>
          {activeChat.status === 'active_agent' && (activeChat.assignedTo === myUid || isAdmin) && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{dt('Kalimi i bisedës')}</p>
              <select value={transferTo} onChange={(event) => setTransferTo(event.target.value)} aria-label={dt('Transfero te')} className="min-h-10 w-full rounded-lg border border-(--color-border-soft) bg-(--color-surface-subtle) px-2 text-xs font-bold dark:border-white/10 dark:bg-slate-800 dark:text-white">
                <option value="">{dt('Transfero te…')}</option>
                {agents.map((agent) => <option key={agent.uid} value={agent.uid}>{agent.name || agent.uid}</option>)}
              </select>
              <button type="button" disabled={!transferTo || busyAction !== null} onClick={() => void handleTransfer(transferTo)} className="min-h-9 w-full rounded-lg border border-(--color-border-soft) text-xs font-black text-(--color-brand-primary) disabled:opacity-40">{dt('Transfero')}</button>
              <button type="button" disabled={busyAction !== null} onClick={() => void handleRelease()} className="min-h-9 w-full rounded-lg border border-(--color-border-soft) text-xs font-black text-slate-600 disabled:opacity-40 dark:text-slate-300">{dt('Ktheje në radhë')}</button>
            </div>
          )}
          <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Departamenti</p><select value={department} onChange={(event) => void handleDepartmentChange(event.target.value)} disabled={activeChat.status === 'resolved'} className="mt-1 min-h-10 w-full rounded-lg border border-(--color-border-soft) bg-(--color-surface-subtle) px-2 text-xs font-bold text-(--color-text) outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white">{SUPPORT_DEPARTMENTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
          <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">ID i bisedës</p><button type="button" onClick={() => void copyIdentifier(activeChat.id, 'conversation')} className="mt-1 flex w-full items-center gap-2 break-all text-left font-mono text-xs font-bold text-(--color-brand-primary)"><Clipboard className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{copiedId === 'conversation' ? 'U kopjua' : activeChat.id}</button></div>
          <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">ID i ndjekjes</p><button type="button" disabled={!activeChat.agentTrackId} onClick={() => activeChat.agentTrackId && void copyIdentifier(activeChat.agentTrackId, 'tracking')} className="mt-1 flex w-full items-center gap-2 break-all text-left font-mono text-xs font-bold text-(--color-brand-primary) disabled:text-slate-400"><Clipboard className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{copiedId === 'tracking' ? 'U kopjua' : activeChat.agentTrackId || 'Pa kërkesë aktive'}</button></div>
          <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Përdoruesi</p><p className="mt-1 font-bold text-(--color-text) dark:text-white">{activeChat.userName}</p><p className="break-all text-xs text-slate-500">{activeChat.userEmail || 'Nuk ka email'}</p></div>
          <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Përditësuar</p><p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{formatChatTime(activeChat.updatedAt)}</p></div>
          {activeChat.status !== 'resolved' && <button type="button" onClick={handleResolve} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 sm:hidden"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Shëno të zgjidhur</button>}
        </div>
      </aside>}
    </div>
  );
}
