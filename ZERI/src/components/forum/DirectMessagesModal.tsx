import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Send, Search, Image as ImageIcon, MessageSquare, User,
  CheckCheck, ArrowLeft, Loader2, Sparkles, Smile, ShieldCheck
} from 'lucide-react';
import {
  collection, query, where, orderBy, onSnapshot, addDoc,
  serverTimestamp, doc, setDoc, updateDoc, getDocs, limit
} from 'firebase/firestore';
import { db, uploadFileToStorage } from '../../lib/firebase';
import { useStore } from '../../lib/store';
import toast from 'react-hot-toast';

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
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loadingConv, setLoadingConv] = useState(true);
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

    const convId = getConversationId(currentUser.id, targetUser.id);
    setActiveConvId(convId);

    // Initialize conversation doc if it doesn't exist
    const initConv = async () => {
      try {
        const convRef = doc(db, 'forum_conversations', convId);
        await setDoc(convRef, {
          participants: [currentUser.id, targetUser.id],
          participantData: {
            [currentUser.id]: { name: currentUser.name || 'Përdorues', avatar: (currentUser as any).avatar || '' },
            [targetUser.id]: { name: targetUser.name || 'Përdorues', avatar: targetUser.avatar || '' }
          },
          lastMessage: 'Gatshëm për bisedë',
          lastMessageAt: serverTimestamp(),
        }, { merge: true });
      } catch (err) {
        console.error('Error initializing conversation:', err);
      }
    };

    initConv();
  }, [isOpen, targetUser, currentUser]);

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

  // Listen to messages of active conversation
  useEffect(() => {
    if (!isOpen || !activeConvId) {
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
  }, [isOpen, activeConvId]);

  // Send a new message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessageText.trim() && !selectedImage) || !currentUser || !activeConvId || isSending) return;

    setIsSending(true);
    try {
      let imageUrl = '';
      if (selectedImage) {
        imageUrl = await uploadFileToStorage(selectedImage, 'forum_dms');
      }

      const textToSend = newMessageText.trim();
      const messagesRef = collection(db, 'forum_conversations', activeConvId, 'messages');
      await addDoc(messagesRef, {
        conversationId: activeConvId,
        senderId: currentUser.id,
        senderName: currentUser.name || 'Qytetar',
        senderAvatar: (currentUser as any).avatar || '',
        text: textToSend,
        imageUrl,
        createdAt: serverTimestamp(),
      });

      // Update parent conversation doc
      const convRef = doc(db, 'forum_conversations', activeConvId);
      const conv = conversations.find(c => c.id === activeConvId);
      const partnerKey = conv?.participants.find(p => p !== currentUser.id);
      const currentUnread = conv?.unreadCount || {};
      const partnerUnread = partnerKey ? (Number(currentUnread[partnerKey]) || 0) + 1 : 0;
      await updateDoc(convRef, {
        lastMessage: textToSend || '📷 Foto',
        lastMessageAt: serverTimestamp(),
        // Per-participant counters so the recipient's sidebar shows how many
        // messages arrived since they last opened the thread. The sender's own
        // counter is reset on send because they have obviously read what they
        // just wrote.
        unreadCount: { ...currentUnread, [currentUser.id]: 0, ...(partnerKey ? { [partnerKey]: partnerUnread } : {}) },
      });

      /**
       * Real-time bell notification. The App-level listener streams every
       * notification with `userId` set, so writing one here makes the bell
       * badge light up the moment the message lands — without polling.
       */
      if (partnerKey) {
        try {
          await addDoc(collection(db, 'notifications'), {
            title: `Mesazh i ri nga ${currentUser.name || 'një qytetar'}`,
            message: textToSend || '📷 Ju ka dërguar një foto.',
            channel: 'forum_dm',
            category: 'forum_dm',
            type: 'info',
            priority: 'normal',
            audience: 'user',
            userId: partnerKey,
            actorId: currentUser.id,
            actorName: currentUser.name,
            state: 'published',
            link: '/forum',
            sender: currentUser.name,
            createdAt: serverTimestamp(),
          });
        } catch (notifyErr) {
          console.warn('DM notification failed:', notifyErr);
        }
      }

      setNewMessageText('');
      setSelectedImage(null);
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error('Nuk u dërgua mesazhi. Provo përsëri.');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  const activeConv = conversations.find(c => c.id === activeConvId);
  const otherUserKey = activeConv?.participants.find(p => p !== currentUser?.id);
  const otherUserData = otherUserKey ? activeConv?.participantData?.[otherUserKey] : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-slate-900 border border-slate-800 w-full sm:max-w-5xl md:max-w-6xl h-[100dvh] sm:h-[85vh] md:h-[88vh] sm:rounded-2xl rounded-none flex flex-col overflow-hidden shadow-2xl"
        >
          {/* Top Header */}
          <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/20 rounded-xl text-blue-400 border border-blue-500/30">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Mesazhet Private
                  <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Kriptuar & Të sigurta
                  </span>
                </h3>
                <p className="text-xs text-slate-400">Komunikoni drejtpërdrejt me qytetarët dhe profilat zyrtarë</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Body Grid */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar: Conversations List */}
            <div className={`w-full md:w-72 lg:w-80 border-r border-slate-800 bg-slate-950/50 flex-col shrink-0 ${activeConvId ? 'hidden md:flex' : 'flex'}`}>
              {/* Mobile: back to list from an open thread */}
              {activeConvId && (
                <button
                  onClick={() => setActiveConvId(null)}
                  className="md:hidden flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-slate-300 hover:text-white border-b border-slate-800"
                >
                  <ArrowLeft className="w-4 h-4" /> Të gjitha bisedat
                </button>
              )}
              <div className="p-3 border-b border-slate-800">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Kërko bisedat..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {loadingConv ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mb-2 text-blue-400" />
                    <span className="text-xs">Po ngarkohen bisedat...</span>
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-12 px-4 text-slate-500">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-medium text-slate-400">Nuk keni biseda active</p>
                    <p className="text-[11px] mt-1 text-slate-500">Vizitoni një profil në forum dhe klikoni "Dërgo Mesazh" për të nisur bisedën.</p>
                  </div>
                ) : (
                  conversations
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
                          onClick={() => {
                            setActiveConvId(conv.id);
                            // Opening the thread is the read receipt: clear the
                            // counter locally and in Firestore so the badge does
                            // not survive the conversation switch.
                            if (unread > 0) {
                              setConversations(prev => prev.map(c =>
                                c.id === conv.id ? { ...c, unreadCount: { ...c.unreadCount, [currentUser!.id]: 0 } } : c
                              ));
                              updateDoc(doc(db, 'forum_conversations', conv.id), {
                                [`unreadCount.${currentUser!.id}`]: 0,
                              }).catch(console.warn);
                            }
                          }}
                          className={`w-full p-3 rounded-xl flex items-center gap-3 transition-colors text-left ${
                            isSelected
                              ? 'bg-blue-600/15 border border-blue-500/30 text-white'
                              : 'hover:bg-slate-800/50 text-slate-300'
                          }`}
                        >
                          <div className="relative">
                            {partner?.avatar ? (
                              <img src={partner.avatar} alt={partner.name} className="w-10 h-10 rounded-full object-cover border border-slate-700" />
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
                                <span className="text-[10px] text-slate-500">
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
            </div>

            {/* Right Chat Panel */}
            <div className={`flex-1 flex flex-col bg-slate-900 ${!activeConvId ? 'hidden md:flex' : 'flex'}`}>
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
                        <img src={otherUserData.avatar} alt={otherUserData.name} className="w-9 h-9 rounded-full object-cover border border-slate-700" />
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
                  </div>

                  {/* Messages Scroll View */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/20">
                    {messages.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
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
                                <img
                                  src={msg.imageUrl}
                                  alt="Bashkëngjitur"
                                  className="w-full max-h-48 object-cover rounded-xl mb-2 border border-black/20"
                                />
                              )}
                              <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                            </div>
                            <span className="text-[10px] text-slate-500 mt-1 px-1">
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
                  <form onSubmit={handleSendMessage} className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
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
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
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
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <div className="p-4 bg-slate-800/40 rounded-full border border-slate-800 mb-3 text-blue-400">
                    <MessageSquare className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">Zgjidhni një bisedë</h4>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Klikoni mbi një bisedë në të majtë ose hapni profilin e një qytetari në forum për t'i dërguar mesazh privat.
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
