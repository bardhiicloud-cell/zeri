import { dynamicTranslations } from './dynamicTranslations';
import { uiTranslations } from './uiTranslations';
import { newLanguageTranslations } from './newLanguageTranslations';
import { DEFAULT_LANGUAGE, isSupportedLanguage, readStoredLanguage, SUPPORTED_LANGUAGES, } from './languageConstants';
import { translationLanguageFor } from './seo';
const isSupported = (value) => value !== null && SUPPORTED_LANGUAGES.includes(value);
/**
 * Translate a literal Albanian string.
 *
 * Called from ~200 files, often at module scope and often outside React, so it
 * deliberately stays a pure function with no context or hook dependency. When no
 * language is forced it reads the persisted choice, and every miss falls back to
 * Albanian before falling back to the original text.
 *
 * Lookup order, most specific first:
 *   1. newLanguageTranslations — the added languages (ar, fr, it, ... bg)
 *   2. uiTranslations          — short UI labels that override the big table
 *   3. dynamicTranslations     — the original six languages
 *   4. Albanian, then the input text itself
 *
 * Canada and Australia resolve to English before lookup: they are regions, not
 * separate translations, so their strings live in the English column.
 */
export function dt(text, forcedLang) {
    if (!text)
        return text;
    let lang = DEFAULT_LANGUAGE;
    if (forcedLang && isSupportedLanguage(forcedLang)) {
        lang = forcedLang;
    }
    else {
        // Reads the persisted choice and repairs an unknown value. Centralised in
        // languageConstants so dt and the React context cannot disagree.
        lang = readStoredLanguage();
    }
    /*
     * Regional variants (ca, au) are destinations rather than translations.
     * Resolving them to their base language here means /ca/ and /au/ render the
     * English strings, so no duplicate table is needed and an English fix
     * reaches all three variants at once.
     */
    lang = translationLanguageFor(lang);
    // The added languages live in their own overlay; check it first so an
    // entry there always wins for its language.
    const addedLanguage = newLanguageTranslations[text]?.[lang];
    if (addedLanguage)
        return addedLanguage;
    const uiTranslation = uiTranslations[text]?.[lang];
    if (uiTranslation)
        return uiTranslation;
    const entry = dynamicTranslations[text];
    if (!entry)
        return text;
    const translated = entry[lang];
    if (translated)
        return translated;
    // Missing translation for the active language falls back to Albanian, which
    // is the one table guaranteed to be complete.
    const fallback = entry[DEFAULT_LANGUAGE];
    return fallback || text;
}
