/**
 * Language constants, split out so that neither the translation lookup nor the
 * React context has to import the other.
 *
 * `dt.ts` and `LanguageContext.tsx` previously imported each other: dt needed
 * the default language, and the context needed dt. That cycle is fragile —
 * whichever module the bundler happens to evaluate first observes the other's
 * exports as undefined, which shows up as a randomly missing translation
 * rather than a build error. Constants live here and both import from here.
 */

export type SupportedLanguageCode =
  | 'sq' | 'en' | 'bs' | 'tr' | 'de' | 'sr'   // original six (complete, hand-checked)
  | 'ar' | 'fr' | 'it' | 'pt' | 'gsw'         // added: Arabic, French, Italian, Portuguese, Swiss German
  | 'mk' | 'sl' | 'hr' | 'sv' | 'nb'          // added: Macedonian, Slovenian, Croatian, Swedish, Norwegian
  | 'nl'                                       // added: Dutch
  | 'ja' | 'ko' | 'pl'                         // added: Japanese, Korean, Polish (replacing es/ro/hy)
  | 'bg' | 'ca' | 'au';                        // added: Bulgarian, Canada (English+French), Australia (English)

/**
 * Albanian is the official language of the Republic of Kosovo and the only
 * language guaranteed to be complete, so it is both the default and the
 * fallback for every lookup miss.
 */
export const DEFAULT_LANGUAGE: SupportedLanguageCode = 'sq';

/**
 * Every selectable language, in switcher order. Albanian stays first because it
 * is the source language and the fallback for every miss. The six original
 * entries keep their historical positions so persisted choices and muscle
 * memory do not shift when the rest of the list is extended.
 */
export const SUPPORTED_LANGUAGES: readonly SupportedLanguageCode[] = [
  'sq', 'en', 'de', 'bs', 'ar', 'tr', 'sr', 'fr', 'it', 'pt',
  'gsw', 'mk', 'sl', 'hr', 'sv', 'nb', 'nl',
  'ja', 'ko', 'pl', 'bg', 'ca', 'au',
];

/**
 * Regional English variants.
 *
 * Canada and Australia are not separate UI languages: their visitors read
 * English (Canada also uses French). This set is what the switcher uses to
 * show a region badge on top of the `en` translation, so the choice is
 * remembered and the URL carries it without needing a second translation
 * table. Canada is intentionally paired with French below.
 */
export const REGIONAL_ENGLISH: readonly SupportedLanguageCode[] = ['ca', 'au'];

/**
 * Languages written right-to-left. Arabic is the only one here today, but the
 * context reads this rather than testing for 'ar' directly so a future addition
 * only has to touch this list.
 */
export const RTL_LANGUAGES: readonly SupportedLanguageCode[] = ['ar'];

/**
 * ISO 639-1-ish tag plus region, used for `<html lang>` and `dir`. Swiss German
 * has no bare ISO code, so the Swiss region tag is the honest representation.
 */
export const HTML_LANG_TAGS: Record<SupportedLanguageCode, string> = {
  sq: 'sq', en: 'en', de: 'de', bs: 'bs', ar: 'ar', tr: 'tr', sr: 'sr',
  fr: 'fr', it: 'it', pt: 'pt', gsw: 'de-CH', mk: 'mk', sl: 'sl',
  hr: 'hr', sv: 'sv', nb: 'nb', nl: 'nl',
  ja: 'ja', ko: 'ko', pl: 'pl', bg: 'bg', ca: 'en-CA', au: 'en-AU',
};

/**
 * Language metadata for the switcher: native name, flag and short badge label.
 * Lives next to the codes so the UI and the validation list cannot drift apart.
 */
export interface LanguageOption {
  code: SupportedLanguageCode;
  label: string;
  fullName: string;
  flag: string;
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: 'sq', label: 'AL', fullName: 'Shqip', flag: '🇦🇱' },
  { code: 'en', label: 'EN', fullName: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'DE', fullName: 'Deutsch', flag: '🇩🇪' },
  { code: 'bs', label: 'BS', fullName: 'Bosanski', flag: '🇧🇦' },
  { code: 'ar', label: 'AR', fullName: 'العربية', flag: '🇸🇦' },
  { code: 'tr', label: 'TR', fullName: 'Türkçe', flag: '🇹🇷' },
  { code: 'sr', label: 'SR', fullName: 'Srpski', flag: '🇷🇸' },
  { code: 'fr', label: 'FR', fullName: 'Français', flag: '🇫🇷' },
  { code: 'it', label: 'IT', fullName: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', label: 'PT', fullName: 'Português', flag: '🇵🇹' },
  { code: 'gsw', label: 'CH', fullName: 'Deutsch (Schweiz)', flag: '🇨🇭' },
  { code: 'mk', label: 'MK', fullName: 'Македонски', flag: '🇲🇰' },
  { code: 'sl', label: 'SL', fullName: 'Slovenščina', flag: '🇸🇮' },
  { code: 'hr', label: 'HR', fullName: 'Hrvatski', flag: '🇭🇷' },
  { code: 'sv', label: 'SV', fullName: 'Svenska', flag: '🇸🇪' },
  { code: 'nb', label: 'NO', fullName: 'Norsk', flag: '🇳🇴' },
  { code: 'nl', label: 'NL', fullName: 'Nederlands', flag: '🇳🇱' },
  { code: 'ja', label: 'JA', fullName: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: 'KO', fullName: '한국어', flag: '🇰🇷' },
  { code: 'pl', label: 'PL', fullName: 'Polski', flag: '🇵🇱' },
  { code: 'bg', label: 'BG', fullName: 'Български', flag: '🇧🇬' },
  { code: 'ca', label: 'CA', fullName: 'Canada (English/Français)', flag: '🇨🇦' },
  { code: 'au', label: 'AU', fullName: 'Australia (English)', flag: '🇦🇺' },
];

export const LANGUAGE_STORAGE_KEY = 'app_language';

export const isSupportedLanguage = (
  value: unknown
): value is SupportedLanguageCode =>
  typeof value === 'string'
  && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);

/**
 * Read the persisted language, repairing an unknown value rather than leaving
 * it to poison later reads. Never consults `navigator.language`: a German or
 * Turkish visitor must still land on Albanian.
 */
export function readStoredLanguage(): SupportedLanguageCode {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;

  // Staff consoles are written and run in Albanian; a citizen's chosen language
  // must not leak machine-translated text into them.
  if (/^\/(admin|agent|menagjer|komuna|debatiwp)(\/|$)/.test(window.location.pathname)) return DEFAULT_LANGUAGE;

  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return DEFAULT_LANGUAGE;
  }

  if (isSupportedLanguage(saved)) return saved;

  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE);
  } catch {
    // Storage blocked; the returned default still applies.
  }
  return DEFAULT_LANGUAGE;
}

export function writeStoredLanguage(value: SupportedLanguageCode): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
  } catch {
    // Private browsing: the in-memory value still applies for this session.
  }
}
