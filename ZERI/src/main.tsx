import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/aura.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initializeTheme } from './lib/themePreference.ts';
import { installApiFetch } from './lib/apiBase.ts';

// Before anything renders: every fetch('/api/...') goes to the API host.
installApiFetch();
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
