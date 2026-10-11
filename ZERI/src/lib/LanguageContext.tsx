import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Language, translations } from './translations';
import { dt as dTrans } from './dt';
import {
  DEFAULT_LANGUAGE,
  HTML_LANG_TAGS,
  isSupportedLanguage,
  LANGUAGE_STORAGE_KEY,
  readStoredLanguage,
  RTL_LANGUAGES,
  SUPPORTED_LANGUAGES,
  writeStoredLanguage,
  type SupportedLanguageCode,
} from './languageConstants';

// Re-exported so the many existing `import { DEFAULT_LANGUAGE } from
// '../lib/LanguageContext'` call sites keep working without reaching into the
// constants module directly.
export { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, LANGUAGE_STORAGE_KEY };
export { readStoredLanguage as getStoredLanguage };

export type { SupportedLanguageCode };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations.sq) => string;
  dt: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => readStoredLanguage() as Language);

  /**
   * Persist immediately. The previous implementation only wrote to storage from
   * an effect, so a reload right after switching language (common on mobile
   * Safari) silently reverted to Albanian.
   */
  const setLanguage = useCallback((lang: Language) => {
    if (!isSupportedLanguage(lang)) return;
    setLanguageState(lang);
    writeStoredLanguage(lang);
  }, []);

  // Keep the document in sync: screen readers, browser translation prompts,
  // hyphenation and — for Arabic — the writing direction all depend on the
  // <html> attributes. Swiss German needs the region tag (de-CH) to be
  // announced correctly.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.lang = HTML_LANG_TAGS[language] ?? language;
    const isRtl = (RTL_LANGUAGES as readonly string[]).includes(language);
    root.dir = isRtl ? 'rtl' : 'ltr';
  }, [language]);

  /**
   * Keyed lookup with a three-step fallback:
   *   1. the requested language
   *   2. Albanian (guaranteed complete)
   *   3. the key itself, so a missing string shows up instead of rendering blank
   */
  const t = useCallback((key: keyof typeof translations.sq) => {
    const table = translations as unknown as Record<string, Record<string, string>>;
    return table[language]?.[key as string]
      || table[DEFAULT_LANGUAGE]?.[key as string]
      || (key as string);
  }, [language]);

  const dt = useCallback((text: string) => dTrans(text, language), [language]);

  const value = useMemo<LanguageContextType>(
    () => ({ language, setLanguage, t, dt }),
    [language, setLanguage, t, dt]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
