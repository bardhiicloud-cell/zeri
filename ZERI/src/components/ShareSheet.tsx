import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Link2, Share2, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { dt } from '@/src/lib/dt';
import {
  SHARE_CHANNELS,
  canUseNativeShare,
  copyToClipboard,
  currentUrl,
  shareNatively,
  type ShareTarget,
} from '../lib/share';
import toast from 'react-hot-toast';

/**
 * The platform's share sheet.
 *
 * The previous share buttons copied `window.location.href` and showed a
 * "copied" toast. On this app that URL is the router root — it is a hash-routed
 * SPA, so every shared post, poll and article pointed at the dashboard and the
 * recipient had no idea what had been sent. This sheet sends *content*: the
 * title, an excerpt and a deep link to the specific item.
 *
 * On a phone the first tap goes straight to the OS share sheet, which is the
 * only route to the installed apps. On desktop, where that API does not exist,
 * the panel below lists the platforms' own web intents.
 */
export function ShareSheet({
  isOpen,
  onClose,
  target,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Everything needed to describe what is being shared. */
  target: ShareTarget;
}) {
  const [copied, setCopied] = useState(false);
  const nativeAvailable = canUseNativeShare(target);

  const handleNative = async () => {
    const result = await shareNatively(target);
    if (result === 'shared') {
      toast.success(dt('Faleminderit që e ndatë!'));
      onClose();
      return;
    }
    if (result === 'copied') {
      setCopied(true);
      toast.success(dt('Linku u kopjua — mund ta hidhni kudo.'));
      window.setTimeout(() => setCopied(false), 2200);
    }
    // 'dismissed' is a deliberate close of the OS sheet: say nothing.
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(currentUrl() && target.url);
    if (ok) {
      setCopied(true);
      toast.success(dt('Linku u kopjua.'));
      window.setTimeout(() => setCopied(false), 2200);
    } else {
      toast.error(dt('Nuk u kopjua dot. Kopjojeni manualisht.'));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={dt('Shpërndaj')}
          className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center sm:p-4"
        >
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-label={dt('Mbyll')}
            className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', duration: 0.28, bounce: 0 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900 dark:text-white">
                    {dt('Shpërndaj')}
                  </p>
                  <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {target.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={dt('Mbyll')}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5">
              {nativeAvailable && (
                <button
                  type="button"
                  onClick={handleNative}
                  className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-black text-white transition-all hover:brightness-110 active:scale-[0.98]"
                >
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                  {dt('Hap menunë e shpërndarjes')}
                </button>
              )}

              <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                {nativeAvailable ? dt('Ose zgjidh një platformë') : dt('Zgjidh një platformë')}
              </p>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {SHARE_CHANNELS.map((channel) => (
                  <a
                    key={channel.id}
                    href={channel.href(target)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      // The provider opens in a new tab; close the sheet behind it
                      // so returning to the app does not land on a stale overlay.
                      window.setTimeout(onClose, 150);
                    }}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-2 py-3 text-center transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/50 dark:border-white/10 dark:bg-slate-800/60 dark:hover:border-blue-500/40 dark:hover:bg-slate-800"
                  >
                    <Share2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                      {channel.label}
                    </span>
                  </a>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  'mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black transition-colors',
                  copied
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800'
                )}
              >
                {copied ? (
                  <><Check className="h-4 w-4" aria-hidden="true" />{dt('Linku u kopjua')}</>
                ) : (
                  <><Link2 className="h-4 w-4" aria-hidden="true" />{dt('Kopjo linkun')}</>
                )}
              </button>

              <p className="mt-3 truncate rounded-xl bg-slate-50 px-3 py-2 font-mono text-[10px] text-slate-400 dark:bg-slate-800/60">
                {target.url}
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
