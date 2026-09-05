import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// The service worker is generated and registered by vite-plugin-pwa (registerType:
// 'autoUpdate' injects /registerSW.js at build time). Registering '/sw.js' by hand here
// as well registered it twice in production, and in development — where the plugin is
// disabled — it installed the stale cache-first public/sw.js, which then served cached
// HTML and modules forever.
//
// Browsers that already installed that dev service worker keep it until it is explicitly
// removed, so tear it down (and its caches) when running under the dev server.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => registrations.forEach((registration) => registration.unregister()))
    .catch(() => {
      // Service workers are unavailable in some sandboxed/non-secure dev contexts.
    });

  if ('caches' in window) {
    caches
      .keys()
      .then((keys) => keys.forEach((key) => caches.delete(key)))
      .catch(() => {
        // Cache Storage may be blocked; nothing to clean up in that case.
      });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

