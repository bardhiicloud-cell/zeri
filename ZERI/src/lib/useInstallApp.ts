import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'native' | 'ios-safari' | 'ios-other' | 'in-app' | 'none';

const STATE_KEY = 'zeri_install_state_v2';
interface InstallState {
  visits: number;
  lastVisitDay: string;
  /** Kept for older saved states: any earlier refusal also means "do not ask again". */
  dismissals: number;
  dismissedAt: number;
  installed: boolean;
  /** The automatic offer was shown once. It is never shown again; the footer button stays. */
  offered: boolean;
}

const EMPTY_STATE: InstallState = { visits: 0, lastVisitDay: '', dismissals: 0, dismissedAt: 0, installed: false, offered: false };

/** One question, once: installed, already offered, or refused in the past all end the automatic offers. */
export function mayOffer(state: Pick<InstallState, 'installed' | 'offered' | 'dismissals'>): boolean {
  return !state.installed && !state.offered && state.dismissals === 0;
}

function readState(): InstallState {
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    return raw ? { ...EMPTY_STATE, ...(JSON.parse(raw) as Partial<InstallState>) } : { ...EMPTY_STATE };
  } catch {
    return { ...EMPTY_STATE };
  }
}

function writeState(patch: Partial<InstallState>) {
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify({ ...readState(), ...patch }));
  } catch { /* private mode */ }
}

// The browser fires `beforeinstallprompt` once, early. Keep it at module level so a component that mounts
// later (the footer button, the sheet) can still use it.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  // Count one visit per calendar day, so "second visit" means a real return, not a reload.
  const today = new Date().toISOString().slice(0, 10);
  const state = readState();
  if (state.lastVisitDay !== today) writeState({ visits: state.visits + 1, lastVisitDay: today });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    writeState({ installed: true });
    notify();
  });
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function detectPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'none';
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!ios) return deferredPrompt ? 'native' : 'none';
  // Instagram / Facebook / TikTok webviews cannot add to the home screen at all.
  if (/Instagram|FBAN|FBAV|FB_IAB|Line\/|TikTok|Snapchat/.test(ua)) return 'in-app';
  // iOS 16.4+ lets Chrome, Edge and Firefox add to the home screen from their share menu too.
  return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'ios-other' : 'ios-safari';
}

/** Whether the app can be installed, how, and whether the visitor should be offered it right now. */
export function useInstallApp() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const standalone = isStandalone();
  const platform = detectPlatform();
  const state = readState();
  const canPrompt = !standalone && deferredPrompt !== null;
  const needsManual = !standalone && (platform === 'ios-safari' || platform === 'ios-other');
  const inAppBrowser = !standalone && platform === 'in-app';

  // Offer only to people who are engaged: a returning visitor, or one who stayed a while (the sheet's own timer).
  const shouldOffer = mayOffer(state);
  const returning = state.visits >= 2;

  const install = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable' as const;
    const prompt = deferredPrompt;
    deferredPrompt = null;
    notify();
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') writeState({ installed: true });
    return outcome;
  }, []);

  /** Records that the offer was made. It does not re-render: the sheet that is open stays open. */
  const markOffered = useCallback(() => {
    writeState({ offered: true });
  }, []);

  const dismiss = useCallback(() => {
    writeState({ offered: true, dismissals: readState().dismissals + 1, dismissedAt: Date.now() });
    force((n) => n + 1);
  }, []);

  return {
    standalone, platform, canPrompt, needsManual, inAppBrowser,
    canInstall: canPrompt || needsManual, shouldOffer, returning, install, dismiss, markOffered,
  };
}
