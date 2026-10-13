import { dt } from '@/src/lib/dt';
import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, AlertCircle, RefreshCw, FileText, Landmark, FileCheck, HelpCircle } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { useStore } from '../lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { authHeaders } from '../lib/apiAuth';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const PRESETS = [
  {
    id: 'birth_cert',
    label: 'Certifikatë Lindjeje',
    icon: FileText,
    query: 'Cilat dokumente më duhen për të marrë një certifikatë lindjeje në komunë dhe sa kushton tarifat administrative?',
  },
  {
    id: 'building_permit',
    label: 'Leje Ndërtimi',
    icon: Landmark,
    query: 'Çfarë procedure dhe cilat dokumente kryesore nevojiten për të aplikuar për leje ndërtimi për një shtëpi banimi?',
  },
  {
    id: 'business_reg',
    label: 'Regjistrim Biznesi',
    icon: FileCheck,
    query: 'Si mund ta regjistroj një biznes të ri lokal (Sh.p.k.) dhe cilat janë kërkesat e komunës për leje pune?',
  },
  {
    id: 'subsidies',
    label: 'Subvencione Bujqësore',
    icon: HelpCircle,
    query: 'Si bëhet aplikimi për subvencione bujqësore apo grante të tjera të ofruara nga drejtoria përkatëse komunale këtë vit?',
  },
];

export function AIAssistantPage() {
  const { language, t } = useLanguage();
  const currentUser = useStore(state => state.currentUser);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Përshëndetje ${currentUser ? currentUser.name : 'i/e nderuar qytetar/e'}! 

Unë jam **Ndihmësi Inteligjent AI i Procedurave Zyrtare**. Detyra ime është t'ju tregoj me saktësi procedurat administrative për të gjitha komunat e Kosovës.

Mund të më pyesni për:
- **Dokumentet e nevojshme** për certifikata, leje ndërtimi apo licenca.
- **Afatet e përfundimit** dhe **tarifat** zyrtare.
- **Hapat konkrete** për aplikim online apo fizik.

Zgjidhni një nga pyetjet e shpeshta më poshtë, ose shkruani pyetjen tuaj të personalizuar!`,
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only scroll smoothly if we are not at the very bottom already
    // but a better approach is to rely on flex-col-reverse or similar. 
    // We will just do a small timeout scroll.
    const t = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(t);
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = {
      id: Math.random().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Build conversation history for the endpoint
      const formattedHistory = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          messages: formattedHistory,
          language: language,
        }),
      });

      const data = await res.json();
      if (res.ok && data.text) {
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          role: 'assistant',
          content: data.text,
          timestamp: new Date(),
        }]);
      } else {
        throw new Error(data.error || 'Gabim i panjohur nga serveri AI.');
      }
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        role: 'assistant',
        content: `Më vjen keq, ndodhi një gabim gjatë lidhjes me serverin AI: **${err.message || 'Lidhja dështoi'}**. Ju lutem provoni përsëri pas pak.`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePresetClick = (query: string) => {
    handleSendMessage(query);
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `Biseda u rinis. Pyetni Ndihmësin Inteligjent për çfarëdo procedure zyrtare në komunën tuaj!`,
        timestamp: new Date(),
      }
    ]);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-5xl mx-auto flex flex-col h-[calc(100dvh-72px)] relative bg-slate-50 dark:bg-slate-800" id="ai-assistant-page"
    >
      {/* Header */}
      <div className="bg-slate-900 text-white border-b-4 border-rose-600 px-6 py-4 flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-600 flex items-center justify-center border-2 border-white rounded-2xl animate-pulse">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight uppercase title-serif flex items-center gap-2">{dt(`Ndihmësi AI`)} <span className="text-xs bg-rose-700 text-white px-2 py-0.5 rounded-full font-black animate-bounce tracking-widest">{dt(`AKTIV`)}</span>
            </h1>
            <p className="text-xs text-neutral-400 font-mono">{dt(`ASISTENTI INTELIGJENT PËR PROCEDURA ZYRTARE`)}</p>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="bg-slate-800 hover:bg-slate-700 text-neutral-300 hover:text-white px-3 py-1.5 border border-slate-700 text-xs font-bold tracking-wider uppercase transition-colors flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />{dt(`Rinis`)}
        </button>
      </div>

      {/* Messages Sandbox */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 p-6 space-y-6 custom-scrollbar scroll-smooth">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isBot = msg.role === 'assistant';
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 max-w-[85%] ${isBot ? 'self-start' : 'ml-auto flex-row-reverse'}`}
              >
                {isBot ? (
                  <div className="w-10 h-10 shrink-0 bg-slate-900 border-2 border-rose-600 text-white flex items-center justify-center font-bold text-sm">
                    <Bot className="w-5 h-5 text-rose-600" />
                  </div>
                ) : (
                  <div className="w-10 h-10 shrink-0 bg-rose-600 border-2 border-slate-900 text-white flex items-center justify-center font-bold text-sm uppercase title-serif">
                    {currentUser ? currentUser.name.charAt(0) : 'Q'}
                  </div>
                )}

                <div className={`p-4 border-2 shadow-sm dark:shadow-none ${
                  isBot 
                    ? 'bg-neutral-50 border-slate-200/60 text-slate-800 dark:text-slate-200 dark:text-slate-200 rounded-tr-2xl rounded-br-2xl rounded-bl-2xl' 
                    : 'bg-slate-900 border-slate-900 text-white rounded-tl-2xl rounded-br-2xl rounded-bl-2xl'
                }`}>
                  <div className="prose prose-sm max-w-none font-sans leading-relaxed whitespace-pre-line text-sm md:text-base">
                    {msg.content}
                  </div>
                  <span className={`block text-[10px] font-mono mt-2 ${isBot ? 'text-neutral-400' : 'text-neutral-500 dark:text-slate-400 text-right'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {isLoading && (
          <div className="flex gap-4 max-w-[85%] self-start">
            <div className="w-10 h-10 bg-slate-900 border-2 border-rose-600 text-white flex items-center justify-center font-bold animate-spin">
              <Sparkles className="w-5 h-5 text-rose-600" />
            </div>
            <div className="p-4 bg-neutral-50 border-2 border-slate-200/60 text-slate-800 dark:text-slate-200 dark:text-slate-200 rounded-tr-2xl rounded-br-2xl rounded-bl-2xl flex items-center gap-3">
              <span className="text-sm font-bold tracking-wider font-mono animate-pulse">{dt(`ASISTENTI DUKE PROCESUAR RREGULLAT ADMINISTRATIVE...`)}</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Footer Area - Quick Presets & Form */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200/60 dark:border-white/10 p-4 space-y-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] shrink-0 z-10">
        {/* Preset Chips */}
        {messages.length === 1 && !isLoading && (
          <div className="space-y-2">
            <p className="text-[10px] font-black tracking-widest text-neutral-400 uppercase">{dt(`Sugjerime të Shpeshta:`)}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESETS.map((preset) => {
                const Icon = preset.icon;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetClick(preset.query)}
                    className="flex items-center gap-3 bg-white dark:bg-slate-900 hover:bg-slate-900 hover:text-white border-2 border-slate-200/60 dark:border-white/10 hover:border-slate-900 p-3 text-left transition-all duration-200 shadow-sm dark:shadow-none cursor-pointer"
                  >
                    <div className="p-1.5 bg-neutral-100 group-hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl shrink-0">
                      <Icon className="w-4 h-4 text-rose-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight uppercase">{preset.label}</p>
                      <p className="text-[10px] text-neutral-500 dark:text-slate-400 font-serif italic truncate mt-0.5">{dt(`Kliko për udhëzime...`)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Form Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputValue);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            placeholder={dt(`Shkruani pyetjen tuaj për procedurat zyrtare administrative...`)}
            className="flex-1 bg-white dark:bg-slate-900 border-2 border-slate-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-600 text-slate-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="bg-slate-900 hover:bg-rose-600 text-white font-bold px-6 py-3 transition-colors flex items-center justify-center gap-2 border-l-4 border-rose-600 disabled:opacity-50 disabled:bg-slate-400 disabled:border-slate-400 shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" /> <span className="hidden sm:inline text-sm uppercase tracking-wider">{dt(`Dërgo`)}</span>
          </button>
        </form>
      </div>
    </motion.div>
  );
}
