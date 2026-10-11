import React from 'react';
import { Calendar, ChevronRight, Layers, MapPin, MessageCircle, Share2, ThumbsUp } from 'lucide-react';
import { format } from 'date-fns';
import { sq } from 'date-fns/locale';
import { Report } from '../../types';
import { cn } from '../../lib/utils';
import { getReportTopic } from '../../lib/reportTopics';

interface RegistryRowProps {
  report: Report;
  dt: (text: string) => string;
  onOpen: () => void;
  onShare: (event: React.MouseEvent, title: string, id: string) => void;
}

const statusMeta: Record<string, { label: string; tone: string }> = {
  Approved: { label: 'Aprovuar', tone: 'bg-blue-500' },
  Assigned: { label: 'Caktuar', tone: 'bg-blue-500' },
  'In Progress': { label: 'Në proces', tone: 'bg-(--color-brand-accent)' },
  Resolved: { label: 'Zgjidhur', tone: 'bg-(--color-brand-success)' },
};

export function RegistryRow({ report, dt, onOpen, onShare }: RegistryRowProps) {
  const status = statusMeta[report.status] || statusMeta.Approved;
  const urgencyTone = report.urgency === 'Kritike' ? 'text-rose-700 dark:text-rose-300' : report.urgency === 'E lartë' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400';
  const mediaUrl = report.media?.[0]?.url || report.images?.[0];
  const mediaType = report.media?.[0]?.type || 'image';
  const trackingId = report.trackingId || `ZQ-${report.id.substring(0, 8).toUpperCase()}`;
  const reportTopic = getReportTopic(report);

  return (
    <article className="group grid gap-4 border-b border-(--color-border-soft) p-4 transition-colors last:border-b-0 hover:bg-(--color-surface-subtle)/55 sm:grid-cols-[84px_minmax(0,1fr)_auto] sm:items-center sm:p-5 lg:grid-cols-[144px_minmax(0,1fr)_auto] dark:border-white/10">
      <button type="button" onClick={onOpen} className="relative h-[84px] w-[84px] overflow-hidden rounded-[10px] bg-(--color-surface-subtle) text-left lg:h-[108px] lg:w-[144px]" aria-label={`Hap raportimin ${report.title}`}>
        {mediaUrl && mediaType === 'image' ? (
          <img src={mediaUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : mediaUrl && mediaType === 'video' ? (
          <video src={mediaUrl} className="h-full w-full object-cover" muted playsInline aria-label="Video e raportimit" />
        ) : (
          <span className="grid h-full w-full place-items-center text-slate-400"><Layers className="h-8 w-8" aria-hidden="true" /></span>
        )}
      </button>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', status.tone)} aria-hidden="true" />{dt(status.label)}</span>
          <span className={cn('font-semibold', urgencyTone)}>{dt(report.urgency)}</span>
          {reportTopic && <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200">{reportTopic.icon} {reportTopic.label}</span>}
          <span className="max-w-[12rem] truncate font-semibold text-slate-600 dark:text-slate-300">{dt(report.category)}</span>
          <span className="font-mono tabular-nums text-(--color-brand-primary)">#{trackingId}</span>
        </div>
        <button type="button" onClick={onOpen} className="mt-1 block max-w-full truncate text-left text-base font-black tracking-tight text-(--color-text) underline-offset-4 transition-colors group-hover:text-(--color-brand-primary) group-hover:underline dark:text-white sm:text-lg">{report.title}</button>
        <p className="mt-1 line-clamp-2 max-w-3xl text-sm leading-relaxed text-(--color-text-muted) dark:text-slate-400">{report.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" aria-hidden="true" />{format(new Date(report.createdAt), 'dd MMM yyyy', { locale: sq })}</span>
          <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{report.location?.municipality || 'Kosovë'}{report.location?.address ? ` · ${report.location.address}` : ''}</span>
          {report.responsibleInstitution && <span className="max-w-[17rem] truncate">{dt(report.responsibleInstitution)}</span>}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
        <div className="flex items-center gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5" title={dt('Pëlqime')}><ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />{report.upvotes || 0}</span>
          <span className="inline-flex items-center gap-1.5" title={dt('Komente')}><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />{report.commentsCount || 0}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={(event) => onShare(event, report.title, report.id)} className="grid min-h-10 min-w-10 place-items-center rounded-[10px] border border-(--color-border-soft) text-slate-500 transition-colors hover:border-(--color-brand-primary) hover:text-(--color-brand-primary) dark:border-white/10" aria-label={dt('Shpërndaj')} title={dt('Shpërndaj')}>
            <Share2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={onOpen} className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] bg-(--color-brand-dark) px-3 text-xs font-black text-white transition-colors hover:bg-(--color-brand-primary)" aria-label={`Hap raportimin ${report.title}`}>
            <span className="hidden sm:inline">Hap</span><ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
