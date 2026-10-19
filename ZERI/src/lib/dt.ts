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
 * The translation tables are ~4 MB of generated text. Albanian is the source
 * language and needs none of it, so they live in their own chunk and are only
 * fetched once a visitor is in another language. Until then dt() returns the
 * Albanian original, which is exactly what the tables return for `sq`.
 */
type TranslationTables = typeof import('./translationTables');
let tables: TranslationTables | null = null;
let tablesLoading: Promise<void> | null = null;

/** The only Albanian entry whose output differs from its key (a deliberate rewording). */
const ALBANIAN_OVERRIDES: Record<string, string> = {
  'Mbi 24 ide të pranuara këtë muaj': 'Ide që e përmirësojnë komunën',
};

/**
 * Fetch the translation tables when `language` needs them. Resolves at once for
 * Albanian and when they are already loaded; a failed fetch can be retried.
 */
export function ensureTranslationTables(language: string): Promise<void> {
  if (tables || !isSupportedLanguage(language) || translationLanguageFor(language) === DEFAULT_LANGUAGE) {
    return Promise.resolve();
  }
  tablesLoading ??= import('./translationTables')
    .then((module) => {
      tables = module;
    })
    .catch((error) => {
      tablesLoading = null;
      throw error;
    });
  return tablesLoading;
}

/** True when dt() can already translate into `language`. */
export function translationTablesReady(language: string): boolean {
  return !!tables || !isSupportedLanguage(language) || translationLanguageFor(language) === DEFAULT_LANGUAGE;
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

  if (!tables) return lang === DEFAULT_LANGUAGE ? ALBANIAN_OVERRIDES[text] ?? text : text;
  const { publicPagesTranslations, newLanguageTranslations, siteTranslations, uiTranslations, dynamicTranslations } = tables;

  const publicPage = publicPagesTranslations[text]?.[lang];
  if (publicPage) return publicPage;

  // The added languages live in their own overlay; check it first so an
  // entry there always wins for its language.
  const addedLanguage = newLanguageTranslations[text]?.[lang];
  if (addedLanguage) return addedLanguage;

  // Gap-fills for strings no other table covers (see siteTranslations.ts).
  const siteTranslation = siteTranslations[text]?.[lang];
  if (siteTranslation) return siteTranslation;

  const uiTranslation = uiTranslations[text]?.[lang];
  if (uiTranslation) return uiTranslation;

  const entry = dynamicTranslations[text];
  if (!entry) return text;

  const translated = (entry as Record<string, string>)[lang];
  if (translated) return translated;

  // Missing translation for the active language falls back to Albanian, which
  // is the one table guaranteed to be complete.
  const fallback = (entry as Record<string, string>)[DEFAULT_LANGUAGE];
  return fallback || text;
}
