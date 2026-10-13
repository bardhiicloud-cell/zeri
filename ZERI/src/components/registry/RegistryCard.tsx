import React from 'react';
import { Calendar, Layers, MapPin, MessageCircle, Share2, ThumbsUp, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { sq } from 'date-fns/locale';
import type { Report } from '../../types';
import { cn } from '../../lib/utils';
import { getReportTopic } from '../../lib/reportTopics';
import { statusLabel, statusMeta, TONE_CLASSES } from '../../lib/reportStatus';

interface RegistryCardProps {
  report: Report;
  dt: (text: string) => string;
  onOpen: () => void;
  onShare: (event: React.MouseEvent, title: string, id: string) => void;
}

export const trackingIdOf = (report: Report) => report.trackingId || `ZQ-${report.id.substring(0, 8).toUpperCase()}`;

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

export function RegistryCard({ report, dt, onOpen, onShare }: RegistryCardProps) {
  const cover = reportCover(report);
  const topic = getReportTopic(report);
  const critical = report.urgency === 'Kritike' || report.urgency === 'E lartë';

  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs transition duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl dark:border-white/10 dark:bg-slate-900 dark:hover:border-blue-500/50">
      <button type="button" onClick={onOpen} aria-label={`${dt('Hap raportimin')} ${report.title}`} className="relative block aspect-[16/10] w-full overflow-hidden bg-slate-100 text-left dark:bg-slate-800">
        {cover?.type === 'image' ? (
          <img src={cover.url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
        ) : cover?.type === 'video' ? (
          <video src={cover.url} className="h-full w-full object-cover" muted playsInline preload="metadata" aria-label={dt('Video e raportimit')} />
        ) : (
          <span className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200 text-4xl dark:from-slate-800 dark:via-slate-800 dark:to-slate-900" aria-hidden="true">
            {topic?.icon ?? <Layers className="h-9 w-9 text-slate-400" />}
          </span>
        )}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/55 to-transparent" />
        <StatusPill status={report.status} className="absolute left-3 top-3 border-white/60 bg-white/95 shadow-sm backdrop-blur dark:bg-slate-900/90" />
        {critical && (
          <span className="absolute right-3 top-3 rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">{dt(report.urgency)}</span>
        )}
        <span className="absolute bottom-3 left-3 rounded-md bg-slate-950/70 px-2 py-1 font-mono text-[10px] font-bold text-white backdrop-blur">#{trackingIdOf(report)}</span>
      </button>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          {topic && <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200">{topic.icon} {topic.label}</span>}
          <span className="max-w-[11rem] truncate text-slate-500 dark:text-slate-400">{dt(report.category)}</span>
        </div>

        <h3 className="mt-3 text-lg font-black leading-snug tracking-tight text-slate-950 dark:text-white">
          <button type="button" onClick={onOpen} className="line-clamp-2 text-left transition-colors group-hover:text-blue-700 dark:group-hover:text-blue-300">{report.title}</button>
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{report.description}</p>

        <dl className="mt-4 space-y-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /><dd className="min-w-0 truncate">{report.location?.municipality || 'Kosovë'}{report.location?.address ? ` · ${report.location.address}` : ''}</dd></div>
          {report.responsibleInstitution && <div className="flex items-start gap-2"><Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /><dd className="min-w-0 truncate">{dt(report.responsibleInstitution)}</dd></div>}
          <div className="flex items-start gap-2"><Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /><dd>{formatReportDate(report.createdAt)}</dd></div>
        </dl>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-white/10" style={{ marginTop: '1.25rem' }}>
          <div className="flex items-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5" title={dt('Pëlqime')}><ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />{report.upvotes || 0}</span>
            <span className="inline-flex items-center gap-1.5" title={dt('Komente')}><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />{report.commentsCount || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={event => onShare(event, report.title, report.id)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-blue-400 hover:text-blue-700 dark:border-white/10" aria-label={dt('Shpërndaj')} title={dt('Shpërndaj')}>
              <Share2 className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={onOpen} className="inline-flex h-10 items-center rounded-xl bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-blue-700 dark:bg-white dark:text-slate-900 dark:hover:bg-blue-200">{dt('Hap')}</button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default RegistryCard;
