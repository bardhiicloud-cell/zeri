import { dt } from '@/src/lib/dt';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, CheckCircle2, Headphones, MessageCircle, Send, X } from 'lucide-react';
import { arrayUnion, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useLocation } from 'react-router-dom';
import { useStore } from '../lib/store';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';
import {
  createAgentTrackId,
  isSupportDepartment,
  normalizeSupportChat,
  SUPPORT_DEPARTMENTS,
  SupportChatRecord,
  SupportChatStatus,
  SupportMessage,
} from '../lib/supportChat';

const GUEST_CHAT_KEY = 'support_chat_guest_id';

type BotReplyContext = {
  canRequestAgent: boolean;
  currentStatus: SupportChatStatus;
};

function createLocalChat(id: string, registered: boolean): SupportChatRecord {
  return {
    id,
    userId: id,
    userName: registered ? 'Qytetar' : 'Vizitor',
    userEmail: '',
    status: 'bot',
    department: 'help',
    messages: [
      {
        id: `${id}-welcome`,
        role: 'bot',
        content: registered
          ? 'Mirë se vini. Unë jam asistenti i platformës. Për pyetje informative mund të vazhdoni këtu; për ndihmë njerëzore shkruani "/agent".'
          : 'Mirë se vini. Mund të bëni pyetje për platformën dhe shërbimet publike. Mbështetja me agjent është e disponueshme vetëm për përdoruesit e regjistruar.',
        createdAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function getBotReply(text: string, context: BotReplyContext): string {
  const value = text.toLocaleLowerCase('sq');
  if (value.includes('/agent') || value.includes('agjent') || value.includes('njeri real') || value.includes('support')) {
    return context.canRequestAgent
      ? 'Kërkesa juaj u regjistrua. Po ju transferojmë te një përfaqësues i Qendrës së Ndihmës. ID-ja e ndjekjes shfaqet në krye të kësaj bisede.'
      : 'Mbështetja me agjent është e disponueshme vetëm për përdoruesit e regjistruar. Ju lutem krijoni një llogari ose hyni në llogarinë tuaj.';
  }
  if (value.includes('track id') || value.includes('ndjek') || value.includes('status')) {
    return 'Për të ndjekur një raportim, përdorni Track ID te faqja përkatëse. Për bisedat me agjent, ID-ja e ndjekjes dhe ID-ja e bisedës ruhen në mënyrë të veçantë.';
  }
  if (value.includes('raport') || value.includes('ankes')) {
    return 'Hapni “Raporto”, përshkruani problemin, vendosni lokacionin dhe dërgoni dëshminë. Pas ruajtjes merrni një Track ID për ndjekje.';
  }
  if (value.includes('harta') || value.includes('komun')) {
    return 'Harta dhe filtrat e raportimeve ju ndihmojnë të gjeni problematikat sipas komunës, kategorisë dhe urgjencës.';
  }
  return context.currentStatus === 'bot'
    ? 'Mund t’ju ndihmoj për raportime, Track ID, hartën, shërbimet dhe lidhjen me një agjent. Për një çështje konkrete, jepni sa më shumë detaje.'
    : 'Mesazhi juaj u dërgua te ekipi i mbështetjes. Një agjent do t’ju përgjigjet në këtë bisedë.';
}

function createMessage(role: SupportMessage['role'], content: string): SupportMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export default function FloatingSupportBot() {
  const { pathname } = useLocation();
  const currentUser = useStore((state) => state.currentUser);
  // Subscribe narrowly. This bot is mounted app-wide, so a whole-store
  // subscription re-rendered it on every unrelated state change; the actions
  // are stable references and only the two flags below are reactive.
  const isBotOpen = useStore((state) => state.isBotOpen);
  const botInitialQuery = useStore((state) => state.botInitialQuery);
  const closeBot = useStore((state) => state.closeBot);
  const openBot = useStore((state) => state.openBot);
  const registered = Boolean(currentUser && currentUser.role !== 'guest');
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [status, setStatus] = useState<SupportChatStatus>('bot');
  const [agentTrackId, setAgentTrackId] = useState<string | null>(null);
  const [department, setDepartment] = useState('help');
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<'conversation' | 'tracking' | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const initialQueryHandled = useRef<string | null>(null);
  /**
   * Guards the one-time creation of the support-chat document. Without it, a
   * denied or failing `setDoc` was retried on every snapshot re-fire, flooding
   * the console and hammering Firestore. Reset whenever the chat identity
   * changes so a genuine new conversation can still initialize.
   */
  const initAttemptedFor = useRef<string | null>(null);

  const defaultDepartment = useMemo(() => SUPPORT_DEPARTMENTS.find((item) => item.id === 'help')!, []);

  useEffect(() => {
    if (registered && currentUser) {
      setChatId(`support-${currentUser.id}`);
      return;
    }

    let guestId = window.localStorage.getItem(GUEST_CHAT_KEY);
    if (!guestId) {
      guestId = `guest-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(GUEST_CHAT_KEY, guestId);
    }
    setChatId(guestId);
  }, [currentUser, registered]);

  useEffect(() => {
    if (!chatId) return;

    const localChat = createLocalChat(chatId, registered);
    setMessages(localChat.messages);
    setStatus(localChat.status);
    setAgentTrackId(null);
    setDepartment('help');
    setError(null);
    setIsReady(!registered);

    if (!registered) return;

    const chatRef = doc(db, 'supportChats', chatId);
    let cancelled = false;
    const unsubscribe = onSnapshot(
      chatRef,
      (snapshot) => {
        if (cancelled) return;
        if (!snapshot.exists()) {
          // Attempt creation once per chat identity. A denied/failing write must
          // not be retried on every snapshot re-fire — that was the retry storm.
          if (initAttemptedFor.current === chatId) return;
          initAttemptedFor.current = chatId;
          setDoc(chatRef, {
            userId: currentUser?.id,
            userName: currentUser?.name || 'Qytetar',
            userEmail: currentUser?.email || '',
            status: 'bot',
            department: 'help',
            messages: localChat.messages,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true }).then(() => setIsReady(true)).catch((reason) => {
            console.error('Support chat initialization failed', reason);
            setError('Biseda nuk mund të inicializohet. Provoni përsëri.');
          });
          return;
        }

        const normalized = normalizeSupportChat(snapshot.id, snapshot.data());
        setMessages(normalized.messages);
        setStatus(normalized.status);
        setAgentTrackId(normalized.agentTrackId || null);
        setDepartment(normalized.department || 'help');
        setIsReady(true);
        setError(null);
      },
      (reason) => {
        console.error('Support chat listener failed', reason);
        setIsReady(false);
        setError('Lidhja me bisedën u ndërpre. Ju lutem provoni përsëri.');
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [chatId, currentUser, registered]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isBotOpen, isTyping]);

  useEffect(() => {
    if (!botInitialQuery || !chatId || !isBotOpen || initialQueryHandled.current === botInitialQuery) return;
    initialQueryHandled.current = botInitialQuery;
    handleSend(botInitialQuery);
    useStore.setState({ botInitialQuery: null });
  }, [botInitialQuery, chatId, isBotOpen]);

  const copyValue = async (value: string, type: 'conversation' | 'tracking') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(type);
      window.setTimeout(() => setCopiedId(null), 1400);
    } catch (reason) {
      console.error('Copy support identifier failed', reason);
    }
  };

  const handleSend = async (text: string) => {
    const clean = text.trim();
    if (!clean || !chatId || !isReady || isTyping || status === 'resolved') return;

    const userMessage = createMessage('user', clean);
    const asksForAgent = /\/agent|agjent|njeri real|support/i.test(clean);
    const chatRef = registered ? doc(db, 'supportChats', chatId) : null;
    const canRequestAgent = Boolean(registered && currentUser);
    const previousStatus = status;

    setInput('');
    setError(null);
    setMessages((previous) => [...previous, userMessage]);

    if (!chatRef) {
      setIsTyping(true);
      window.setTimeout(() => {
        const botMessage = createMessage('bot', getBotReply(clean, { canRequestAgent, currentStatus: previousStatus }));
        setMessages((previous) => [...previous, botMessage]);
        setIsTyping(false);
      }, 450);
      return;
    }

    try {
      if (previousStatus === 'waiting_agent' || previousStatus === 'active_agent') {
        await updateDoc(chatRef, { messages: arrayUnion(userMessage), updatedAt: serverTimestamp() });
        return;
      }

      if (asksForAgent && canRequestAgent) {
        const nextTrackId = agentTrackId || createAgentTrackId();
        const botMessage = createMessage('bot', getBotReply(clean, { canRequestAgent: true, currentStatus: previousStatus }));
        await updateDoc(chatRef, {
          messages: arrayUnion(userMessage, botMessage),
          status: 'waiting_agent',
          agentTrackId: nextTrackId,
          agentRequestedAt: new Date().toISOString(),
          department: isSupportDepartment(department) ? department : defaultDepartment.id,
          assignedTo: null,
          assignedAgentName: null,
          updatedAt: serverTimestamp(),
        });
        setAgentTrackId(nextTrackId);
        setStatus('waiting_agent');
        return;
      }

      await updateDoc(chatRef, { messages: arrayUnion(userMessage), updatedAt: serverTimestamp() });
      setIsTyping(true);
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      const botMessage = createMessage('bot', getBotReply(clean, { canRequestAgent, currentStatus: previousStatus }));
      await updateDoc(chatRef, { messages: arrayUnion(botMessage), updatedAt: serverTimestamp() });
    } catch (reason) {
      console.error('Support chat send failed', reason);
      setMessages((previous) => previous.filter((message) => message.id !== userMessage.id));
      setInput(clean);
      setError('Mesazhi nuk u dërgua. Teksti juaj u ruajt në fushë; provoni përsëri.');
    } finally {
      setIsTyping(false);
    }
  };

  const selectedDepartment = SUPPORT_DEPARTMENTS.find((item) => item.id === department) || defaultDepartment;

  // The public debate is a social app: the round launcher would sit on top of its
  // compose button and its tab bar. Support stays reachable from every other page
  // (and from an already open conversation).
  if (!isBotOpen && /(^|\/)forum(\/|$)/.test(pathname)) return null;

  return (
    <>
      {!isBotOpen && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => openBot()}
          aria-label={dt('Hap mbështetjen')}
          className="mobile-assistant-safe fixed right-4 z-[60] grid h-14 w-14 place-items-center rounded-full bg-(--color-brand-primary) text-white shadow-(--shadow-floating) ring-4 ring-(--color-surface) transition-colors hover:bg-(--color-brand-primary-hover) md:bottom-6 md:right-6"
        >
          <MessageCircle className="h-6 w-6" aria-hidden="true" />
        </motion.button>
      )}

      <AnimatePresence>
        {isBotOpen && (
          <motion.section
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            aria-label={dt('Mbështetja dhe biseda me agjentin')}
            className="fixed inset-0 z-[9999] flex h-[100dvh] w-full flex-col overflow-hidden bg-(--color-page) md:inset-auto md:bottom-6 md:right-6 md:z-[60] md:h-[650px] md:w-[430px] md:rounded-[14px] md:border md:border-(--color-border-soft) md:shadow-(--shadow-floating)"
          >
            <header className="shrink-0 border-b border-white/10 bg-(--color-brand-dark) p-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-white/10"><Bot className="h-5 w-5" aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-black">{dt('Asistenti i Zërit Qytetar')}</h2>
                    <p className="mt-0.5 text-[11px] text-blue-100">{status === 'waiting_agent' ? 'Në pritje të agjentit' : status === 'active_agent' ? 'Në bisedë me agjentin' : status === 'resolved' ? 'Biseda e zgjidhur' : 'Informacion dhe mbështetje'}</p>
                  </div>
                </div>
                <button type="button" onClick={closeBot} className="grid min-h-10 min-w-10 place-items-center rounded-[10px] text-white/75 transition-colors hover:bg-white/10 hover:text-white" aria-label={dt('Mbyll mbështetjen')}><X className="h-5 w-5" aria-hidden="true" /></button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-bold text-blue-100">
                <button type="button" onClick={() => chatId && copyValue(chatId, 'conversation')} className="min-w-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-left transition-colors hover:bg-white/10">
                  <span className="block uppercase tracking-wider text-white/50">{dt('ID i bisedës')}</span>
                  <span className="mt-0.5 block truncate font-mono text-white">{chatId || '—'}</span>
                  <span className="mt-0.5 block text-[9px] text-blue-200">{copiedId === 'conversation' ? 'U kopjua' : 'Kliko për kopjim'}</span>
                </button>
                <button type="button" disabled={!agentTrackId} onClick={() => agentTrackId && copyValue(agentTrackId, 'tracking')} className="min-w-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-left transition-colors hover:bg-white/10 disabled:cursor-default disabled:opacity-60">
                  <span className="block uppercase tracking-wider text-white/50">ID i ndjekjes</span>
                  <span className="mt-0.5 block truncate font-mono text-white">{agentTrackId || 'Pa kërkesë aktive'}</span>
                  <span className="mt-0.5 block text-[9px] text-blue-200">{copiedId === 'tracking' ? 'U kopjua' : selectedDepartment.label}</span>
                </button>
              </div>
            </header>

            {error && <div role="alert" className="shrink-0 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800">{error}</div>}

            <main ref={scrollContainerRef} className="flex-1 space-y-4 overflow-y-auto bg-(--color-surface-subtle) p-4">
              {messages.map((message) => (
                <div key={message.id} className={cn('flex', message.role === 'user' || message.role === 'agent' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[86%] rounded-[10px] px-3.5 py-3 text-sm leading-relaxed', message.role === 'user' ? 'bg-(--color-brand-primary) text-white' : message.role === 'agent' ? 'bg-emerald-600 text-white' : 'border border-(--color-border-soft) bg-(--color-surface) text-slate-700 shadow-(--shadow-control) dark:border-white/10 dark:bg-slate-900 dark:text-slate-200')}>
                    <div className={cn('mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider', message.role === 'user' ? 'text-blue-100' : message.role === 'agent' ? 'text-emerald-100' : 'text-(--color-brand-primary)')}>
                      {message.role === 'agent' ? <Headphones className="h-3 w-3" aria-hidden="true" /> : message.role === 'bot' ? <Bot className="h-3 w-3" aria-hidden="true" /> : null}
                      {message.role === 'agent' ? 'Agjent' : message.role === 'bot' ? 'AI Bot' : 'Ju'}
                    </div>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    <div className={cn('mt-1.5 text-right text-[9px]', message.role === 'user' ? 'text-blue-100' : 'text-slate-400')}>
                      {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              {isTyping && <div className="flex justify-start"><div className="flex items-center gap-1 rounded-[10px] border border-(--color-border-soft) bg-(--color-surface) px-4 py-3 dark:border-white/10 dark:bg-slate-900"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" /></div></div>}
              <div />
            </main>

            {status === 'resolved' ? (
              <div className="shrink-0 border-t border-(--color-border-soft) bg-(--color-surface) p-4 text-center text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400"><CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-emerald-500" aria-hidden="true" />{dt('Kjo bisedë është shënuar si e zgjidhur.')}</div>
            ) : (
              <form onSubmit={(event) => { event.preventDefault(); void handleSend(input); }} className="shrink-0 border-t border-(--color-border-soft) bg-(--color-surface) p-3 dark:border-white/10 dark:bg-slate-900">
                <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400"><span>{status === 'waiting_agent' || status === 'active_agent' ? 'Mesazh për departamentin' : 'Pyetje për asistentin'}</span><span>{registered ? selectedDepartment.label : 'Vetëm informim'}</span></div>
                <div className="flex items-center gap-2">
                  <input type="text" value={input} onChange={(event) => setInput(event.target.value)} disabled={!isReady || isTyping} placeholder={status === 'waiting_agent' || status === 'active_agent' ? 'Shkruani mesazhin...' : 'Bëni një pyetje ose shkruani /agent...'} className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-(--color-border-soft) bg-(--color-surface-subtle) px-3.5 text-sm text-(--color-text) outline-none transition focus:border-(--color-brand-primary) focus:ring-2 focus:ring-(--color-brand-primary)/15 disabled:opacity-60 dark:border-white/10 dark:bg-slate-800 dark:text-white" />
                  <button type="submit" disabled={!input.trim() || !isReady || isTyping} className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-(--color-brand-primary) text-white transition-colors hover:bg-(--color-brand-primary-hover) disabled:cursor-not-allowed disabled:opacity-50" aria-label={dt('Dërgo mesazhin')}><Send className="h-4 w-4" aria-hidden="true" /></button>
                </div>
                {!registered && <p className="mt-2 text-[10px] font-semibold text-slate-500">{dt('Regjistrohuni për të kërkuar një agjent njerëzor.')}</p>}
              </form>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
