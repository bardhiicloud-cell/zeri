import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  LANGUAGE_STORAGE_KEY,
  readStoredLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguageCode,
} from './languageConstants';
import { translationLanguageFor } from './seo';

type SupportedLanguage = SupportedLanguageCode;

/**
 * Translations are generated (scripts/build-i18n.ts) into one JSON file per
 * language and fetched only for the language a visitor reads. Albanian is the
 * source language and needs no table, so dt() returns the original text for it.
 * Until a table has loaded, dt() also returns the Albanian original.
 */
type Table = Record<string, string>;
// import.meta.glob exists only under Vite. The server bundle (esbuild) and tsx also load this
// module and have no browser to fetch for, so there the lookup stays empty.
let tableLoaders: Record<string, () => Promise<Table>> = {};
try {
  tableLoaders = import.meta.glob<Table>('./i18n/generated/*.json', { import: 'default' });
} catch {
  // not running under Vite
}
const tables = new Map<string, Table>();
const tablesLoading = new Map<string, Promise<void>>();

/** The only Albanian entry whose output differs from its key (a deliberate rewording). */
const ALBANIAN_OVERRIDES: Record<string, string> = {
  'Mbi 24 ide të pranuara këtë muaj': 'Ide që e përmirësojnë komunën',
};

/**
 * Fetch the translation table for `language`. Resolves at once for Albanian and
 * when it is already loaded; a failed fetch can be retried.
 */
export function ensureTranslationTables(language: string): Promise<void> {
  if (!isSupportedLanguage(language)) return Promise.resolve();
  const lang = translationLanguageFor(language);
  if (lang === DEFAULT_LANGUAGE || tables.has(lang)) return Promise.resolve();
  const loader = tableLoaders[`./i18n/generated/${lang}.json`];
  if (!loader) return Promise.resolve();
  let loading = tablesLoading.get(lang);
  if (!loading) {
    loading = loader()
      .then((table) => {
        tables.set(lang, table);
      })
      .catch((error) => {
        tablesLoading.delete(lang);
        throw error;
      });
    tablesLoading.set(lang, loading);
  }
  return loading;
}

/** True when dt() can already translate into `language`. */
export function translationTablesReady(language: string): boolean {
  if (!isSupportedLanguage(language)) return true;
  const lang = translationLanguageFor(language);
  return lang === DEFAULT_LANGUAGE || tables.has(lang) || !tableLoaders[`./i18n/generated/${lang}.json`];
}

const isSupported = (value: string | null): value is SupportedLanguage =>
  value !== null && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
/**
 * Translate a literal Albanian string.
 *
 * Called from ~200 files, often at module scope and often outside React, so it
 * deliberately stays a pure function with no context or hook dependency. When no
 * language is forced it reads the persisted choice, and every miss falls back to
 * Albanian before falling back to the original text.
 *
 * The per-language tables already apply the source precedence (public pages,
 * added languages, site gap-fills, UI labels, the original six, then Albanian);
 * see scripts/build-i18n.ts. A miss returns the input text itself.
 */
export function dt(text: string, forcedLang?: string): string {
  if (!text) return text;

  let lang: SupportedLanguage = DEFAULT_LANGUAGE;
  if (forcedLang && isSupportedLanguage(forcedLang)) {
    lang = forcedLang;
  } else {
    // Reads the persisted choice and repairs an unknown value. Centralised in
    // languageConstants so dt and the React context cannot disagree.
    lang = readStoredLanguage();
  }

  /*
   * Regional variants (Canada, Australia) are destinations, not separate
   * translations. Resolving them to their base language here means the same
   * strings render for /ca/ and /au/ as for /en/, so no duplicate table is
   * needed and an English fix reaches all three at once.
   */
  lang = translationLanguageFor(lang);

  if (lang === DEFAULT_LANGUAGE) return ALBANIAN_OVERRIDES[text] ?? text;
  return tables.get(lang)?.[text] ?? text;
}
