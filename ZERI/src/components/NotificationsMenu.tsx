import { dt } from '@/src/lib/dt';
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Trash2, ShieldAlert, Info, AlertTriangle, CheckCircle2, ChevronRight, X, FileText, Megaphone } from 'lucide-react';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { sq } from 'date-fns/locale';
import { AppNotification } from '../types';

/**
 * The bell has TWO categories, matching how notifications are produced:
 *  - "Të Përgjithshme" — public broadcasts an admin publishes (channel general).
 *  - "Raportimet e Mia" — status updates the server writes to the reporter when
 *    their report moves through the pipeline (channel report, audience user).
 * Legacy documents carry no channel and default to the general tab.
 */
type BellChannel = 'general' | 'report';

export default function NotificationsMenu({ isMobile = false }: { isMobile?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<AppNotification | null>(null);
  const [tab, setTab] = useState<BellChannel>('general');
  const navigate = useNavigate();

  const notifications = useStore(state => state.notifications);
  const markNotificationAsRead = useStore(state => state.markNotificationAsRead);
  const deleteNotification = useStore(state => state.deleteNotification);

  const menuRef = useRef<HTMLDivElement>(null);

  const channelOf = (n: AppNotification): BellChannel => (n.channel === 'report' ? 'report' : 'general');
  const generalList = notifications.filter(n => channelOf(n) === 'general');
  const reportList = notifications.filter(n => channelOf(n) === 'report');
  const activeList = tab === 'report' ? reportList : generalList;

  const unreadGeneral = generalList.filter(n => !n.isRead).length;
  const unreadReport = reportList.filter(n => !n.isRead).length;
  const unreadCount = unreadGeneral + unreadReport;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedNotif(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getIcon = (type?: string) => {
    switch (type) {
      case 'alert': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => { setIsOpen(!isOpen); setSelectedNotif(null); }}
        className={cn(
          "relative flex items-center justify-center p-2 rounded-2xl transition-colors",
          isMobile ? "text-white" : "text-slate-700 dark:text-slate-200 dark:text-slate-300 hover:bg-neutral-100 hover:text-slate-900 dark:text-white"
        )}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white" />
        )}
      </button>

      {isOpen && (
        <div className={cn(
          "absolute z-50 w-80 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden",
          isMobile ? "right-0 top-full mt-2" : "bottom-full mb-2 left-0"
        )}>
          {selectedNotif ? (
            <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-200">
               <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center gap-3 bg-slate-50 dark:bg-slate-800">
                 <button onClick={() => setSelectedNotif(null)} className="p-1 hover:bg-slate-200 rounded-xl transition-colors"><ChevronRight className="w-5 h-5 rotate-180" /></button>
                 <span className="text-xs uppercase font-bold tracking-widest text-slate-900 dark:text-white">{dt(`Detajet e Njoftimit`)}</span>
               </div>
               <div className="p-5 overflow-y-auto max-h-[320px]">
                 <div className="flex items-center gap-3 mb-4">
                   {getIcon(selectedNotif.type)}
                   <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-tight">{selectedNotif.title}</h3>
                 </div>
                 <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-white/5 mb-4">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{dt(`Dërguesi`)}</p>
                   <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{selectedNotif.sender || 'Sistemi'}</p>
                 </div>
                 <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                   {selectedNotif.message}
                 </p>
                 <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                     {formatDistanceToNow(new Date(selectedNotif.createdAt), { locale: sq, addSuffix: true })}
                   </span>
                 </div>
               </div>
            </div>
          ) : (
            <div className="flex flex-col h-full animate-in fade-in duration-200">
              <div className="p-3 border-b-2 border-slate-900 bg-neutral-50 flex justify-between items-center">
                <span className="text-xs uppercase font-bold tracking-widest text-slate-900 dark:text-white">{dt(`Njoftimet`)}</span>
                {unreadCount > 0 && (
                  <span className="text-xs font-bold bg-rose-600 text-white px-2 py-0.5 rounded-full">{unreadCount}{dt(`TË REJA`)}</span>
                )}
              </div>

              {/* Two-category switcher */}
              <div className="grid grid-cols-2 border-b border-slate-100 dark:border-white/5" role="tablist" aria-label={dt('Kategoritë e njoftimeve')}>
                <button
                  role="tab"
                  aria-selected={tab === 'general'}
                  onClick={() => { setTab('general'); setSelectedNotif(null); }}
                  className={cn(
                    'relative flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-black uppercase tracking-wider transition-colors',
                    tab === 'general'
                      ? 'text-blue-700 dark:text-blue-300 border-b-2 border-blue-600 bg-blue-50/40 dark:bg-blue-950/20'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
                  )}
                >
                  <Megaphone className="w-3.5 h-3.5" /> {dt('Të Përgjithshme')}
                  {unreadGeneral > 0 && <span className="ml-0.5 rounded-full bg-rose-600 px-1.5 text-[9px] font-black text-white">{unreadGeneral}</span>}
                </button>
                <button
                  role="tab"
                  aria-selected={tab === 'report'}
                  onClick={() => { setTab('report'); setSelectedNotif(null); }}
                  className={cn(
                    'relative flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-black uppercase tracking-wider transition-colors',
                    tab === 'report'
                      ? 'text-emerald-700 dark:text-emerald-300 border-b-2 border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
                  )}
                >
                  <FileText className="w-3.5 h-3.5" /> {dt('Raportimet e Mia')}
                  {unreadReport > 0 && <span className="ml-0.5 rounded-full bg-rose-600 px-1.5 text-[9px] font-black text-white">{unreadReport}</span>}
                </button>
              </div>

              <div className="max-h-[320px] overflow-y-auto w-full">
                {activeList.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center gap-3">
                    <Bell className="w-8 h-8 text-slate-300" />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold tracking-wide uppercase">
                      {tab === 'report' ? dt('Nuk ka përditësime të raportimeve') : dt('Nuk ka njoftime')}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col divide-y divide-slate-100">
                    {activeList.map(notification => (
                      <button
                        key={notification.id}
                        onClick={() => {
                          if (!notification.isRead) markNotificationAsRead(notification.id);
                          // Report updates deep-link to the tracking page; broadcasts
                          // without a route open the inline detail view instead.
                          if (notification.link) {
                            setIsOpen(false);
                            setSelectedNotif(null);
                            navigate(notification.link);
                            return;
                          }
                          setSelectedNotif(notification);
                        }}
                        className={cn(
                          "p-4 text-left flex gap-3 hover:bg-slate-50 dark:bg-slate-800 transition-colors group",
                          !notification.isRead ? "bg-indigo-50/30" : "bg-white dark:bg-slate-900"
                        )}
                      >
                        <div className="shrink-0 pt-0.5">
                          {getIcon(notification.type)}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-bold text-slate-900 dark:text-white truncate pr-2">{notification.title}</span>
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">{notification.message}</span>
                          <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-2">
                            {formatDistanceToNow(new Date(notification.createdAt), { locale: sq, addSuffix: true })}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
