import { useEffect, useState } from 'react';

export type ThemePreference = 'dark' | 'light';

const STORAGE_KEY = 'theme';
const THEME_EVENT = 'zeri:theme-change';

function readTheme(): ThemePreference {
  return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

function applyTheme(theme: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function initializeTheme(): void {
  applyTheme(readTheme());
}

export function useThemePreference() {
  const [theme, setTheme] = useState<ThemePreference>(readTheme);

  useEffect(() => {
    const syncTheme = () => setTheme(readTheme());
    window.addEventListener(THEME_EVENT, syncTheme);
    return () => window.removeEventListener(THEME_EVENT, syncTheme);
  }, []);

  const toggleTheme = () => applyTheme(theme === 'dark' ? 'light' : 'dark');

  return { isDark: theme === 'dark', toggleTheme };
}