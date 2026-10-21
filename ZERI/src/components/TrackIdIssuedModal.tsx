import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Copy, X } from 'lucide-react';
import { dt } from '../lib/dt';

interface TrackIdIssuedModalProps {
  /** The stored Track ID; the modal is hidden while it is null. */
  trackingId: string | null;
  title: string;
  /** What happens next, in one or two sentences. */
  note: string;
  onClose: () => void;
}

/**
 * The confirmation every sector shows once a submission is stored: the Track ID
 * stays on screen until the citizen closes it, with copy and "follow" actions.
 * A toast that vanished after a few seconds was the only place some sectors
 * printed the code, so citizens lost it before writing it down.
 */
export function TrackIdIssuedModal({ trackingId, title, note, onClose }: TrackIdIssuedModalProps) {
  const [copied, setCopied] = useState(false);
  if (!trackingId) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(trackingId);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 md:backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="trackid-issued-title">
      <div className="relative w-full max-w-md rounded-3xl border border-emerald-200 bg-white p-7 text-center shadow-2xl dark:border-emerald-500/30 dark:bg-slate-900">
        <button type="button" onClick={onClose} aria-label={dt('Mbyll')} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" />
        <h2 id="trackid-issued-title" className="mt-3 text-xl font-black text-slate-900 dark:text-white">{title}</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{note}</p>
        <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{dt('Track ID')}</p>
        <p className="mt-1 break-all font-mono text-2xl font-black tracking-wider text-slate-900 dark:text-white" data-testid="issued-tracking-id">{trackingId}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={copy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-800 dark:border-white/10 dark:text-white">
            <Copy className="h-4 w-4" aria-hidden="true" />{copied ? dt('U kopjua') : dt('Kopjo kodin')}
          </button>
          <Link to={`/trackid?id=${encodeURIComponent(trackingId)}`} onClick={onClose} className="inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-4 text-sm font-bold text-white">
            {dt('Ndiq statusin')}
          </Link>
        </div>
        <p className="mt-5 text-xs text-slate-500">{dt('Ruajeni këtë kod. Kodi ruhet edhe në këtë pajisje te faqja Track ID.')}</p>
      </div>
    </div>
  );
}
