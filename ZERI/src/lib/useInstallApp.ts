import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'zeri_install_dismissed_at';
const DISMISS_DAYS = 14;

const safeGet = (key: string) => { try { return window.localStorage.getItem(key); } catch { return null; } };
const safeSet = (key: string, value: string) => { try { window.localStorage.setItem(key, value); } catch { /* private mode */ } };

// The browser fires `beforeinstallprompt` once, early. Keep it at module level so a component that mounts
// later (the footer button, the banner) can still use it.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function isIosSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Other iOS browsers (Chrome, Firefox, Edge) cannot add to the home screen from their own menu on older iOS.
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV/.test(ua);
  return ios && safari;
}

/** Whether the app can be installed, how, and whether the visitor already dismissed the offer. */
export function useInstallApp() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const standalone = isStandalone();
  const ios = isIosSafari();
  const canPrompt = !standalone && deferredPrompt !== null;
  const needsManual = !standalone && ios;
  const dismissedAt = Number(safeGet(DISMISS_KEY) || 0);
  const recentlyDismissed = dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_DAYS * 86_400_000;

  const install = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable' as const;
    const prompt = deferredPrompt;
    deferredPrompt = null;
    notify();
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    return outcome;
  }, []);

  const dismiss = useCallback(() => { safeSet(DISMISS_KEY, String(Date.now())); force((n) => n + 1); }, []);

  return { standalone, canPrompt, needsManual, canInstall: canPrompt || needsManual, recentlyDismissed, install, dismiss };
}
