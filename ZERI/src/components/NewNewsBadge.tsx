import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, X, MessageSquare, Megaphone, FileText, AlertTriangle, CheckCircle2, Info, Link2, Settings2, CheckCheck } from 'lucide-react';
import { collection, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where, doc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { sq } from 'date-fns/locale';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import { dt } from '@/src/lib/dt';
import { useStore } from '../lib/store';
import type { AppNotification } from '../types';

/**
 * The single notification bell of the platform, split into two channels.
 *
 *   • "Raportimet"  — municipal responses to the citizen's OWN reports. Derived
 *     from each report's timeline so it works even for legacy reports that
 *     predate the notification docs the server writes on a status transition.
 *   • "Njoftime"    — general broadcasts (audience === 'all') published from the
 *     admin panel: platform news, maintenance, urgent alerts.
 *
 * Read state is per-channel. Report responses use localStorage (keyed by
 * report + status + date, so a NEW response re-rings the bell). Broadcasts are
 * shared documents, so their read state can't live on the doc: an authenticated
 * user gets a tiny `${uid}_${notificationId}` marker in `notificationReads`
 * (cross-device, scales to millions of readers), and a guest falls back to
 * localStorage.
 */

const REPORT_READ_KEY = 'zeri_read_response_ids';
const GENERAL_READ_KEY = 'zeri_read_general_ids';

function readLocalSeen(key: string): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeLocalSeen(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids.slice(-200)));
  } catch {
    // Storage unavailable; the badge simply reappears next load.
  }
}

function relativeWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return formatDistanceToNow(d, { locale: sq, addSuffix: true });
  } catch {
    return '';
  }
}

interface ResponseUpdate {
  /** Unique per change: `${reportId}:${status}:${date}` */
  id: string;
  reportId: string;
  reportTitle: string;
  trackingId?: string;
  status: string;
  respondedBy?: string;
  respondedAt?: string;
}

const REPORT_STATUS_LABELS: Record<string, string> = {
  'In Progress': 'Në trajtim',
  Resolved: 'E zgjidhur',
  Rejected: 'E refuzuar',
  Assigned: 'Caktuar për trajtim',
  'Pending Review': 'Në shqyrtim',
};

const TYPE_ICON: Record<string, typeof Info> = {
  alert: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};

const TYPE_TONE: Record<string, string> = {
  alert: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50',
  success: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50',
  info: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50',
};

type Tab = 'report' | 'general';

/**
 * Which channels may ring the badge. Muting a channel only silences its count;
 * its items stay readable in the dropdown, so nothing is ever lost.
 */
const PREFS_KEY = 'zeri-notification-prefs';
interface NotificationPrefs {
  report: boolean;
  general: boolean;
}

function readPrefs(): NotificationPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return { report: raw.report !== false, general: raw.general !== false };
  } catch {
    return { report: true, general: true };
  }
}

export function ResponseNotificationsBell() {
  const [tab, setTab] = useState<Tab>('report');
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(readPrefs);

  const updatePrefs = (patch: Partial<NotificationPrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        // The choice still applies for this visit without storage.
      }
      return next;
    });
  };
  const wrapRef = useRef<HTMLDivElement>(null);

  const currentUser = useStore((s) => s.currentUser);
  const storeNotifications = useStore((s) => s.notifications);
  const currentUserId = currentUser && currentUser.role !== 'guest' ? currentUser.id : null;

  // ── Report channel ────────────────────────────────────────────────
  const [myReports, setMyReports] = useState<any[]>([]);
  const [hasReports, setHasReports] = useState(false);
  const [reportSeen, setReportSeen] = useState<string[]>(() => readLocalSeen(REPORT_READ_KEY));

  useEffect(() => {
    if (!currentUserId) {
      setMyReports([]);
      setHasReports(false);
      return;
    }
    const q = query(
      collection(db, 'reports'),
      where('authorId', '==', currentUserId),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    return onSnapshot(
      q,
      (snap) => {
        setMyReports(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setHasReports(true);
      },
      () => setHasReports(false),
    );
  }, [currentUserId]);

  const reportUpdates = useMemo<ResponseUpdate[]>(() => {
    const derived: ResponseUpdate[] = [];
    for (const report of myReports) {
      const timeline: any[] = Array.isArray(report.timeline) ? report.timeline : [];
      for (const event of timeline.slice(1)) {
        derived.push({
          id: `${report.id}:${event.status}:${event.date}`,
          reportId: report.id,
          reportTitle: report.title || 'Raportim',
          trackingId: report.trackingId,
          status: event.status,
          respondedBy: event.updatedBy,
          respondedAt: event.date,
        });
      }
    }
    derived.sort((a, b) => Date.parse(b.respondedAt || '') - Date.parse(a.respondedAt || ''));
    return derived.slice(0, 30);
  }, [myReports]);

  const reportUnread = reportUpdates.filter((u) => !reportSeen.includes(u.id));

  // ── General channel ───────────────────────────────────────────────
  const broadcasts = useMemo<AppNotification[]>(
    () =>
      storeNotifications.filter(
        (n) =>
          n.audience === 'all' &&
          n.channel !== 'report' &&
          (!n.state || n.state === 'published'),
      ),
    [storeNotifications],
  );

  const [generalRead, setGeneralRead] = useState<Set<string>>(
    () => new Set(currentUserId ? [] : readLocalSeen(GENERAL_READ_KEY)),
  );

  useEffect(() => {
    if (!currentUserId) {
      setGeneralRead(new Set(readLocalSeen(GENERAL_READ_KEY)));
      return;
    }
    const q = query(collection(db, 'notificationReads'), where('userId', '==', currentUserId));
    return onSnapshot(
      q,
      (snap) => setGeneralRead(new Set(snap.docs.map((d) => d.data().notificationId as string))),
      () => setGeneralRead(new Set()),
    );
  }, [currentUserId]);

  const generalUnread = broadcasts.filter((n) => !generalRead.has(n.id));
  const totalUnread = (prefs.report ? reportUnread.length : 0) + (prefs.general ? generalUnread.length : 0);

  const markGeneralRead = (ids: string[]) => {
    if (ids.length === 0) return;
    if (currentUserId) {
      for (const id of ids) {
        setDoc(
          doc(db, 'notificationReads', `${currentUserId}_${id}`),
          { userId: currentUserId, notificationId: id, readAt: serverTimestamp() },
          { merge: true },
        ).catch(() => {});
      }
      setGeneralRead((prev) => new Set([...prev, ...ids]));
    } else {
      const next = [...new Set([...readLocalSeen(GENERAL_READ_KEY), ...ids])];
      writeLocalSeen(GENERAL_READ_KEY, next);
      setGeneralRead(new Set(next));
    }
  };

  const markReportsRead = (ids: string[]) => {
    if (ids.length === 0) return;
    const next = [...new Set([...reportSeen, ...ids])].slice(-200);
    setReportSeen(next);
    writeLocalSeen(REPORT_READ_KEY, next);
  };

  const openBell = () => {
    setIsOpen(true);
    // Opening the bell clears the badge for whichever channel is in focus.
    if (tab === 'report') markReportsRead(reportUpdates.map((u) => u.id));
    else markGeneralRead(broadcasts.map((n) => n.id));
  };

  // Close on outside click / Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const switchTab = (next: Tab) => {
    setTab(next);
    if (next === 'report') markReportsRead(reportUpdates.map((u) => u.id));
    else markGeneralRead(broadcasts.map((n) => n.id));
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : openBell())}
        aria-label={`${dt('Njoftime')}: ${totalUnread} ${dt('të palexuara')}`}
        aria-expanded={isOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {totalUnread > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-[1.15rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-slate-900">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[21rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-(--shadow-floating) dark:border-white/10 dark:bg-slate-900">
          {/* Tabs */}
          <div className="flex items-stretch border-b border-slate-100 dark:border-white/5">
            {(
              [
                { id: 'report' as Tab, label: dt('Raportimet e mia'), count: reportUnread.length, icon: FileText },
                { id: 'general' as Tab, label: dt('Njoftime'), count: generalUnread.length, icon: Megaphone },
              ]
            ).map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => switchTab(t.id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 px-3 py-3 text-[11px] font-black uppercase tracking-wide transition-colors',
                    active
                      ? 'border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-300'
                      : 'border-b-2 border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {t.label}
                  {t.count > 0 && (
                    <span className="ml-0.5 rounded-full bg-rose-600 px-1.5 text-[9px] font-black text-white">
                      {t.count > 9 ? '9+' : t.count}
                    </span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowSettings((value) => !value)}
              aria-label={dt('Cilësimet e njoftimeve')}
              aria-expanded={showSettings}
              className={cn(
                'px-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800',
                showSettings && 'text-indigo-600 dark:text-indigo-300'
              )}
            >
              <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label={dt('Mbyll')}
              className="px-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {showSettings && (
            <div className="space-y-1 border-b border-slate-100 bg-slate-50/70 p-3 dark:border-white/5 dark:bg-slate-800/40">
              <p className="px-1 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {dt('Cilësimet e njoftimeve')}
              </p>
              {(
                [
                  { key: 'report' as const, label: dt('Përgjigjet për raportimet e mia') },
                  { key: 'general' as const, label: dt('Njoftime të përgjithshme') },
                ]
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="switch"
                  aria-checked={prefs[item.key]}
                  onClick={() => updatePrefs({ [item.key]: !prefs[item.key] } as Partial<NotificationPrefs>)}
                  className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-xs font-semibold text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span>{item.label}</span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'relative h-5 w-9 shrink-0 rounded-full transition-colors',
                      prefs[item.key] ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
                        prefs[item.key] ? 'left-[1.1rem]' : 'left-0.5'
                      )}
                    />
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  markReportsRead(reportUpdates.map((u) => u.id));
                  markGeneralRead(broadcasts.map((n) => n.id));
                }}
                className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-bold text-indigo-600 hover:bg-white dark:text-indigo-300 dark:hover:bg-slate-800"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {dt('Shëno të gjitha si të lexuara')}
              </button>
            </div>
          )}

          {/* Body */}
          {tab === 'report' ? (
            reportUpdates.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                text={
                  hasReports
                    ? dt('Komuna nuk ka përgjigjur ende asnjë raportim tuajin.')
                    : dt('Sapo dërgoni një raportim, përgjigjet e komunës shfaqen këtu.')
                }
              />
            ) : (
              <ul className="max-h-96 overflow-y-auto p-2">
                {reportUpdates.map((update) => (
                  <li key={update.id}>
                    <Link
                      to={`/trackid?id=${encodeURIComponent(update.trackingId || update.reportId)}`}
                      onClick={() => setIsOpen(false)}
                      className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-blue-50 dark:hover:bg-slate-800"
                    >
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{update.reportTitle}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {dt('Statusi')}:{' '}
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {REPORT_STATUS_LABELS[update.status] || update.status}
                        </span>
                        {update.respondedBy && <> · {update.respondedBy}</>}
                      </p>
                      {update.respondedAt && (
                        <p className="mt-0.5 text-[10px] text-slate-400">{relativeWhen(update.respondedAt)}</p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )
          ) : broadcasts.length === 0 ? (
            <EmptyState icon={Megaphone} text={dt('Nuk ka njoftime të përgjithshme për momentin.')} />
          ) : (
            <ul className="max-h-96 overflow-y-auto p-2">
              {broadcasts.map((n) => {
                const Icon = TYPE_ICON[n.type || 'info'] || Info;
                const tone = TYPE_TONE[n.type || 'info'] || TYPE_TONE.info;
                const unread = !generalRead.has(n.id);
                const body = (
                  <>
                    <div className="flex items-start gap-2.5">
                      <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border', tone)}>
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{n.title}</p>
                          {n.urgent && (
                            <span className="shrink-0 rounded bg-rose-600 px-1 text-[8px] font-black uppercase text-white">
                              {dt('Urgjente')}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                          {n.message}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                          <span>{relativeWhen(n.createdAt)}</span>
                          {n.link && <Link2 className="h-3 w-3" aria-hidden="true" />}
                        </div>
                      </div>
                      {unread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-hidden="true" />}
                    </div>
                  </>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        to={n.link}
                        onClick={() => {
                          markGeneralRead([n.id]);
                          setIsOpen(false);
                        }}
                        className="block rounded-xl px-2.5 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        {body}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markGeneralRead([n.id])}
                        className="block w-full rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Info; text: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <Icon className="mx-auto h-6 w-6 text-slate-300 dark:text-slate-600" />
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  );
}
