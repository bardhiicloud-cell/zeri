import React from 'react';
import {
  AlarmClock, BadgeCheck, CheckCircle2, Clock, FileEdit, HelpCircle,
  Loader, Lock, UserCheck, XCircle,
} from 'lucide-react';
import type { ReportTimelineEvent } from '@/src/types';
import { statusLabel, statusMeta, TONE_CLASSES } from '@/src/lib/reportStatus';
import { ReportAttachments } from './ReportAttachments';

import { dt } from '@/src/lib/dt';
/**
 * The report lifecycle timeline.
 *
 * Every event shows what changed, when (date AND clock time), who changed it
 * (actor + institution, never a raw email), the before→after status, an
 * optional comment, the source of the change, and any attachments that were
 * submitted with that specific event. Used by both the public Track ID page
 * and the admin detail view so the two can never drift.
 */

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  FileEdit, Clock, CheckCircle2, UserCheck, Loader, BadgeCheck, XCircle, AlarmClock, Lock, HelpCircle,
};

const SOURCE_LABELS: Record<string, string> = {
  admin: 'Administrata',
  municipality: 'Komuna',
  agent: 'Agjenti',
  system: 'Sistemi',
  citizen: 'Qytetari',
};

const SQ_MONTHS = [
  'Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor',
  'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor',
];

/**
 * Formats deterministically in Albanian instead of relying on
 * `toLocaleDateString('sq-AL')`: browsers built without the sq ICU locale silently
 * fall back to English month names, which read as a bug to an Albanian user.
 */
function formatWhen(date: string): { day: string; time: string } {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return { day: date, time: '' };
  const day = `${String(d.getDate()).padStart(2, '0')} ${SQ_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { day, time };
}

export function ReportTimeline({ events }: { events: ReportTimelineEvent[] }) {
  if (!events || events.length === 0) {
    return (
      <p className="rounded-xl bg-(--color-surface-subtle) p-4 text-sm text-(--color-text-muted)">
        {dt('Raporti është regjistruar dhe pret shqyrtimin e parë.')}
      </p>
    );
  }

  return (
    <div className="relative space-y-5 pl-7">
      <span className="absolute left-[7px] top-2 bottom-2 w-0.5 rounded-full bg-(--color-border-soft)" aria-hidden="true" />
      {events.map((event) => {
        const meta = statusMeta(event.status);
        const Icon = ICONS[meta.icon] || HelpCircle;
        const tone = TONE_CLASSES[meta.tone];
        const { day, time } = formatWhen(event.date);

        return (
          <div key={event.id} className="relative">
            <span
              className={`absolute -left-7 top-1 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-(--color-page) ${tone.dot}`}
              aria-hidden="true"
            />
            <div className="rounded-2xl border border-(--color-border-soft) bg-(--color-surface) p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${tone.text}`} />
                  <span className="text-sm font-black text-(--color-text)">
                    {statusLabel(event.status)}
                  </span>
                </span>
                <span className="rounded-full bg-(--color-surface-subtle) px-2.5 py-0.5 text-[10px] font-bold text-(--color-text-muted)">
                  {day}{time ? ` · ${time}` : ''}
                </span>
              </div>

              {event.previousStatus && event.previousStatus !== event.status && (
                <p className="mt-2 text-[11px] font-semibold text-(--color-text-muted)">
                  {statusLabel(event.previousStatus)} <span aria-hidden="true">→</span>{' '}
                  <span className={tone.text}>{statusLabel(event.status)}</span>
                </p>
              )}

              <p className="mt-1 text-xs text-(--color-text-muted)">
                {event.actorInstitution ? `${event.actorInstitution}` : ''}
                {event.actorInstitution && event.updatedBy ? ' · ' : ''}
                {event.updatedBy}
                {event.source ? ` · ${SOURCE_LABELS[event.source] || event.source}` : ''}
              </p>

              {event.comment && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-(--color-text-muted)">
                  {event.comment}
                </p>
              )}

              {event.attachments && event.attachments.length > 0 && (
                <div className="mt-3">
                  <ReportAttachments media={event.attachments} title={undefined} layout="row" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ReportTimeline;
