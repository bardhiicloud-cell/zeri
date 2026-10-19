import { useCallback, useSyncExternalStore } from 'react';

export type ThemePreference = 'dark' | 'light';

/** Where the active theme came from — this is what the analyzer reports. */
export type ThemeSource = 'user' | 'system' | 'default';

export interface ThemeAnalysis {
  theme: ThemePreference;
  source: ThemeSource;
  /** The device/browser reports a dark colour scheme (OS night mode, browser setting). */
  systemPrefersDark: boolean;
  /** The device reports a light colour scheme explicitly. */
  systemPrefersLight: boolean;
  /** The visitor runs a forced-colours / high-contrast mode. */
  forcedColors: boolean;
}

/**
 * Only an explicit tap on the sun/moon button is stored here. The previous key
 * (`theme`) was written on every first visit, so every returning visitor had
 * "dark" saved that they never chose; it is deliberately ignored so those
 * visitors fall through to their device setting instead of a phantom choice.
 */
const CHOICE_KEY = 'zeri-theme-choice';
const THEME_EVENT = 'zeri:theme-change';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const LIGHT_QUERY = '(prefers-color-scheme: light)';

const THEME_COLOR: Record<ThemePreference, string> = {
  light: '#F0F7FF',
  dark: '#0B1220',
};

function matches(query: string): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

function readChoice(): ThemePreference | null {
  try {
    const stored = localStorage.getItem(CHOICE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : null;
  } catch {
    // Storage can throw in private windows and sandboxed frames; the device
    // setting still decides in that case.
    return null;
  }
}

/**
 * Decide which theme to show.
 *
 *   1. the visitor's own choice, if they ever used the toggle;
 *   2. otherwise the device setting — night mode on the phone/OS gives night;
 *   3. otherwise day, which is also the answer when the device reports nothing.
 */
export function analyzeTheme(): ThemeAnalysis {
  const systemPrefersDark = matches(DARK_QUERY);
  const systemPrefersLight = matches(LIGHT_QUERY);
  const forcedColors = matches('(forced-colors: active)');
  const choice = readChoice();

  if (choice) {
    return { theme: choice, source: 'user', systemPrefersDark, systemPrefersLight, forcedColors };
  }
  if (systemPrefersDark) {
    return { theme: 'dark', source: 'system', systemPrefersDark, systemPrefersLight, forcedColors };
  }
  return {
    theme: 'light',
    source: systemPrefersLight ? 'system' : 'default',
    systemPrefersDark,
    systemPrefersLight,
    forcedColors,
  };
}

function paint(theme: ThemePreference): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;

  // The browser chrome (Android address bar, iOS status bar) follows the page,
  // otherwise a white page gets a navy bar in day mode.
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = THEME_COLOR[theme];
}

let cachedSnapshot: ThemePreference | null = null;

function applyCurrent(): void {
  const { theme } = analyzeTheme();
  paint(theme);
  if (cachedSnapshot !== theme) {
    cachedSnapshot = theme;
    window.dispatchEvent(new Event(THEME_EVENT));
  }
}

let systemListenerAttached = false;

function attachSystemListener(): void {
  if (systemListenerAttached || typeof window.matchMedia !== 'function') return;
  systemListenerAttached = true;
  try {
    const query = window.matchMedia(DARK_QUERY);
    // Following the device live: the OS switching to night at sunset flips the
    // site too — unless the visitor has made their own choice.
    const onChange = () => {
      if (!readChoice()) applyCurrent();
    };
    if (typeof query.addEventListener === 'function') query.addEventListener('change', onChange);
    else (query as MediaQueryList).addListener?.(onChange);
  } catch {
    systemListenerAttached = false;
  }
}

export function initializeTheme(): ThemeAnalysis {
  applyCurrent();
  attachSystemListener();
  return analyzeTheme();
}

let themeFadeTimer: number | undefined;

/**
 * Cross-fade the palette for the moment of a deliberate switch only. The colour
 * transition used to be declared on every div/a/button permanently, which made
 * the engine track transitions on thousands of nodes during hover, scroll and
 * route changes. A short-lived class on <html> gives the same polish for free.
 */
function fadeThemeSwitch(): void {
  const root = document.documentElement;
  root.classList.add('theme-fade');
  window.clearTimeout(themeFadeTimer);
  themeFadeTimer = window.setTimeout(() => root.classList.remove('theme-fade'), 260);
}

function setExplicitTheme(theme: ThemePreference): void {
  try {
    localStorage.setItem(CHOICE_KEY, theme);
  } catch {
    // The toggle still works for this page view without storage.
  }
  fadeThemeSwitch();
  applyCurrent();
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

const getSnapshot = (): ThemePreference => analyzeTheme().theme;
const getServerSnapshot = (): ThemePreference => 'light';

export function useThemePreference() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleTheme = useCallback(() => {
    setExplicitTheme(analyzeTheme().theme === 'dark' ? 'light' : 'dark');
  }, []);

  return { isDark: theme === 'dark', theme, toggleTheme };
}
