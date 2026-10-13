import React from 'react';
import { CheckCircle2, Mail, MapPin, Trash2, UserPlus } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../../lib/utils';
import type { Report } from '../../../types';
import { statusMeta, TONE_CLASSES } from '../../../lib/reportStatus';
import { dueInfo } from '../../../lib/reportQueue';
import { AgeText } from '../dashboard/DashboardParts';
import { RowMenu, type RowMenuItem } from './RowMenu';

/**
 * One report in the queue.
 *
 * Everything needed to decide what to do next is on the row — what, where, how
 * urgent, how late — and the whole row opens the report. There is one obvious
 * primary action ("Hap"); everything else is in the ⋯ menu. The status is a
 * badge, not an inline dropdown: the dropdown offered every status, including
 * moves the approval pipeline refuses, and the refusal arrived as an alert.
 * Changing status happens in the opened report, where the checklist and the
 * reason field are.
 */
export interface ReportRowProps {
  report: Report;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  now: number;
  dueAt: string;
  topicLabel: string;
  institution: string;
  /** Offered only while the report awaits its first review. */
  onApprove?: () => void;
  onEmail: () => void;
  hasContact: boolean;
  /** Permanent delete; omitted for roles that cannot delete. */
  onDelete?: () => void;
}

export function ReportRow({
  report,
  selected,
  onToggle,
  onOpen,
  now,
  dueAt,
  topicLabel,
  institution,
  onApprove,
  onEmail,
  hasContact,
  onDelete,
}: ReportRowProps) {
  const meta = statusMeta(report.status);
  const due = dueInfo(dueAt, report.status, now);
  const code = report.trackingId || `ZQ-${report.id.substring(0, 8).toUpperCase()}`;
  const municipality = report.location?.municipality;
  const isUrgent = report.urgency === 'Kritike' || report.urgency === 'E lartë';

  const menu: RowMenuItem[] = [
    {
      label: hasContact ? dt(`Dërgo email te komuna`) : dt(`Shto kontakt të komunës`),
      icon: hasContact ? Mail : UserPlus,
      onClick: onEmail,
    },
    ...(onDelete ? [{ label: dt(`Fshi raportin`), icon: Trash2, onClick: onDelete, danger: true }] : []),
  ];

  return (
    <li
      className={cn(
        'group flex items-start gap-3 px-3 py-3.5 transition-colors sm:px-4',
        selected ? 'bg-rose-50/60 dark:bg-rose-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        aria-label={`${dt(`Zgjidh`)} ${report.title}`}
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-rose-600"
      />

      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="line-clamp-2 text-sm font-bold text-slate-900 group-hover:text-rose-600 dark:text-white">{report.title}</span>
          {isUrgent && (
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                report.urgency === 'Kritike'
                  ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                  : 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300'
              )}
            >
              {dt(report.urgency)}
            </span>
          )}
        </span>

        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-mono text-[10px] font-semibold text-blue-600 dark:text-blue-400">{code}</span>
          {municipality && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {municipality}
              {report.location?.address ? <span className="max-w-[16rem] truncate"> · {report.location.address}</span> : null}
            </span>
          )}
          <span className="truncate">{topicLabel}</span>
          <span className="hidden truncate lg:inline">{institution}</span>
          {report.assignedToUid && report.assignedTo && ['Draft', 'Pending Review'].includes(report.status) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
              <UserPlus className="h-3 w-3" aria-hidden="true" /> {report.assignedTo}
            </span>
          )}
        </span>
      </button>

      <div className="hidden w-40 shrink-0 flex-col items-start gap-1 sm:flex">
        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold', TONE_CLASSES[meta.tone].badge)}>{meta.label}</span>
        {due.state !== 'none' && (
          <span
            className={cn(
              'text-[11px] font-semibold',
              due.state === 'overdue' ? 'text-red-600 dark:text-red-400' : due.state === 'soon' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
            )}
          >
            {due.state === 'overdue'
              ? `${dt(`Vonuar`)} ${due.days} ${dt(`ditë`)}`
              : due.state === 'soon'
                ? dt(`Afati sot`)
                : `${dt(`Afati`)}: ${due.days} ${dt(`ditë`)}`}
          </span>
        )}
        <span className="text-[11px] text-slate-400">
          <AgeText iso={report.createdAt} now={now} />
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {onApprove && (
          <button
            type="button"
            onClick={onApprove}
            title={dt(`Aprovo dhe dërgo te komuna`)}
            className="hidden h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 md:inline-flex dark:focus-visible:ring-offset-slate-900"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {dt(`Aprovo`)}
          </button>
        )}
        <button
          type="button"
          onClick={onOpen}
          className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition-colors hover:border-rose-300 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-white/10 dark:text-slate-200"
        >
          {dt(`Hap`)}
        </button>
        <RowMenu items={menu} />
      </div>
    </li>
  );
}
