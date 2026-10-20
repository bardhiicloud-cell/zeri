import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import type { Report } from '../../types';
import { cn } from '../../lib/utils';
import { getReportTopic } from '../../lib/reportTopics';
import { statusLabel, statusMeta, TONE_CLASSES } from '../../lib/reportStatus';
import { scopeKey } from '../../lib/municipalityScope';

interface RegistryInsightsProps {
  reports: Report[];
  dt: (text: string) => string;
  activeMunicipality: string;
  activeTopic: string;
  onMunicipality: (municipality: string) => void;
  onTopic: (topicId: string) => void;
}

const STATUS_ORDER = ['Approved', 'Assigned', 'In Progress', 'Overdue', 'Resolved', 'Closed'];

function tally<T>(items: T[], keyOf: (item: T) => string | undefined): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/**
 * A summary of exactly the reports the visitor is looking at: the same filtered
 * list the cards show, so the numbers never describe a different set. Every bar
 * is a control: clicking a municipality or topic narrows the registry to it.
 */
export function RegistryInsights({ reports, dt, activeMunicipality, activeTopic, onMunicipality, onTopic }: RegistryInsightsProps) {
  const { statuses, municipalities, topics } = useMemo(() => ({
    statuses: STATUS_ORDER
      .map(status => ({ status, count: reports.filter(report => report.status === status).length }))
      .filter(item => item.count > 0),
    municipalities: tally(reports, report => report.location?.municipality).slice(0, 6),
    topics: tally(reports, report => getReportTopic(report)?.id).slice(0, 6),
  }), [reports]);

  if (reports.length === 0) return null;
  const maxMunicipality = municipalities[0]?.[1] ?? 1;
  const maxTopic = topics[0]?.[1] ?? 1;

  return (
    <section aria-label={dt('Pamje e përgjithshme e rezultateve')} className="grid gap-4 lg:grid-cols-[1.1fr_1fr_1fr]">
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white"><BarChart3 className="h-4 w-4 text-blue-700 dark:text-blue-300" aria-hidden="true" />{dt('Statuset')}</h2>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="img" aria-label={statuses.map(item => `${statusLabel(item.status)}: ${item.count}`).join(', ')}>
          {statuses.map(item => (
            <span key={item.status} className={cn('h-full', TONE_CLASSES[statusMeta(item.status).tone].dot)} style={{ width: `${(item.count / reports.length) * 100}%` }} />
          ))}
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
          {statuses.map(item => (
            <li key={item.status} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2 font-bold text-slate-600 dark:text-slate-300"><span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', TONE_CLASSES[statusMeta(item.status).tone].dot)} aria-hidden="true" /><span className="truncate">{statusLabel(item.status)}</span></span>
              <span className="font-black tabular-nums text-slate-900 dark:text-white">{item.count}</span>
            </li>
          ))}
        </ul>
      </div>

      <BarList
        title={dt('Komunat me më shumë raportime')}
        items={municipalities.map(([name, count]) => ({ id: name, label: name, count }))}
        max={maxMunicipality}
        activeId={activeMunicipality ? municipalities.find(([name]) => scopeKey(name) === scopeKey(activeMunicipality))?.[0] : undefined}
        onPick={onMunicipality}
        dt={dt}
      />
      <BarList
        title={dt('Temat kryesore')}
        items={topics.map(([id, count]) => {
          const topic = getReportTopic({ topicCategory: id });
          return { id, label: `${topic?.icon ?? ''} ${topic?.label ?? id}`.trim(), count };
        })}
        max={maxTopic}
        activeId={activeTopic || undefined}
        onPick={onTopic}
        dt={dt}
      />
    </section>
  );
}

function BarList({ title, items, max, activeId, onPick, dt }: {
  title: string;
  items: Array<{ id: string; label: string; count: number }>;
  max: number;
  activeId?: string;
  onPick: (id: string) => void;
  dt: (text: string) => string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
      <h2 className="text-sm font-black text-slate-900 dark:text-white">{title}</h2>
      <ul className="mt-4 space-y-2">
        {items.map(item => {
          const active = activeId === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onPick(active ? '' : item.id)}
                aria-pressed={active}
                title={active ? dt('Hiq filtrin') : dt('Filtro sipas kësaj')}
                className={cn('group relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-xl px-3 py-2 text-left text-xs transition', active ? 'ring-2 ring-blue-500' : 'hover:bg-slate-50 dark:hover:bg-white/5')}
              >
                <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 rounded-xl', active ? 'bg-blue-200/70 dark:bg-blue-500/25' : 'bg-blue-100/70 dark:bg-blue-500/15')} style={{ width: `${Math.max(6, (item.count / max) * 100)}%` }} />
                <span className="relative min-w-0 truncate font-bold text-slate-800 dark:text-slate-100">{item.label}</span>
                <span className="relative font-black tabular-nums text-slate-900 dark:text-white">{item.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default RegistryInsights;
