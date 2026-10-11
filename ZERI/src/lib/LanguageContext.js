import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { translations } from './translations';
import { dt as dTrans } from './dt';
import { DEFAULT_LANGUAGE, HTML_LANG_TAGS, isSupportedLanguage, LANGUAGE_STORAGE_KEY, readStoredLanguage, RTL_LANGUAGES, SUPPORTED_LANGUAGES, writeStoredLanguage, } from './languageConstants';
// Re-exported so the many existing `import { DEFAULT_LANGUAGE } from
// '../lib/LanguageContext'` call sites keep working without reaching into the
// constants module directly.
export { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, LANGUAGE_STORAGE_KEY };
export { readStoredLanguage as getStoredLanguage };
const LanguageContext = createContext(undefined);
export const LanguageProvider = ({ children }) => {
    const [language, setLanguageState] = useState(() => readStoredLanguage());
    /**
     * Persist immediately. The previous implementation only wrote to storage from
     * an effect, so a reload right after switching language (common on mobile
     * Safari) silently reverted to Albanian.
     */
    const setLanguage = useCallback((lang) => {
        if (!isSupportedLanguage(lang))
            return;
        setLanguageState(lang);
        writeStoredLanguage(lang);
    }, []);
    // Keep the document in sync: screen readers, browser translation prompts,
    // hyphenation and — for Arabic — the writing direction all depend on the
    // <html> attributes. Swiss German needs the region tag (de-CH) to be
    // announced correctly.
    useEffect(() => {
        if (typeof document === 'undefined')
            return;
        const root = document.documentElement;
        root.lang = HTML_LANG_TAGS[language] ?? language;
        const isRtl = RTL_LANGUAGES.includes(language);
        root.dir = isRtl ? 'rtl' : 'ltr';
    }, [language]);
    /**
     * Keyed lookup with a three-step fallback:
     *   1. the requested language
     *   2. Albanian (guaranteed complete)
     *   3. the key itself, so a missing string shows up instead of rendering blank
     */
    const t = useCallback((key) => {
        const table = translations;
        return table[language]?.[key]
            || table[DEFAULT_LANGUAGE]?.[key]
            || key;
    }, [language]);
    const dt = useCallback((text) => dTrans(text, language), [language]);
    const value = useMemo(() => ({ language, setLanguage, t, dt }), [language, setLanguage, t, dt]);
    return (_jsx(LanguageContext.Provider, { value: value, children: children }));
};
export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
