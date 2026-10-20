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
 * The translation tables are ~4 MB of generated text, split at build time into one
 * module per language (see translationChunks in vite.config.ts). Albanian is the
 * source language and needs none of it, so a visitor only fetches the table for
 * the language they read. Until it arrives dt() returns the Albanian original.
 */
type LanguageTable = Record<string, string>;
const tables = new Map<string, LanguageTable>();
const tablesLoading = new Map<string, Promise<void>>();

/** The only Albanian entry whose output differs from its key (a deliberate rewording). */
const ALBANIAN_OVERRIDES: Record<string, string> = {
  'Mbi 24 ide të pranuara këtë muaj': 'Ide që e përmirësojnë komunën',
};

/**
 * Fetch the translation tables when `language` needs them. Resolves at once for
 * Albanian and when they are already loaded; a failed fetch can be retried.
 */
export function ensureTranslationTables(language: string): Promise<void> {
  if (!isSupportedLanguage(language)) return Promise.resolve();
  const lang = translationLanguageFor(language);
  if (lang === DEFAULT_LANGUAGE || tables.has(lang)) return Promise.resolve();
  let loading = tablesLoading.get(lang);
  if (!loading) {
    loading = import('virtual:zeri-translations/loaders')
      .then(({ translationLoaders }) => {
        const load = (translationLoaders as Record<string, () => Promise<{ default: LanguageTable }>>)[lang];
        // A language with no table at all simply shows the Albanian originals.
        return load ? load() : { default: {} };
      })
      .then((module) => {
        tables.set(lang, module.default);
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
  return !isSupportedLanguage(language) || translationLanguageFor(language) === DEFAULT_LANGUAGE || tables.has(translationLanguageFor(language));
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
 * Lookup order, most specific first:
 *   1. newLanguageTranslations — the 14 added languages (ar, fr, it, ... nl)
 *   2. siteTranslations        — gap-fills for strings missing from every table
 *   3. uiTranslations          — short UI labels that override the big table
 *   4. dynamicTranslations     — the original six languages
 *   5. Albanian, then the input text itself
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
