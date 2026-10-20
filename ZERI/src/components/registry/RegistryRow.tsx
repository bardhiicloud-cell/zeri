import React from 'react';
import { Image as ImageIcon, Layers, MapPin, MessageCircle, Play, Share2, ThumbsUp } from 'lucide-react';
import type { Report } from '../../types';
import { getReportTopic } from '../../lib/reportTopics';
import { formatReportDate, mediaCount, reportCover, StatusPill, trackingIdOf, UrgencyTag } from './RegistryCard';

interface RegistryRowProps {
  report: Report;
  dt: (text: string) => string;
  onOpen: () => void;
  onShare: (event: React.MouseEvent, title: string, id: string) => void;
}

/** A report as one compact row. Like the card, the title is stretched over the row as its only tab stop. */
export function RegistryRow({ report, dt, onOpen, onShare }: RegistryRowProps) {
  const cover = reportCover(report);
  const topic = getReportTopic(report);
  const count = mediaCount(report);

  return (
    <article className="group relative flex gap-4 border-b border-slate-100 p-4 transition-colors last:border-b-0 hover:bg-blue-50/40 dark:border-white/10 dark:hover:bg-white/[0.03] sm:p-5">
      <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800 sm:h-28 sm:w-40">
        {cover?.type === 'image' ? (
          <img src={cover.url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : cover?.type === 'video' ? (
          <video src={cover.url} className="h-full w-full object-cover" muted playsInline preload="metadata" aria-label={dt('Video e raportimit')} />
        ) : (
          <span className="grid h-full w-full place-items-center text-3xl text-slate-300" aria-hidden="true">{topic?.icon ?? <Layers className="h-8 w-8" />}</span>
        )}
        {count > 0 && (
          <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-slate-950/65 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">
            {cover?.type === 'video' ? <Play className="h-2.5 w-2.5 fill-white" aria-hidden="true" /> : <ImageIcon className="h-2.5 w-2.5" aria-hidden="true" />}{count}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={report.status} />
          <UrgencyTag urgency={report.urgency} dt={dt} />
          <span className="font-mono text-[11px] font-bold text-slate-400">#{trackingIdOf(report)}</span>
        </div>
        <h3 className="mt-2 text-base font-black leading-snug tracking-tight text-slate-950 dark:text-white sm:text-lg">
          <button type="button" onClick={onOpen} aria-label={`${dt('Hap raportimin')} ${report.title}`} className="line-clamp-2 text-left transition-colors after:absolute after:inset-0 after:content-[''] group-hover:text-blue-700 dark:group-hover:text-blue-300">{report.title}</button>
        </h3>
        <p className="mt-1 line-clamp-1 text-sm text-slate-600 dark:text-slate-400 sm:line-clamp-2">{report.description}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{report.location?.municipality || 'Kosovë'}</span>
          <time dateTime={report.createdAt}>{formatReportDate(report.createdAt)}</time>
          <span className="inline-flex items-center gap-1" title={dt('Pëlqime')}><ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />{report.upvotes || 0}</span>
          <span className="inline-flex items-center gap-1" title={dt('Komente')}><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />{report.commentsCount || 0}</span>
        </div>
      </div>

      <button type="button" onClick={event => onShare(event, report.title, report.id)} className="relative z-10 hidden h-10 w-10 shrink-0 place-items-center self-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-blue-700 dark:hover:bg-slate-800 sm:grid" aria-label={dt('Shpërndaj')} title={dt('Shpërndaj')}>
        <Share2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </article>
  );
}
