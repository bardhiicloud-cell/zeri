import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

import { dt } from '@/src/lib/dt';
/**
 * Serious admin announcement popup.
 *
 * An admin sets `popupEnabled`, `popupTitle` and `popupMessage` on
 * `settings/general` and every visitor gets a full modal on load — for
 * maintenance notices, security alerts or urgent national information.
 *
 * Dismissal is remembered per-message in localStorage, so re-opening the page
 * does not re-nag — but a *new* message (different text) always shows. The
 * dismiss key is a hash of the message, not the doc id, because the doc is
 * edited in place by AdminSettings.
 */
const DISMISS_KEY = 'zeri_dismissed_popup_hash';

function hash(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return String(h);
}

function readDismissed(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

interface PopupSettings {
  popupEnabled?: boolean;
  popupTitle?: string;
  popupMessage?: string;
  popupSeverity?: 'info' | 'serious' | 'critical';
}

const SEVERITY_STYLES: Record<string, { icon: typeof ShieldAlert; ring: string; badge: string; badgeText: string }> = {
  info: { icon: ShieldAlert, ring: 'border-blue-300 dark:border-blue-800', badge: 'bg-blue-600', badgeText: 'Njoftim' },
  serious: { icon: AlertTriangle, ring: 'border-amber-300 dark:border-amber-800', badge: 'bg-amber-600', badgeText: 'I rëndësishëm' },
  critical: { icon: AlertTriangle, ring: 'border-rose-400 dark:border-rose-800', badge: 'bg-rose-600', badgeText: 'I menjëhershëm' },
};

export function SeriousAnnouncementPopup() {
  const [settings, setSettings] = useState<PopupSettings | null>(null);
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const [visible, setVisible] = useState(false);

  useEffect(() => onSnapshot(
    doc(db, 'settings', 'general'),
    (snap) => setSettings(snap.exists() ? (snap.data() as PopupSettings) : null),
    () => setSettings(null),
  ), []);

  useEffect(() => {
    if (!settings?.popupEnabled || !settings.popupMessage) {
      setVisible(false);
      return;
    }
    setVisible(!dismissed.includes(hash(settings.popupMessage)));
  }, [settings, dismissed]);

  const dismiss = () => {
    if (!settings?.popupMessage) return;
    const next = [...dismissed, hash(settings.popupMessage)].slice(-10);
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable; the popup simply reappears on the next load.
    }
    setVisible(false);
  };

  const severity = SEVERITY_STYLES[settings?.popupSeverity || 'info'] || SEVERITY_STYLES.info;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-label={settings?.popupTitle || 'Njoftim i platformës'}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className={`w-full max-w-md overflow-hidden rounded-3xl border bg-white shadow-2xl dark:bg-slate-900 ${severity.ring}`}
          >
            <div className={`${severity.badge} flex items-center gap-2 px-5 py-3 text-white`}>
              <severity.icon className="h-4 w-4" aria-hidden="true" />
              <span className="text-[10px] font-black uppercase tracking-[0.22em]">{severity.badgeText}</span>
              <button
                type="button"
                onClick={dismiss}
                aria-label={dt('Mbyll njoftimin')}
                className="ml-auto rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6">
              {settings?.popupTitle && (
                <h2 className="text-xl font-black leading-tight text-slate-900 dark:text-white">
                  {settings.popupTitle}
                </h2>
              )}
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {settings.popupMessage}
              </p>
              <button
                type="button"
                onClick={dismiss}
                className="mt-6 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                E kuptova
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
