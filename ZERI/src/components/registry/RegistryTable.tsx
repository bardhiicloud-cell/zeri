import React from 'react';
import { Layers, Share2, ThumbsUp } from 'lucide-react';
import type { Report } from '../../types';
import { getReportTopic } from '../../lib/reportTopics';
import { formatReportDate, reportCover, StatusPill, trackingIdOf } from './RegistryCard';

interface RegistryTableProps {
  reports: Report[];
  dt: (text: string) => string;
  onOpen: (id: string) => void;
  onShare: (event: React.MouseEvent, title: string, id: string) => void;
}

/**
 * Dense, scannable table for wide screens. The row itself is the primary target
 * (one click opens the report); the share button is the only nested control.
 */
export function RegistryTable({ reports, dt, onOpen, onShare }: RegistryTableProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-slate-900">
      <table className="w-full table-fixed text-left text-sm">
        <caption className="sr-only">{dt('Regjistri i raportimeve publike')}</caption>
        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            <th scope="col" className="w-[38%] px-5 py-3.5">{dt('Raportimi')}</th>
            <th scope="col" className="w-[13%] px-3 py-3.5">{dt('Statusi')}</th>
            <th scope="col" className="w-[15%] px-3 py-3.5">{dt('Komuna')}</th>
            <th scope="col" className="w-[13%] px-3 py-3.5">{dt('Data')}</th>
            <th scope="col" className="w-[9%] px-3 py-3.5 text-right">{dt('Pëlqime')}</th>
            <th scope="col" className="w-[12%] px-5 py-3.5"><span className="sr-only">{dt('Veprime')}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {reports.map(report => {
            const cover = reportCover(report);
            const topic = getReportTopic(report);
            return (
              <tr key={report.id} onClick={() => onOpen(report.id)} className="group cursor-pointer transition-colors hover:bg-blue-50/50 dark:hover:bg-white/[0.03]">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3.5">
                    <span className="grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                      {cover?.type === 'image' ? <img src={cover.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                        : <span className="text-xl" aria-hidden="true">{topic?.icon ?? <Layers className="h-5 w-5 text-slate-400" />}</span>}
                    </span>
                    <div className="min-w-0">
                      <button type="button" onClick={event => { event.stopPropagation(); onOpen(report.id); }} className="block max-w-full truncate text-left font-black text-slate-950 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">{report.title}</button>
                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400"><span className="font-mono font-bold text-blue-700 dark:text-blue-300">#{trackingIdOf(report)}</span> · {dt(report.category)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3.5"><StatusPill status={report.status} /></td>
                <td className="px-3 py-3.5"><p className="truncate font-bold text-slate-800 dark:text-slate-200">{report.location?.municipality || 'Kosovë'}</p><p className="truncate text-xs text-slate-500">{report.location?.address || ''}</p></td>
                <td className="px-3 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300">{formatReportDate(report.createdAt)}</td>
                <td className="px-3 py-3.5 text-right"><span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300"><ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />{report.upvotes || 0}</span></td>
                <td className="px-5 py-3.5">
                  <div className="flex justify-end">
                    <button type="button" onClick={event => onShare(event, report.title, report.id)} aria-label={dt('Shpërndaj')} title={dt('Shpërndaj')} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-blue-400 hover:text-blue-700 dark:border-white/10">
                      <Share2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default RegistryTable;
