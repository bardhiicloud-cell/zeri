/**
 * Per-language variants of news articles.
 *
 * A news article is written once in Albanian by the editorial team, but citizens
 * read the site in any of 20 languages. Storing 20 copies of every article in
 * Firestore would multiply storage by 20 and go stale the moment an editor fixes
 * a typo, so instead the variant is produced on demand and cached under the
 * article id plus the source text's own hash.
 *
 * The hash is what makes this safe: editing the Albanian article changes its
 * hash, which invalidates the cached variant automatically. There is no separate
 * "please retranslate" step for an editor to forget.
 */

import { authHeaders } from './apiAuth';

/** Fields of a news article that carry human-readable text. */
export interface TranslatableArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  category?: string;
  municipality?: string;
  date?: string;
  author?: string;
  readTime?: string;
}

/**
 * Stable, fast hash of the source text.
 *
 * Not cryptographic — it only needs to change when the text changes. FNV-1a is
 * small enough to inline and avoids pulling in a dependency for this.
 */
function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Identity of a translation: which article, which language, which revision. */
export function translationKey(article: TranslatableArticle, language: string): string {
  const revision = hashText(article.title + '\u0000' + article.summary + '\u0000' + article.content);
  return `news:${article.id}:${language}:${revision}`;
}

/** In-memory cache, backed by localStorage so a reload does not refetch. */
const memory = new Map<string, string>();

function readCache(key: string): string | null {
  if (memory.has(key)) return memory.get(key)!;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored) {
      memory.set(key, stored);
      return stored;
    }
  } catch {
    // Storage blocked; the in-memory map still serves this session.
  }
  return null;
}

function writeCache(key: string, value: string): void {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore: a full or blocked storage must not break article rendering.
  }
}

/**
 * Translate a single string through the server, or return null on failure.
 *
 * Failure returns null rather than the original so the caller can decide what
 * to show; silently rendering Albanian inside a Swedish article is worse than
 * showing a clear fallback.
 */
async function translateField(text: string, language: string): Promise<string | null> {
  if (!text || !text.trim()) return text;
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ text, target: language, source: 'sq' }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.text === 'string' ? data.text : null;
  } catch {
    return null;
  }
}

/**
 * Return the article rendered in the requested language.
 *
 * Albanian is returned untouched. For every other language the fields are
 * translated and cached; a field that fails to translate falls back to the
 * Albanian original for that field only, so a partial failure degrades to a
 * readable article instead of an empty page.
 */
export async function getLocalizedArticle(
  article: TranslatableArticle,
  language: string
): Promise<TranslatableArticle> {
  if (language === 'sq') return article;

  const key = translationKey(article, language);
  const cached = readCache(key);
  if (cached) {
    try {
      return { ...article, ...JSON.parse(cached) };
    } catch {
      // Corrupt entry: fall through and regenerate.
    }
  }

  const fields: Array<keyof TranslatableArticle> = ['title', 'summary', 'content'];
  const result: Partial<TranslatableArticle> = {};

  const translations = await Promise.all(
    fields.map((f) => translateField(String(article[f] ?? ''), language))
  );

  fields.forEach((field, i) => {
    const value = translations[i];
    (result as Record<string, string>)[field] = value ?? String(article[field] ?? '');
  });

  writeCache(key, JSON.stringify(result));
  return { ...article, ...result };
}

/**
 * Translate a whole list, preserving order.
 *
 * Sequential rather than parallel across articles: 20 concurrent articles would
 * each fire three field requests and trip the server's rate limiter, which is a
 * worse experience than waiting a moment for the list.
 */
export async function getLocalizedArticles(
  articles: TranslatableArticle[],
  language: string
): Promise<TranslatableArticle[]> {
  if (language === 'sq') return articles;
  const out: TranslatableArticle[] = [];
  for (const article of articles) {
    out.push(await getLocalizedArticle(article, language));
  }
  return out;
}
