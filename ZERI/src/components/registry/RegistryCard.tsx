import React from 'react';
import { Image as ImageIcon, Layers, MapPin, MessageCircle, Play, Share2, ThumbsUp } from 'lucide-react';
import { format } from 'date-fns';
import { sq } from 'date-fns/locale';
import type { Report } from '../../types';
import { cn } from '../../lib/utils';
import { getReportTopic } from '../../lib/reportTopics';
import { statusLabel, statusMeta, TONE_CLASSES } from '../../lib/reportStatus';
import { trackingIdOf } from '../../lib/trackingId';

interface RegistryCardProps {
  report: Report;
  dt: (text: string) => string;
  onOpen: () => void;
  onShare: (event: React.MouseEvent, title: string, id: string) => void;
}

export { trackingIdOf };

/** The first photo or video of a report, whichever field it lives in. */
export function reportCover(report: Report): { url: string; type: 'image' | 'video' } | null {
  const media = report.media?.find(item => item?.url && (item.type === 'image' || item.type === 'video'));
  if (media) return { url: media.url, type: media.type as 'image' | 'video' };
  const image = report.images?.find(Boolean);
  return image ? { url: image, type: 'image' } : null;
}

export function formatReportDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : format(date, 'dd MMM yyyy', { locale: sq });
}

/** Status pill that follows the platform-wide status vocabulary and colours. */
export function StatusPill({ status, className }: { status: string; className?: string }) {
  const tone = TONE_CLASSES[statusMeta(status).tone];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black', tone.badge, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}

/** Photos and videos attached to a report, for the small media badge. */
export function mediaCount(report: Report): number {
  const media = report.media?.filter(item => item?.url && (item.type === 'image' || item.type === 'video')).length ?? 0;
  return media || (report.images?.filter(Boolean).length ?? 0);
}

/** Pulse-free urgency marker: shown only when it needs attention. */
export function UrgencyTag({ urgency, dt }: { urgency: string; dt: (text: string) => string }) {
  if (urgency !== 'Kritike' && urgency !== 'E lartë') return null;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide', urgency === 'Kritike' ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200')}>
      {dt(urgency)}
    </span>
  );
}

/**
 * One report as a card. The whole card is a single target: the title is a
 * button stretched over the card, so a click anywhere opens the report and
 * keyboard users get exactly one tab stop. Share sits above it.
 */
export function RegistryCard({ report, dt, onOpen, onShare }: RegistryCardProps) {
  const cover = reportCover(report);
  const topic = getReportTopic(report);
  const count = mediaCount(report);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white transition duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-xl hover:shadow-slate-900/5 dark:border-white/10 dark:bg-slate-900 dark:hover:border-blue-500/50">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        {cover?.type === 'image' ? (
          <img src={cover.url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
        ) : cover?.type === 'video' ? (
          <video src={cover.url} className="h-full w-full object-cover" muted playsInline preload="metadata" aria-label={dt('Video e raportimit')} />
        ) : (
          <span className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-100 to-blue-50 text-5xl dark:from-slate-800 dark:to-slate-900" aria-hidden="true">
            {topic?.icon ?? <Layers className="h-10 w-10 text-slate-300" />}
          </span>
        )}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/40 to-transparent" />
        <StatusPill status={report.status} className="absolute left-3 top-3 border-white/60 bg-white/95 shadow-sm backdrop-blur dark:bg-slate-900/90" />
        {count > 0 && (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-slate-950/65 px-2 py-1 text-[11px] font-bold text-white backdrop-blur">
            {cover?.type === 'video' ? <Play className="h-3 w-3 fill-white" aria-hidden="true" /> : <ImageIcon className="h-3 w-3" aria-hidden="true" />}{count}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{report.location?.municipality || 'Kosovë'}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{topic ? `${topic.icon} ${topic.label}` : dt(report.category)}</span>
          <UrgencyTag urgency={report.urgency} dt={dt} />
        </div>

        <h3 className="mt-2.5 text-lg font-black leading-snug tracking-tight text-slate-950 dark:text-white">
          <button type="button" onClick={onOpen} aria-label={`${dt('Hap raportimin')} ${report.title}`} className="line-clamp-2 text-left transition-colors after:absolute after:inset-0 after:content-[''] group-hover:text-blue-700 dark:group-hover:text-blue-300">{report.title}</button>
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{report.description}</p>

        <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-xs font-bold text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3.5">
            <span className="font-mono text-[11px] text-slate-400">#{trackingIdOf(report)}</span>
            <span className="inline-flex items-center gap-1" title={dt('Pëlqime')}><ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />{report.upvotes || 0}</span>
            <span className="inline-flex items-center gap-1" title={dt('Komente')}><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />{report.commentsCount || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <time dateTime={report.createdAt}>{formatReportDate(report.createdAt)}</time>
            <button type="button" onClick={event => onShare(event, report.title, report.id)} className="relative z-10 grid h-9 w-9 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-blue-700 dark:hover:bg-slate-800" aria-label={dt('Shpërndaj')} title={dt('Shpërndaj')}>
              <Share2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default RegistryCard;
