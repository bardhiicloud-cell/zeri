import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/aura.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initializeTheme } from './lib/themePreference.ts';
import { installApiFetch } from './lib/apiBase.ts';
import { ensureTranslationTables } from './lib/dt.ts';
import { readStoredLanguage } from './lib/languageConstants.ts';
import { parseLocalePath } from './lib/seo.ts';

// Before anything renders: every fetch('/api/...') goes to the API host.
installApiFetch();
initializeTheme();

const legacyHashRoute = window.location.hash.slice(1);
if (legacyHashRoute.startsWith('/')) {
  window.history.replaceState(window.history.state, '', legacyHashRoute);
}

function mount() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

// A visitor in another language gets the translation tables before the first
// paint, so the page never flashes Albanian first. Albanian (the default)
// resolves instantly and the tables are never downloaded. A failed fetch must
// not block the app: it simply stays in Albanian until the context retries.
const urlLanguage = parseLocalePath(window.location.pathname).language;
const initialLanguage = urlLanguage !== 'sq' ? urlLanguage : readStoredLanguage();
ensureTranslationTables(initialLanguage).catch(() => undefined).finally(mount);

// Installable app + offline fallback. Production only: a service worker in dev would serve stale modules.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* installability is an enhancement; the site works without it */
    });
  });
}
