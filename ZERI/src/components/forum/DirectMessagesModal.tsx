import React, { useState, useEffect, useRef } from 'react';
import { Bell, BellOff, Flag, Trash2 } from 'lucide-react';
import { ReportTargetSheet } from './ReportTargetSheet';
import { dt } from '@/src/lib/dt';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Send, Search, Image as ImageIcon, MessageSquare, User, ArrowLeft, Loader2, Sparkles, ShieldCheck, Ban, Check, Clock
} from 'lucide-react';
import {
  collection, query, where, orderBy, onSnapshot, doc, getDoc, limit
} from 'firebase/firestore';
import { db, uploadFileToStorage } from '../../lib/firebase';
import { useStore } from '../../lib/store';
import toast from 'react-hot-toast';
import {
  DmApiError, blockUser, composerState, setConversationPrefsApi, markDmRead, respondToDmRequest, sendDm, setDmPrivacy, unblockUser,
  viewOfConversation, type DmPrivacy,
} from '../../lib/directMessagesApi';
import { askConfirm, askReason } from '../../lib/dialogs';

interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  imageUrl?: string;
  createdAt: any;
}

interface Conversation {
  id: string;
  participants: string[];
  participantData: Record<string, { name: string; avatar?: string; role?: string }>;
  lastMessage: string;
  lastMessageAt: any;
  unreadCount?: Record<string, number>;
  /** Server-owned: 'active' (or absent on old threads), 'request' or 'declined'. */
  status?: string;
  requestedBy?: string;
  requestMessages?: number;
  mutedBy?: string[];
  hiddenBy?: string[];
}

interface DirectMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser?: { id: string; name: string; avatar?: string } | null;
}

export function DirectMessagesModal({
  isOpen,
  onClose,
  targetUser = null,
}: DirectMessagesModalProps) {
  const currentUser = useStore(state => state.currentUser);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingConv, setLoadingConv] = useState(true);
  const [listTab, setListTab] = useState<'inbox' | 'requests'>('inbox');
  // People I have blocked (live, small: only my own block documents).
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [privacy, setPrivacy] = useState<DmPrivacy>('everyone');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [reportUserId, setReportUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper to generate consistent conversation ID for 2 users
  const getConversationId = (uid1: string, uid2: string) => {
    return [uid1, uid2].sort().join('_');
  };

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle targetUser selection when modal opens
  useEffect(() => {
    if (!isOpen || !currentUser || !targetUser || targetUser.id === currentUser.id) return;

    // Opening a profile only selects the thread. The conversation document is
    // created by the server with the first message, after block / privacy checks.
    setActiveConvId(getConversationId(currentUser.id, targetUser.id));
  }, [isOpen, targetUser, currentUser]);

  // My blocks: a small live query on my own block documents.
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    return onSnapshot(
      query(collection(db, 'forum_blocks'), where('blockerId', '==', currentUser.id)),
      (snap) => setBlockedIds(new Set(snap.docs.map((d) => String(d.data().blockedId)))),
      () => setBlockedIds(new Set()),
    );
  }, [isOpen, currentUser?.id]);

  // My DM privacy setting (absent = everyone).
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    getDoc(doc(db, 'forum_dm_settings', currentUser.id))
      .then((snap) => setPrivacy(snap.data()?.privacy === 'following' ? 'following' : 'everyone'))
      .catch(() => setPrivacy('everyone'));
  }, [isOpen, currentUser?.id]);

  // Listen to user's conversations
  useEffect(() => {
    if (!isOpen || !currentUser) return;

    setLoadingConv(true);
    const q = query(
      collection(db, 'forum_conversations'),
      where('participants', 'array-contains', currentUser.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convs: Conversation[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Conversation));

      // Sort by lastMessageAt descending
      convs.sort((a, b) => {
        const tA = a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : 0;
        const tB = b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : 0;
        return tB - tA;
      });

      setConversations(convs);
      setLoadingConv(false);

      // If no active conv and convs exist, pick first
      if (!activeConvId && convs.length > 0 && !targetUser) {
        setActiveConvId(convs[0].id);
      }
    }, (err) => {
      console.error('Error fetching conversations:', err);
      setLoadingConv(false);
    });

    return () => unsubscribe();
  }, [isOpen, currentUser]);

  // Listen to messages of active conversation. A thread that does not exist yet
  // has nothing to listen to (and the rules would refuse a read of a missing parent).
  const activeConvExists = conversations.some((c) => c.id === activeConvId);
  useEffect(() => {
    if (!isOpen || !activeConvId || !activeConvExists) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'forum_conversations', activeConvId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: DirectMessage[] = snapshot.docs.map(doc => ({
        id: doc.id,
        conversationId: activeConvId,
        ...doc.data()
      } as DirectMessage));
      setMessages(msgs);
    }, (err) => {
      console.error('Error listening to messages:', err);
    });

    return () => unsubscribe();
  }, [isOpen, activeConvId, activeConvExists]);

  // Having the thread open is the read receipt: ask the server to clear my counter
  // whenever it is above zero (also when a new message arrives while it is open).
  const openUnread = Number(conversations.find((c) => c.id === activeConvId)?.unreadCount?.[currentUser?.id || '']) || 0;
  useEffect(() => {
    if (!isOpen || !activeConvId || openUnread === 0) return;
    const conv = conversations.find((c) => c.id === activeConvId);
    // An unanswered request stays unread until the person accepts or declines it.
    if (conv && currentUser && viewOfConversation(conv, currentUser.id) === 'incoming_request') return;
    markDmRead(activeConvId).catch((err) => console.warn('Leximi nuk u shënua:', err));
  }, [isOpen, activeConvId, openUnread]);

  // Send a new message. The server decides (blocks, privacy, request or inbox),
  // writes the thread and notifies the recipient; the live listeners show the result.
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessageText.trim() && !selectedImage) || !currentUser || !activeConvId || isSending) return;
    const receiverId = activeConvId.split('_').find((id) => id !== currentUser.id);
    if (!receiverId) return;

    setIsSending(true);
    try {
      let imageUrl = '';
      if (selectedImage) {
        imageUrl = await uploadFileToStorage(selectedImage, 'forum_dms');
      }
      const result = await sendDm(receiverId, newMessageText.trim(), imageUrl);
      setNewMessageText('');
      setSelectedImage(null);
      if (result.status === 'request') {
        toast.success(dt('Kërkesa u dërgua. Mesazhi do të shfaqet te ata si kërkesë derisa ta pranojnë.'));
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error(err instanceof DmApiError ? err.message : dt('Nuk u dërgua mesazhi. Provo përsëri.'));
    } finally {
      setIsSending(false);
    }
  };

  /** Runs a server action with one-at-a-time busy state. Resolves true on success. */
  const runAction = async (key: string, action: () => Promise<unknown>, success?: string): Promise<boolean> => {
    if (busyAction) return false;
    setBusyAction(key);
    try {
      await action();
      if (success) toast.success(success);
      return true;
    } catch (err) {
      console.error('Veprimi dështoi:', err);
      toast.error(err instanceof DmApiError ? err.message : dt('Veprimi dështoi. Provo përsëri.'));
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  const respondTo = (convId: string, action: 'accept' | 'decline') =>
    runAction(`respond:${action}`, async () => {
      await respondToDmRequest(convId, action);
      if (action === 'decline') setActiveConvId(null);
      else setListTab('inbox');
    }, action === 'accept' ? dt('Kërkesa u pranua.') : dt('Kërkesa u refuzua.'));

  const toggleBlock = async (userId: string, name: string, block: boolean) => {
    if (block && !await askConfirm(`${dt('Të bllokohet')} ${name}? ${dt('Nuk do të mund t’ju shkruajë dhe ndjekja mes jush hiqet.')}`)) return;
    return runAction('block', () => (block ? blockUser(userId) : unblockUser(userId)),
      block ? dt('Përdoruesi u bllokua.') : dt('Përdoruesi u zhbllokua.'));
  };

  const toggleMute = (convId: string, muted: boolean) =>
    runAction('mute', () => setConversationPrefsApi(convId, { muted }),
      muted ? dt('Njoftimet e kësaj bisede u heshtën.') : dt('Njoftimet u rivendosën.'));

  const deleteConversation = async (convId: string) => {
    if (!await askConfirm(dt('Ta heq këtë bisedë nga lista jote? Personi tjetër e ruan atë, dhe ajo kthehet nëse shkruani përsëri.'))) return;
    void runAction('hide', async () => { await setConversationPrefsApi(convId, { hidden: true }); setActiveConvId(null); }, dt('Biseda u hoq nga lista.'));
  };

  const changePrivacy = (next: DmPrivacy) => {
    const previous = privacy;
    setPrivacy(next);
    void runAction('privacy', () => setDmPrivacy(next), dt('Privatësia u ruajt.')).then((ok) => { if (!ok) setPrivacy(previous); });
  };

  if (!isOpen) return null;

  const me = currentUser?.id || '';
  const activeConv = conversations.find(c => c.id === activeConvId);
  const otherUserKey = activeConv
    ? activeConv.participants.find(p => p !== currentUser?.id)
    : activeConvId?.split('_').find(p => p !== currentUser?.id);
  // A thread that does not exist yet (first message from a profile) uses the profile
  // that opened it; the server creates the document with the first message.
  const otherUserData = activeConv
    ? (otherUserKey ? activeConv.participantData?.[otherUserKey] : null)
    : (targetUser && otherUserKey === targetUser.id ? { name: targetUser.name || 'Përdorues', avatar: targetUser.avatar || '' } : null);
  const blockedByMe = !!otherUserKey && blockedIds.has(otherUserKey);
  const composer = composerState(activeConv ?? null, me, blockedByMe);
  const activeView = activeConv ? viewOfConversation(activeConv, me) : 'inbox';

  const inboxConvs = conversations.filter(c => {
    const v = viewOfConversation(c, me);
    return v === 'inbox' || v === 'outgoing_request';
  });
  const requestConvs = conversations.filter(c => viewOfConversation(c, me) === 'incoming_request');
  const inboxUnread = inboxConvs.reduce((sum, c) => sum + (Number(c.unreadCount?.[me]) || 0), 0);
  const shownConvs = listTab === 'requests' ? requestConvs : inboxConvs;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 md:backdrop-blur-sm p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-gradient-to-br from-slate-900 via-slate-950 to-black border border-white/10 w-full sm:max-w-5xl lg:max-w-7xl h-[100dvh] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0 sm:h-[85vh] md:h-[88vh] sm:rounded-3xl rounded-none flex flex-col overflow-hidden shadow-2xl"
        >
          {/* Compact header — below lg only; on desktop the nav column owns the title and close. */}
          <div className="lg:hidden p-3 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-400" aria-hidden="true" />
              {dt('Mesazhet Private')}
            </h3>
            <button
              onClick={onClose}
              aria-label={dt('Mbyll')}
              className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Body Grid: nav | conversations | chat */}
          <div className="flex-1 flex overflow-hidden">
            {/* Column 1 (desktop): who I am + the two inbox views + privacy. */}
            <aside aria-label={dt('Mesazhet Private')} className="hidden lg:flex w-60 shrink-0 flex-col border-r border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2 pb-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-black text-white ring-2 ring-white/10">
                    {currentUser?.name?.[0]?.toUpperCase() || 'Q'}
                    {currentUser?.avatar && (
                      <img loading="lazy" decoding="async" src={currentUser.avatar} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} className="absolute inset-0 h-full w-full object-cover" />
                    )}
                  </div>
                  <span className="truncate text-sm font-bold text-white">{currentUser?.name || dt('Mesazhet Private')}</span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={dt('Mbyll')}
                  className="shrink-0 rounded-xl bg-white/5 p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="flex flex-col gap-1">
                {([
                  { id: 'inbox', label: dt('Bisedat'), icon: MessageSquare, count: inboxUnread },
                  { id: 'requests', label: dt('Kërkesat'), icon: User, count: requestConvs.length },
                ] as const).map(({ id, label, icon: Icon, count }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setListTab(id)}
                    aria-current={listTab === id ? 'page' : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition-colors ${
                      listTab === id ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1 text-left">{label}</span>
                    {count > 0 && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black text-white">{count}</span>}
                  </button>
                ))}
              </nav>
              <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-100">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                  {dt('Kush mund të më shkruajë')}
                </div>
                <div role="radiogroup" aria-label={dt('Kush mund të më shkruajë')} className="grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1">
                  {([
                    { id: 'everyone', label: dt('Të gjithë') },
                    { id: 'following', label: dt('Ndjekjet') },
                  ] as const).map((o) => (
                    <button key={o.id} type="button" role="radio" aria-checked={privacy === o.id}
                      disabled={busyAction === 'privacy'} onClick={() => changePrivacy(o.id)}
                      className={`rounded-lg py-1.5 text-xs font-bold transition-colors ${privacy === o.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-snug text-slate-400">
                  {privacy === 'everyone' ? dt('Të panjohurit shkojnë te Kërkesat.') : dt('Vetëm njerëzit që ndiqni.')}
                </p>
              </div>
            </aside>

            {/* Column 2: conversations list */}
            <div className={`w-full md:w-72 lg:w-80 border-r border-white/10 bg-black/10 flex-col shrink-0 ${activeConvId ? 'hidden md:flex' : 'flex'}`}>
              {/* Mobile: back to list from an open thread */}
              {activeConvId && (
                <button
                  onClick={() => setActiveConvId(null)}
                  className="md:hidden flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-slate-300 hover:text-white border-b border-slate-800"
                >
                  <ArrowLeft className="w-4 h-4" /> Të gjitha bisedat
                </button>
              )}
              <div role="tablist" aria-label={dt('Llojet e bisedave')} className="lg:hidden grid grid-cols-2 border-b border-white/10 text-xs font-bold">
                {([
                  { id: 'inbox', label: dt('Bisedat'), count: 0 },
                  { id: 'requests', label: dt('Kërkesat'), count: requestConvs.length },
                ] as const).map((t) => (
                  <button key={t.id} type="button" role="tab" aria-selected={listTab === t.id} onClick={() => setListTab(t.id)}
                    className={`relative min-h-11 transition-colors ${listTab === t.id ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                    {t.label}
                    {t.count > 0 && <span className="ml-1.5 rounded-full bg-blue-600 px-1.5 text-[10px] font-black text-white">{t.count}</span>}
                    {listTab === t.id && <span className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-blue-500" />}
                  </button>
                ))}
              </div>
              <div className="p-3 border-b border-slate-800">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Kërko bisedat..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Recent people — one tap to jump into a thread. */}
              {listTab === 'inbox' && inboxConvs.length > 0 && (
                <div className="flex gap-3 overflow-x-auto border-b border-white/10 px-3 py-3 no-scrollbar" aria-label={dt('Bisedat e fundit')}>
                  {inboxConvs.slice(0, 8).map((conv) => {
                    const pid = conv.participants.find(p => p !== currentUser?.id);
                    const person = pid ? conv.participantData?.[pid] : null;
                    return (
                      <button key={conv.id} type="button" onClick={() => setActiveConvId(conv.id)}
                        className="flex w-12 shrink-0 flex-col items-center gap-1" title={person?.name}>
                        {person?.avatar ? (
                          <img loading="lazy" decoding="async" src={person.avatar} alt="" className={`h-11 w-11 rounded-full object-cover border-2 ${conv.id === activeConvId ? 'border-blue-500' : 'border-white/10'}`} />
                        ) : (
                          <span className={`flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-slate-300 border-2 ${conv.id === activeConvId ? 'border-blue-500' : 'border-white/10'}`}>
                            {person?.name?.[0]?.toUpperCase() || 'Q'}
                          </span>
                        )}
                        <span className="w-full truncate text-center text-[10px] text-slate-400">{person?.name?.split(' ')[0] || 'Përdorues'}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {loadingConv ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mb-2 text-blue-400" />
                    <span className="text-xs">Po ngarkohen bisedat...</span>
                  </div>
                ) : shownConvs.length === 0 ? (
                  <div className="text-center py-16 px-6 text-slate-400">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-blue-400">
                      <MessageSquare className="w-7 h-7" />
                    </div>
                    <p className="text-sm font-bold text-slate-200">{listTab === 'requests' ? dt('Nuk keni kërkesa mesazhesh') : dt('Nuk keni biseda active')}</p>
                    <p className="text-[11px] mt-1 text-slate-400">
                      {listTab === 'requests'
                        ? dt('Mesazhet nga njerëz që nuk i ndiqni shfaqen këtu derisa t’i pranoni.')
                        : dt('Vizitoni një profil në forum dhe klikoni "Dërgo Mesazh" për të nisur bisedën.')}
                    </p>
                  </div>
                ) : (
                  shownConvs
                    .filter(c => {
                      if (!searchQuery) return true;
                      const partnerKey = c.participants.find(p => p !== currentUser?.id);
                      const partner = partnerKey ? c.participantData?.[partnerKey] : null;
                      return partner?.name?.toLowerCase().includes(searchQuery.toLowerCase());
                    })
                    .map((conv) => {
                      const partnerId = conv.participants.find(p => p !== currentUser?.id);
                      const partner = partnerId ? conv.participantData?.[partnerId] : null;
                      const isSelected = conv.id === activeConvId;
                      // Unread count for THIS user, incremented by the sender on
                      // every message and cleared when the thread is opened.
                      const unread = Number(conv.unreadCount?.[currentUser?.id || '']) || 0;

                      return (
                        <button
                          key={conv.id}
                          // Opening the thread is the read receipt; the effect above asks
                          // the server to clear the counter (requests stay unread until answered).
                          onClick={() => setActiveConvId(conv.id)}
                          className={`w-full p-3 rounded-xl flex items-center gap-3 transition-colors text-left ${
                            isSelected
                              ? 'bg-blue-600/15 border border-blue-500/30 text-white'
                              : 'hover:bg-slate-800/50 text-slate-300'
                          }`}
                        >
                          <div className="relative">
                            {partner?.avatar ? (
                              <img loading="lazy" decoding="async" src={partner.avatar} alt={partner.name} className="w-10 h-10 rounded-full object-cover border border-slate-700" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700 font-bold text-sm">
                                {partner?.name?.[0]?.toUpperCase() || 'Q'}
                              </div>
                            )}
                            {unread > 0 && (
                              <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center border-2 border-slate-900">
                                {unread > 9 ? '9+' : unread}
                              </span>
                            )}
                            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className={`text-xs truncate ${unread > 0 ? 'font-black text-white' : 'font-semibold text-white'}`}>{partner?.name || 'Përdorues'}</span>
                              {conv.lastMessageAt && (
                                <span className="text-[10px] text-slate-400">
                                  {new Date(conv.lastMessageAt?.toMillis ? conv.lastMessageAt.toMillis() : Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            <p className={`text-xs truncate ${unread > 0 ? 'text-slate-200 font-medium' : 'text-slate-400'}`}>{conv.lastMessage || 'Nuk ka mesazhe'}</p>
                          </div>
                        </button>
                      );
                    })
                )}
              </div>

              <label className="lg:hidden block border-t border-white/10 p-3 text-[11px] text-slate-400">
                <span className="mb-1 block font-bold text-slate-300">{dt('Kush mund të më shkruajë')}</span>
                <select value={privacy} onChange={(e) => changePrivacy(e.target.value as DmPrivacy)} disabled={busyAction === 'privacy'}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-2 text-xs text-white focus:border-blue-500 focus:outline-none">
                  <option value="everyone">{dt('Të gjithë (të panjohurit shkojnë te Kërkesat)')}</option>
                  <option value="following">{dt('Vetëm njerëzit që unë ndjek')}</option>
                </select>
              </label>
            </div>

            {/* Right Chat Panel */}
            <div className={`flex-1 flex flex-col bg-transparent ${!activeConvId ? 'hidden md:flex' : 'flex'}`}>
              {activeConvId && otherUserData ? (
                <>
                  {/* Chat Top Bar */}
                  <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setActiveConvId(null)}
                        className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/50"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      {otherUserData.avatar ? (
                        <img loading="lazy" decoding="async" src={otherUserData.avatar} alt={otherUserData.name} className="w-9 h-9 rounded-full object-cover border border-slate-700" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs border border-slate-700">
                          {otherUserData.name?.[0]?.toUpperCase() || 'Q'}
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                          {otherUserData.name}
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                        </h4>
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Aktiv në platformë
                        </span>
                      </div>
                    </div>
                    {activeConv && (
                      <>
                        <button type="button" onClick={() => void toggleMute(activeConv.id, !(activeConv.mutedBy ?? []).includes(me))} disabled={busyAction === 'mute'}
                          aria-label={(activeConv.mutedBy ?? []).includes(me) ? dt('Hiq heshtimin') : dt('Hesht njoftimet')}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-300 transition-colors hover:bg-slate-800">
                          {(activeConv.mutedBy ?? []).includes(me) ? <BellOff className="w-3.5 h-3.5" aria-hidden="true" /> : <Bell className="w-3.5 h-3.5" aria-hidden="true" />}
                          <span className="hidden xl:inline">{(activeConv.mutedBy ?? []).includes(me) ? dt('Heshtur') : dt('Hesht')}</span>
                        </button>
                        <button type="button" onClick={() => deleteConversation(activeConv.id)} disabled={busyAction === 'hide'} aria-label={dt('Fshi bisedën')}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-300 transition-colors hover:bg-slate-800">
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> <span className="hidden xl:inline">{dt('Fshi')}</span>
                        </button>
                      </>
                    )}
                    {otherUserKey && (
                      <button type="button" onClick={() => setReportUserId(otherUserKey)} aria-label={dt('Raporto përdoruesin')}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-300 transition-colors hover:bg-slate-800">
                        <Flag className="w-3.5 h-3.5" aria-hidden="true" /> <span className="hidden xl:inline">{dt('Raporto')}</span>
                      </button>
                    )}
                    {otherUserKey && (
                      <button type="button" onClick={() => void toggleBlock(otherUserKey, otherUserData.name || 'përdoruesin', !blockedByMe)}
                        disabled={busyAction === 'block'}
                        aria-label={blockedByMe ? dt('Zhblloko') : dt('Blloko')}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${blockedByMe ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'text-rose-400 hover:bg-rose-500/10'}`}>
                        <Ban className="w-3.5 h-3.5" aria-hidden="true" /> <span className="hidden xl:inline">{blockedByMe ? dt('Zhblloko') : dt('Blloko')}</span>
                      </button>
                    )}
                  </div>

                  {activeView === 'incoming_request' && activeConv && (
                    <div role="region" aria-label={dt('Kërkesë për mesazh')} className="border-b border-slate-800 bg-blue-950/30 p-3 text-xs text-slate-200">
                      <p className="font-bold text-white">{otherUserData.name} {dt('dëshiron t’ju dërgojë një mesazh')}</p>
                      <p className="mt-0.5 text-slate-400">{dt('Nuk e ndiqni këtë llogari. Nuk do ta dijë që e keni lexuar derisa të pranoni.')}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" onClick={() => void respondTo(activeConv.id, 'accept')} disabled={!!busyAction}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 font-bold text-white hover:bg-blue-500 disabled:opacity-60">
                          <Check className="w-3.5 h-3.5" aria-hidden="true" /> {dt('Prano')}
                        </button>
                        <button type="button" onClick={() => void respondTo(activeConv.id, 'decline')} disabled={!!busyAction}
                          className="rounded-lg border border-slate-700 px-3 py-1.5 font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-60">
                          {dt('Refuzo')}
                        </button>
                        {otherUserKey && (
                          <button type="button" onClick={() => void toggleBlock(otherUserKey, otherUserData.name || '', true)} disabled={!!busyAction}
                            className="rounded-lg px-3 py-1.5 font-bold text-rose-400 hover:bg-rose-500/10 disabled:opacity-60">
                            {dt('Blloko')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {activeView === 'outgoing_request' && (
                    <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2 text-[11px] text-slate-400">
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" /> {dt('Kërkesa pret të pranohet. Mesazhet e tjera hapen pasi ta pranojnë.')}
                    </div>
                  )}

                  {/* Messages Scroll View */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/20">
                    {messages.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <Sparkles className="w-6 h-6 mx-auto mb-2 text-blue-400 opacity-60" />
                        <p className="text-xs">Biseda është e hapur. Shkruani mesazhin e parë për {otherUserData.name}!</p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isMe = msg.senderId === currentUser?.id;

                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed ${
                                isMe
                                  ? 'bg-blue-600 text-white rounded-br-none shadow-lg shadow-blue-600/10'
                                  : 'bg-slate-800 text-slate-200 border border-slate-700/60 rounded-bl-none'
                              }`}
                            >
                              {msg.imageUrl && (
                                <img loading="lazy" decoding="async"
                                  src={msg.imageUrl}
                                  alt="Bashkëngjitur"
                                  className="w-full max-h-48 object-cover rounded-xl mb-2 border border-black/20"
                                />
                              )}
                              <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 px-1">
                              {msg.createdAt?.toMillis
                                ? new Date(msg.createdAt.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : 'Tani'}
                            </span>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Send Message Input */}
                  {composer.canSend ? (
                  <form onSubmit={handleSendMessage} className="p-3 bg-black/20 border-t border-white/10 flex items-center gap-2">
                    <label className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors">
                      <ImageIcon className="w-4 h-4" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>

                    {selectedImage && (
                      <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg truncate max-w-[100px]">
                        {selectedImage.name}
                      </span>
                    )}

                    <input
                      type="text"
                      value={newMessageText}
                      onChange={(e) => setNewMessageText(e.target.value)}
                      placeholder={`Shkruaj një mesazh për ${otherUserData.name}...`}
                      className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />

                    <button
                      type="submit"
                      disabled={(!newMessageText.trim() && !selectedImage) || isSending}
                      className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-xl transition-colors disabled:text-slate-600 flex items-center justify-center"
                    >
                      {isSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </form>
                  ) : (
                    <div role="status" className="border-t border-slate-800 bg-slate-900 p-3 text-center text-xs text-slate-400">
                      {composer.reason === 'you_blocked' && dt('Keni bllokuar këtë përdorues. Zhbllokojeni për t’i shkruar.')}
                      {composer.reason === 'request_pending' && dt('Prisni që të pranojë kërkesën tuaj para se të dërgoni mesazh tjetër.')}
                      {composer.reason === 'incoming_request' && dt('Pranojeni kërkesën për të përgjigjur.')}
                    </div>
                  )}
                </>
              ) : (
                <div className="relative flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 overflow-hidden">
                  <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/20 blur-[90px]" aria-hidden="true" />
                  <div className="relative p-6 bg-white/5 rounded-3xl border border-white/10 mb-5 text-blue-400 shadow-2xl backdrop-blur">
                    <MessageSquare className="w-12 h-12" />
                  </div>
                  <h4 className="relative text-xl font-black text-white mb-2">{dt('Zgjidhni një bisedë')}</h4>
                  <p className="relative text-sm text-slate-400 max-w-sm">
                    Klikoni mbi një bisedë në të majtë ose hapni profilin e një qytetari në forum për t'i dërguar mesazh privat.
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
        {reportUserId && <ReportTargetSheet target={{ kind: 'user', targetId: reportUserId }} onClose={() => setReportUserId(null)} />}
      </div>
    </AnimatePresence>
  );
}
