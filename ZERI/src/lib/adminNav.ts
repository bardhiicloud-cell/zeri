/**
 * Navigation logic for the admin panel, independent of any component.
 *
 * Two jobs: turn a typed query into a ranked list of sections (the "go to…"
 * palette and the sidebar filter), and decide which sidebar groups are open.
 * Both are pure so they can be tested without a DOM.
 */

/** The fields search looks at. Anything with these can be searched. */
export interface SearchableSection {
  /** Full page title, e.g. "Inspektimi i Raporteve". */
  label: string;
  /** Short sidebar label, e.g. "Raportet". */
  nav: string;
  /** One-line purpose. */
  hint: string;
  /** Extra words a person might type: synonyms, English names, old names. */
  keywords: readonly string[];
}

/**
 * Lower-case, strip accents and punctuation.
 *
 * Albanian keyboards are not always available, so "shendetesia" must find
 * "Shëndetësia" and "qytetaret" must find "Qytetarët". NFD splits ë/ç into the
 * base letter plus a combining mark, which is then dropped.
 */
export function normalizeSearch(input: string): string {
  return (input ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Score one field against one query token. 0 means no match. */
function scoreField(field: string, token: string): number {
  if (!field) return 0;
  if (field === token) return 6;
  if (field.startsWith(token)) return 5;
  // Start of any word: "stafi" matches "menaxhimi i stafit & agjenteve".
  if (field.split(' ').some((word) => word.startsWith(token))) return 4;
  if (field.includes(token)) return 2;
  return 0;
}

/**
 * Sections matching `query`, best first. An empty query returns the input in
 * its original order, so the palette opens as the full, familiar menu.
 *
 * Every token must match somewhere (AND), so "raporte ver" narrows rather than
 * widens. Ties keep the original order, which keeps results stable as you type.
 */
export function searchSections<T extends SearchableSection>(
  sections: readonly T[],
  query: string
): T[] {
  const tokens = normalizeSearch(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return [...sections];

  const scored: Array<{ section: T; score: number; index: number }> = [];
  sections.forEach((section, index) => {
    const nav = normalizeSearch(section.nav);
    const label = normalizeSearch(section.label);
    const hint = normalizeSearch(section.hint);
    const keywords = section.keywords.map(normalizeSearch);

    let total = 0;
    for (const token of tokens) {
      const best = Math.max(
        scoreField(nav, token) * 3,
        scoreField(label, token) * 2,
        ...keywords.map((keyword) => scoreField(keyword, token) * 2),
        scoreField(hint, token)
      );
      if (best === 0) return; // one unmatched token rules the section out
      total += best;
    }
    scored.push({ section, score: total, index });
  });

  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.section);
}

/** Move a highlighted index by `delta`, wrapping, safe for an empty list. */
export function moveIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return (((current + delta) % length) + length) % length;
}

/**
 * Which sidebar groups are open.
 *
 * The group holding the active section is always open, so the current page is
 * never hidden. Groups the person opened themselves stay open (the previous
 * sidebar closed every other group on each click, which made moving between two
 * related sections a constant open/close).
 */
export function resolveOpenGroups<G extends string>(
  remembered: readonly G[],
  activeGroup: G | null
): G[] {
  const open = new Set<G>(remembered);
  if (activeGroup) open.add(activeGroup);
  return [...open];
}

/** Toggle one group in the remembered list. */
export function toggleGroup<G extends string>(remembered: readonly G[], group: G): G[] {
  return remembered.includes(group)
    ? remembered.filter((id) => id !== group)
    : [...remembered, group];
}
