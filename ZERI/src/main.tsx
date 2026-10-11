import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
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
