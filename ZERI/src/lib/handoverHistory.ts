import type { HandoverEntry } from './reportAssignmentApi';

export type HandoverFilter = 'all' | 'assign' | 'release';

export const HANDOVER_FILTERS: ReadonlyArray<{ value: HandoverFilter; label: string }> = [
  { value: 'all', label: 'Të gjitha' },
  { value: 'assign', label: 'Caktime' },
  { value: 'release', label: 'Lëshime' },
];

export function filterHandovers(items: readonly HandoverEntry[], filter: HandoverFilter): HandoverEntry[] {
  return filter === 'all' ? [...items] : items.filter(item => item.kind === filter);
}

/** A name for a person, or an honest "not recorded". Never an id, never a guess. */
export const personLabel = (name: string | undefined, notRecorded: string): string => (name && name.trim() ? name.trim() : notRecorded);

/** Entries with the same id (a page boundary read twice) appear once; order is kept. */
export function appendHandovers(current: readonly HandoverEntry[], next: readonly HandoverEntry[]): HandoverEntry[] {
  const seen = new Set(current.map(item => item.id));
  return [...current, ...next.filter(item => !seen.has(item.id))];
}

export function formatHandoverTime(iso: string): string {
  return Number.isFinite(Date.parse(iso)) ? new Date(iso).toLocaleString('sq-AL', { dateStyle: 'short', timeStyle: 'short' }) : '';
}
