import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/aura.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initializeTheme } from './lib/themePreference.ts';

initializeTheme();

const legacyHashRoute = window.location.hash.slice(1);
if (legacyHashRoute.startsWith('/')) {
  window.history.replaceState(window.history.state, '', legacyHashRoute);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Installable app + offline fallback. Production only: a service worker in dev would serve stale modules.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* installability is an enhancement; the site works without it */
    });
  });
}
