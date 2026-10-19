import React from 'react';
import { ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { dt } from '@/src/lib/dt';
import { cn } from '../../../lib/utils';
import { ageOf } from '../../../lib/adminDashboardMetrics';
import type { ServiceHealth } from '../../../lib/useServiceHealth';

/**
 * Presentational building blocks for the admin dashboard.
 *
 * Nothing here reads a store or talks to Firestore: every figure arrives as a
 * prop, so the same card can show an exact server count, a sample-based lower
 * bound or a loading skeleton without knowing which, and the data rules live in
 * one place (AdminDashboard + adminDashboardMetrics) instead of in the markup.
 */

export type Tone = 'rose' | 'red' | 'amber' | 'emerald' | 'sky' | 'blue' | 'purple' | 'slate';
export type Icon = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

// Full class names, never assembled from fragments: Tailwind only emits the
// classes it can find as literal strings in the source.
const TONE: Record<Tone, { chip: string; icon: string; text: string; bar: string; ring: string }> = {
  rose: {
    chip: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    icon: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400',
    text: 'text-rose-600 dark:text-rose-400',
    bar: 'bg-rose-500',
    ring: 'border-rose-200 dark:border-rose-500/30',
  },
  red: {
    chip: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    icon: 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400',
    text: 'text-red-600 dark:text-red-400',
    bar: 'bg-red-500',
    ring: 'border-red-200 dark:border-red-500/30',
  },
  amber: {
    chip: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    icon: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
    text: 'text-amber-600 dark:text-amber-400',
    bar: 'bg-amber-500',
    ring: 'border-amber-200 dark:border-amber-500/30',
  },
  emerald: {
    chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    text: 'text-emerald-600 dark:text-emerald-400',
    bar: 'bg-emerald-500',
    ring: 'border-emerald-200 dark:border-emerald-500/30',
  },
  sky: {
    chip: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
    icon: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400',
    text: 'text-sky-600 dark:text-sky-400',
    bar: 'bg-sky-500',
    ring: 'border-sky-200 dark:border-sky-500/30',
  },
  blue: {
    chip: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    icon: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
    text: 'text-blue-600 dark:text-blue-400',
    bar: 'bg-blue-500',
    ring: 'border-blue-200 dark:border-blue-500/30',
  },
  purple: {
    chip: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
    icon: 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400',
    text: 'text-purple-600 dark:text-purple-400',
    bar: 'bg-purple-500',
    ring: 'border-purple-200 dark:border-purple-500/30',
  },
  slate: {
    chip: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    icon: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    text: 'text-slate-500 dark:text-slate-400',
    bar: 'bg-slate-400',
    ring: 'border-slate-200 dark:border-white/10',
  },
};

export const toneText = (tone: Tone) => TONE[tone].text;

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900';

const formatNumber = (value: number) => value.toLocaleString('sq');

/** A figure that may be exact, a lower bound, still loading, or unreadable. */
export interface Figure {
  value: number | null;
  /** True when the number is a lower bound taken from a partial sample. */
  atLeast?: boolean;
  /** The viewer's role (or the network) cannot supply this figure at all. */
  unavailable?: boolean;
}

export const LOADING: Figure = { value: null };
export const UNAVAILABLE: Figure = { value: null, unavailable: true };

export function FigureText({ figure, className }: { figure: Figure; className?: string }) {
  if (figure.unavailable) {
    return <span className={className} title={dt(`Ky numër nuk është i disponueshëm tani.`)}>–</span>;
  }
  if (figure.value === null) {
    return <span className={cn('inline-block h-7 w-14 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700', className)} aria-label={dt(`Duke ngarkuar`)} />;
  }
  // "At least 0" says nothing a plain 0 does not, so only a positive lower
  // bound is marked.
  const isLowerBound = Boolean(figure.atLeast) && figure.value > 0;
  return (
    <span
      className={className}
      title={isLowerBound ? dt(`Numër i pjesshëm: llogaritet vetëm nga raportet e ngarkuara, jo nga i gjithë regjistri.`) : undefined}
    >
      {isLowerBound && <span aria-hidden="true">≥ </span>}
      {isLowerBound && <span className="sr-only">{dt(`të paktën`)} </span>}
      {formatNumber(figure.value)}
    </span>
  );
}

export function Panel({
  title,
  icon: PanelIcon,
  iconClassName = 'text-rose-600',
  action,
  children,
  className,
}: {
  title: string;
  icon?: Icon;
  iconClassName?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900', className)}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          {PanelIcon && <PanelIcon className={cn('h-4 w-4 shrink-0', iconClassName)} aria-hidden={true} />}
          <span className="truncate">{title}</span>
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}

export function StatCard({
  label,
  figure,
  icon: CardIcon,
  tone,
  chip,
  footer,
  cta,
  onClick,
}: {
  label: string;
  figure: Figure;
  icon: Icon;
  tone: Tone;
  chip?: { text: string; tone: Tone } | null;
  footer: React.ReactNode;
  cta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-xs transition hover:shadow-md dark:border-white/10 dark:bg-slate-900',
        FOCUS_RING
      )}
    >
      <span className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
        <span className={cn('rounded-xl p-2 transition-transform motion-safe:group-hover:scale-110', TONE[tone].icon)}>
          <CardIcon className="h-4 w-4" aria-hidden={true} />
        </span>
      </span>
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <FigureText figure={figure} className="text-3xl font-extrabold text-slate-900 dark:text-white" />
        {chip && <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', TONE[chip.tone].chip)}>{chip.text}</span>}
      </span>
      <span className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-white/5 dark:text-slate-400">
        <span className="min-w-0 truncate">{footer}</span>
        <span className={cn('flex shrink-0 items-center font-bold transition-transform motion-safe:group-hover:translate-x-0.5', TONE[tone].text)}>
          {cta} <ChevronRight className="h-3 w-3" aria-hidden={true} />
        </span>
      </span>
    </button>
  );
}

export function AttentionTile({
  label,
  figure,
  icon: TileIcon,
  tone,
  hint,
  onClick,
}: {
  label: string;
  figure: Figure;
  icon: Icon;
  tone: Tone;
  hint: string;
  onClick: () => void;
}) {
  // Only a positive number is "something to do"; zero, loading and unreadable
  // all render quiet so a tile never shouts without a reason.
  const active = (figure.value ?? 0) > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors sm:gap-3 sm:p-3',
        active
          ? cn('bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800', TONE[tone].ring)
          : 'border-slate-200/70 bg-slate-50/60 hover:bg-slate-100 dark:border-white/5 dark:bg-slate-900/50 dark:hover:bg-slate-800/60',
        FOCUS_RING
      )}
    >
      <span className={cn('shrink-0 rounded-lg p-2', active ? TONE[tone].icon : TONE.slate.icon)}>
        <TileIcon className="h-4 w-4" aria-hidden={true} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-xl font-black leading-none', active ? TONE[tone].text : 'text-slate-400 dark:text-slate-500')}>
          <FigureText figure={figure} className="" />
        </span>
        <span className={cn('mt-1 block line-clamp-2 text-[11px] font-semibold leading-snug', active ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500')}>
          {label}
        </span>
      </span>
    </button>
  );
}

export interface PipelineSegment {
  key: string;
  label: string;
  value: number;
  bar: Tone;
}

/** One stacked bar for how the reports are distributed across the lifecycle. */
export function PipelineBar({ segments }: { segments: readonly PipelineSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const summary = segments.map((segment) => `${segment.label}: ${segment.value}`).join(', ');

  return (
    <div>
      <div
        role="img"
        aria-label={summary}
        className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      >
        {total > 0 &&
          segments
            .filter((segment) => segment.value > 0)
            .map((segment) => (
              <span
                key={segment.key}
                className={cn('h-full first:rounded-l-full last:rounded-r-full', TONE[segment.bar].bar)}
                style={{ width: `${(segment.value / total) * 100}%` }}
              />
            ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2 text-xs">
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', TONE[segment.bar].bar)} aria-hidden="true" />
            <span className="truncate text-slate-500 dark:text-slate-400">{segment.label}</span>
            <span className="ml-auto font-bold tabular-nums text-slate-900 dark:text-white">{formatNumber(segment.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STATE_META: Record<ServiceHealth['state'], { label: string; tone: Tone }> = {
  checking: { label: 'Duke kontrolluar…', tone: 'slate' },
  ok: { label: 'Në rregull', tone: 'emerald' },
  degraded: { label: 'I ngadaltë ose i kufizuar', tone: 'amber' },
  down: { label: 'Nuk përgjigjet', tone: 'red' },
};

export function ServiceStatusPill({ state }: { state: ServiceHealth['state'] }) {
  const meta = STATE_META[state];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold', TONE[meta.tone].chip)} role="status">
      <span className={cn('h-2 w-2 rounded-full', TONE[meta.tone].bar, state === 'checking' && 'motion-safe:animate-pulse')} aria-hidden="true" />
      {dt(meta.label)}
    </span>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} ${dt(`min`)}`;
  if (seconds < 172800) return `${Math.round(seconds / 3600)} ${dt(`orë`)}`;
  return `${Math.round(seconds / 86400)} ${dt(`ditë`)}`;
}

export function ServiceStatusPanel({ health }: { health: ServiceHealth & { recheck: () => void } }) {
  const rows: Array<{ label: string; value: string; tone: Tone }> = [
    {
      label: dt(`API e platformës`),
      value:
        health.state === 'checking'
          ? '…'
          : health.state === 'down'
            ? dt(`Nuk përgjigjet`)
            : `${health.latencyMs ?? '–'} ms`,
      tone: health.state === 'ok' ? 'emerald' : health.state === 'degraded' ? 'amber' : health.state === 'down' ? 'red' : 'slate',
    },
    {
      label: dt(`Burimi i të dhënave`),
      value: health.dataSource === null ? '–' : health.dataSource === 'firestore' ? 'Firestore' : dt(`I padisponueshëm`),
      tone: health.dataSource === 'firestore' ? 'emerald' : health.dataSource === null ? 'slate' : 'red',
    },
    {
      label: dt(`Lidhja e shfletuesit`),
      value: health.online ? dt(`Online`) : dt(`Offline`),
      tone: health.online ? 'emerald' : 'red',
    },
    {
      label: dt(`Serveri aktiv për`),
      value: health.uptimeSeconds === null ? '–' : formatUptime(health.uptimeSeconds),
      tone: 'slate',
    },
  ];

  return (
    <Panel
      title={dt(`Gjendja e sistemit`)}
      iconClassName="text-emerald-500"
      action={<ServiceStatusPill state={health.state} />}
    >
      <dl className="space-y-2 text-xs">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">{row.label}</dt>
            <dd className={cn('font-mono font-bold tabular-nums', TONE[row.tone].text)}>{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-400 dark:border-white/5">
        <span>
          {health.checkedAt
            ? `${dt(`Kontrolluar në`)} ${new Date(health.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
            : dt(`Duke kontrolluar…`)}
        </span>
        <button
          type="button"
          onClick={health.recheck}
          className={cn('rounded-md px-1.5 py-0.5 font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white', FOCUS_RING)}
        >
          {dt(`Kontrollo përsëri`)}
        </button>
      </div>
    </Panel>
  );
}

export function RefreshButton({ isRefreshing, onClick }: { isRefreshing: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isRefreshing}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-white/10 disabled:opacity-60',
        FOCUS_RING
      )}
    >
      {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
      {dt(`Rifresko`)}
    </button>
  );
}

/** "para 5 min" / "tani", from an ISO timestamp. Empty when the date is unusable. */
export function AgeText({ iso, now }: { iso: string | undefined; now: number }) {
  const age = ageOf(iso, now);
  if (!age) return <span>–</span>;
  if (age.unit === 'now') return <span>{dt(`tani`)}</span>;
  const unit = age.unit === 'minutes' ? dt(`min`) : age.unit === 'hours' ? dt(`orë`) : dt(`ditë`);
  return (
    <span>
      {dt(`para`)} {age.value} {unit}
    </span>
  );
}

export { FOCUS_RING };
