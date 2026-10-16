/**
 * Read-side helpers: merge the shipped seed with CMS content and answer the questions the
 * pages ask (entries of a section, timeline, sources of an entry, search).
 *
 * Merge rule: a CMS record with the same id REPLACES the seed entry, whatever its status.
 * An archived/draft CMS copy therefore also hides the seed text — which is what an editor
 * who withdraws a seed entry expects. Only `published` records are ever sent to readers.
 */
import { SEED_ENTRIES, SEED_SOURCES } from './seed';
import {
  byDate, findSection, sectionsOf,
  type EraId, type HeritageArea, type HeritageEntry, type HeritageSource,
} from './types';

export interface HeritageContent {
  entries: HeritageEntry[];
  sources: Map<string, HeritageSource>;
  /** True while only the bundled seed is available (offline, API error, empty CMS). */
  seedOnly: boolean;
}

export interface LiveHeritage {
  entries: HeritageEntry[];
  /** Ids of CMS records that exist but are not public: they suppress the seed entry of the same id. */
  hiddenIds?: string[];
  sources: HeritageSource[];
}

export function mergeContent(live: LiveHeritage | null | undefined): HeritageContent {
  const hidden = new Set(live?.hiddenIds ?? []);
  const liveEntries = new Map((live?.entries ?? []).map((entry) => [entry.id, entry]));
  const merged: HeritageEntry[] = [];

  for (const seed of SEED_ENTRIES) {
    if (hidden.has(seed.id)) continue;
    merged.push(liveEntries.get(seed.id) ?? seed);
  }
  for (const entry of liveEntries.values()) {
    if (!SEED_ENTRIES.some((seed) => seed.id === entry.id)) merged.push(entry);
  }

  const sources = new Map<string, HeritageSource>();
  for (const source of SEED_SOURCES) sources.set(source.id, source);
  for (const source of live?.sources ?? []) sources.set(source.id, source);

  return { entries: merged, sources, seedOnly: !live };
}

export const entriesOf = (content: HeritageContent, area: HeritageArea, section?: string): HeritageEntry[] =>
  content.entries
    .filter((entry) => entry.area === area && (!section || entry.section === section))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));

export const timelineOf = (content: HeritageContent, area: HeritageArea, section?: string): HeritageEntry[] =>
  content.entries
    .filter((entry) => entry.area === area && entry.date && (entry.kind === 'event' || entry.kind === 'biography') && (!section || entry.section === section))
    .sort(byDate);

export const entryById = (content: HeritageContent, id: string): HeritageEntry | undefined =>
  content.entries.find((entry) => entry.id === id);

export const sourcesFor = (content: HeritageContent, entry: HeritageEntry): HeritageSource[] => {
  const ids = new Set<string>(entry.sourceIds);
  for (const claim of entry.claims) for (const id of claim.sourceIds) ids.add(id);
  return [...ids].map((id) => content.sources.get(id)).filter((s): s is HeritageSource => !!s);
};

export const eraOf = (entry: HeritageEntry): EraId | undefined => entry.era;

export const featured = (content: HeritageContent, area: HeritageArea, limit = 4): HeritageEntry[] =>
  entriesOf(content, area).filter((entry) => entry.featured).slice(0, limit);

/** Accent-insensitive search over the visible text of entries. */
export function searchEntries(content: HeritageContent, query: string, lang: 'sq' | 'en', area?: HeritageArea): HeritageEntry[] {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const tokens = norm(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return content.entries
    .filter((entry) => !area || entry.area === area)
    .map((entry) => {
      const hay = norm([entry.title[lang], entry.title.sq, entry.summary[lang], entry.summary.sq, entry.body[lang], entry.tags.join(' '), entry.place?.name ?? ''].join(' '));
      let score = 0;
      for (const token of tokens) {
        if (!hay.includes(token)) return { entry, score: 0 };
        score += norm(entry.title[lang] + entry.title.sq).includes(token) ? 5 : 1;
      }
      return { entry, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.entry)
    .slice(0, 40);
}

export const sectionOrderOf = (area: HeritageArea) => sectionsOf(area);
export { findSection };

/** Counts for the hub: how many entries and how many have been verified by a second person. */
export function contentStats(content: HeritageContent) {
  const total = content.entries.length;
  const verified = content.entries.filter((entry) => entry.verification.state === 'verified').length;
  const unchecked = [...content.sources.values()].filter((source) => !source.linkChecked).length;
  return { total, verified, unverified: total - verified, sources: content.sources.size, uncheckedLinks: unchecked };
}
