import type { Claim, HeritageEntry, HeritageDate, L10n } from '../types';

/**
 * Seed entries are editorial drafts that ship with the application so the section is
 * never empty. They are published in the public view but carry `verification: unverified`,
 * and the UI says so. An editor who verifies one in the CMS replaces it by id.
 */
export const SEED_NOTE = 'Teksti fillestar i redaksisë. Burimet janë regjistruar por nuk janë kontrolluar ende nga një person i dytë.';

export const l = (sq: string, en: string): L10n => ({ sq, en });

export const d = (from: string, precision: HeritageDate['precision'] = 'day', extra: Partial<HeritageDate> = {}): HeritageDate => ({ from, precision, ...extra });

type Input = Partial<HeritageEntry> & Pick<HeritageEntry, 'id' | 'area' | 'section' | 'title' | 'summary' | 'body' | 'evidence' | 'sourceIds'>;

export function entry(input: Input): HeritageEntry {
  return {
    kind: 'article',
    sensitive: 'none',
    claims: [],
    media: [],
    tags: [],
    corrections: [],
    status: 'published',
    version: 1,
    origin: 'seed',
    verification: { state: 'unverified', note: SEED_NOTE },
    ...input,
  };
}

export const claim = (id: string, text: L10n, evidence: Claim['evidence'], asOf: string, sourceIds: string[], caveat?: L10n): Claim =>
  ({ id, text, evidence, asOf, sourceIds, ...(caveat ? { caveat } : {}) });
