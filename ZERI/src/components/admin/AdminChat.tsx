import { dt } from '@/src/lib/dt';
import React, { useState, useEffect, useRef } from 'react';
import { Send, User as UserIcon, Bot, Info, XCircle, Star, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useStore } from '../../lib/store';

export default function AdminChat() {
  const chats = useStore(state => state.chats);
  const sendMessage = useStore(state => state.sendMessage);
  const closeChat = useStore(state => state.closeChat);

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  
  const selectedChat = chats.find(c => c.id === selectedChatId) || chats[0];
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedChat?.messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedChat || selectedChat.status === 'closed') return;
    
    sendMessage(selectedChat.id, input, 'agent');
    setInput('');
  };

  const handleClose = () => {
    if (!selectedChat || selectedChat.status === 'closed') return;
    if (confirm('Jeni të sigurt që doni ta mbyllni këtë bisedë?')) {
      closeChat(selectedChat.id);
    }
  };

  return (
    <div className="max-w-6xl mx-auto h-[min(calc(100vh-120px),800px)] flex flex-col md:flex-row bg-white dark:bg-slate-900 border-2 border-slate-200/60 dark:border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] dark:shadow-none transition-all duration-300 rounded-xl overflow-hidden">
      
      {/* Sidebar: Active Chats */}
      <div className="w-full md:w-80 border-b-4 md:border-b-0 md:border-r border-slate-200/60 dark:border-white/10 bg-neutral-100 flex flex-col hidden sm:flex">
        <div className="p-6 border-b border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 relative">
          <div className="absolute top-0 right-0 bg-rose-600 text-white px-3 py-0.5 text-xs font-bold tracking-wide border-b-2 border-l-2 border-slate-900">{dt(`Paneli i Operatorit`)}
          </div>
          <h3 className="font-bold text-xl text-slate-900 dark:text-white tracking-wide title-serif">{dt(`Kanali i Komunikimit`)}</h3>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-slate-300 mt-2 tracking-wide">{dt(`SUBJEKTET (`)}{chats.length})</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chats.length === 0 && (
             <div className="text-center p-8 border-2 border-dashed border-slate-900">
               <p className="text-xs font-bold text-slate-900 dark:text-white tracking-wide">{dt(`SISTEMI NË PRITJE.`)}</p>
             </div>
          )}
          {chats.map(chat => (
            <div 
              key={chat.id}
              onClick={() => setSelectedChatId(chat.id)}
              className={cn(
                "p-4 flex items-center gap-4 cursor-pointer relative border-4 transition-colors duration-300 ease-in-out",
                selectedChat?.id === chat.id ? "bg-slate-900 border-slate-900 text-white" : "bg-white dark:bg-slate-900 border-slate-900 hover:bg-neutral-50 text-slate-900 dark:text-white",
                chat.status === 'closed' && "opacity-60 bg-neutral-200"
              )}
            >
               {chat.status === 'active' && <div className="absolute top-2 right-2 w-2 h-2 bg-rose-600 shadow-[0_0_8px_#e11d48] animate-pulse" />}
               <div className={cn("w-12 h-12 flex items-center justify-center font-bold text-xl border-2 border-current bg-white dark:bg-slate-900", selectedChat?.id === chat.id ? "text-slate-900 dark:text-white" : "text-slate-900 dark:text-white")}>
                 {chat.userName.charAt(0)}
               </div>
               <div className="flex-1 min-w-0">
                 <h4 className={cn("text-xs font-bold tracking-wide truncate mb-1", selectedChat?.id === chat.id ? "text-white" : "text-slate-900 dark:text-white")}>
                   {chat.userName}
                 </h4>
                 <p className={cn("text-xs font-bold tracking-wide truncate flex items-center gap-2", selectedChat?.id === chat.id ? "text-neutral-300" : "text-slate-700 dark:text-slate-200 dark:text-slate-300")}>
                   {chat.status === 'active' ? 'SEZONI AKTIV' : 'DOSJA E MBYLLUR'}
                   {chat.rating && <span className="flex items-center text-[#C5A059]"><Star className="w-3 h-3 fill-current mr-1" /> {chat.rating}</span>}
                 </p>
               </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-6 border-b border-slate-200/60 dark:border-white/10 flex items-center justify-between z-10 bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 flex items-center justify-center font-bold text-xl border border-slate-200/60 dark:border-white/10 rounded-xl bg-neutral-100 text-slate-900 dark:text-white">
                   {selectedChat.userName.charAt(0)}
                 </div>
                 <div>
                   <h2 className="font-bold text-xl text-slate-900 dark:text-white tracking-wide leading-tight mb-1 title-serif">{selectedChat.userName}</h2>
                   <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-slate-700 dark:text-slate-200 dark:text-slate-300">
                     {selectedChat.status === 'active' ? (
                       <><div className="w-2 h-2 bg-rose-600" />{dt(`STATUSI: AKTIV (ID:`)} {selectedChat.id})</>
                     ) : (
                       <><div className="w-2 h-2 bg-neutral-400" />{dt(`STATUSI: MBYLLUR`)}</>
                     )}
                   </div>
                 </div>
              </div>
              <div className="flex gap-2">
                {selectedChat.status === 'active' && (
                  <button onClick={handleClose} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 text-rose-600 border-2 border-rose-600 hover:bg-rose-600 hover:text-white text-xs font-bold tracking-wide transition-colors duration-300 ease-in-out">
                    <XCircle className="w-4 h-4" />{dt(`MBYLL SEZONIN`)}
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-neutral-50/50">
              <div className="text-center">
                <span className="text-xs font-bold text-slate-900 dark:text-white tracking-wide border-b-2 border-neutral-300 pb-1">{dt(`ZGJEDHJA U HAP:`)} {new Date(selectedChat.messages[0]?.time || Date.now()).toLocaleDateString('sq-AL', { hour: '2-digit', minute:'2-digit' })}</span>
              </div>

              {selectedChat.messages.map(msg => (
                <div key={msg.id} className={cn("flex w-full", (msg.sender === 'agent' || msg.sender === 'ai') ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] md:max-w-[70%] flex flex-col gap-2", (msg.sender === 'agent' || msg.sender === 'ai') ? "items-end" : "items-start")}>
                    <div className="flex items-center gap-2 px-2">
                       {(msg.sender === 'agent' || msg.sender === 'ai') && <span className="text-xs font-bold text-neutral-500 dark:text-slate-400 tracking-wide">{new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                       <span className={cn("text-xs font-bold tracking-wide px-2 border border-current", msg.sender === 'agent' ? "text-rose-600" : msg.sender === 'ai' ? "text-blue-900" : "text-slate-700 dark:text-slate-200 dark:text-slate-300")}>
                         {msg.sender === 'agent' ? 'PËRFAQËSUESI ZYRTAR' : msg.sender === 'ai' ? 'Asistenti Digjital' : selectedChat.userName}
                       </span>
                       {msg.sender === 'user' && <span className="text-xs font-bold text-neutral-500 dark:text-slate-400 tracking-wide">{new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                    </div>
                    <div className={cn(
                      "p-5 font-medium leading-relaxed text-sm border-4",
                      msg.sender === 'agent' ? "bg-slate-900 border-slate-900 text-white" : 
                      msg.sender === 'ai' ? "bg-neutral-100 border-blue-900 text-slate-900 dark:text-white" :
                      "bg-white dark:bg-slate-900 border-neutral-300 text-neutral-900 dark:text-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] dark:shadow-none transition-all duration-300 rounded-xl"
                    )}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}
              
              {selectedChat.status === 'closed' && (
                <div className="mt-12 bg-white dark:bg-slate-900 border-2 border-slate-200/60 dark:border-white/10 rounded-xl p-8 text-center">
                  <CheckCircle className="w-10 h-10 text-slate-900 dark:text-white mx-auto mb-4" />
                  <p className="font-bold text-xl text-slate-900 dark:text-white tracking-wide title-serif">{dt(`DOSJA E MBYLLUR ZYRTARISHT`)}</p>
                  {selectedChat.rating ? (
                    <div className="mt-6 inline-flex items-center gap-2 bg-slate-900 px-4 py-2 text-white">
                      <Star className="w-4 h-4 text-[#C5A059] fill-current" />
                      <span className="font-bold text-xs tracking-wide">{dt(`VLERËSIMI QYTETAR:`)} {selectedChat.rating}/5</span>
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-slate-300 tracking-wide mt-4">{dt(`NUK KA VLERËSIM TË REGJISTRUAR.`)}</p>
                  )}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-6 border-t border-slate-200/60 dark:border-white/10 bg-neutral-100 shrink-0">
              <form onSubmit={handleSend} className="relative flex items-center">
                <input 
                  type="text" 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={selectedChat.status === 'active' ? "DEKLARATA YTE ZYRTARE..." : "SISTEMI JASHTË FUNKSIONIT."} 
                  disabled={selectedChat.status === 'closed'}
                  className="w-full pl-6 pr-20 py-4 bg-white dark:bg-slate-900 border-2 border-slate-200/60 dark:border-white/10 rounded-xl text-sm font-bold tracking-wide focus:outline-none focus:ring-2 focus:ring-rose-600 transition-colors duration-300 ease-in-out disabled:bg-neutral-200 disabled:text-slate-700 dark:text-slate-200 dark:text-slate-300 placeholder:text-neutral-500"
                />
                <button 
                  type="submit" 
                  disabled={!input.trim() || selectedChat.status === 'closed'}
                  className="absolute right-3 p-3 bg-rose-600 hover:bg-slate-900 disabled:bg-neutral-400 text-white transition-colors duration-300 ease-in-out disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
              <div className="mt-4 text-center">
                 <p className="text-xs font-bold tracking-wide text-slate-700 dark:text-slate-200 dark:text-slate-300">{dt(`OPERON:`)} <strong className="text-slate-900 dark:text-white">{dt(`ADMINISTRATORI (SEKTORI I KOMUNIKIMIT)`)}</strong></p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-300 bg-neutral-50 p-12 text-center">
            <div className="w-24 h-24 border-4 border-dashed border-neutral-300 flex items-center justify-center mb-6">
              <Bot className="w-12 h-12" />
            </div>
            <p className="font-bold text-xl text-neutral-500 dark:text-slate-400 tracking-wide title-serif">{dt(`SISTEMI NË PRITJE`)}</p>
            <p className="text-xs font-bold tracking-wide mt-2">{dt(`SELEKTO NJË DOSJE PËR TË VEPRUAR.`)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
