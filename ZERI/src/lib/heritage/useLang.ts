import { useLanguage } from '../LanguageContext';
import { heritageLang, ui, type UiKey } from './ui';
import type { HeritageLang } from './types';

/** Kept in its own tiny module so the homepage band can use it without pulling in the archive's content. */
export function useHeritageLang(): { lang: HeritageLang; t: (key: UiKey) => string } {
  const { language } = useLanguage();
  const lang = heritageLang(language);
  return { lang, t: (key) => ui(key, lang) };
}
