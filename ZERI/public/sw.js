/* Zëri Qytetarëve — service worker.
 *
 * Deliberately small and conservative for a civic platform:
 *  - never touches /api/, Firebase, Google or any cross-origin request (reports,
 *    Track ID lookups, auth and payments must always hit the network);
 *  - navigations are network-first, with a static offline page as the fallback;
 *  - only same-origin static files (hashed /assets, icons, fonts) are cached.
 */
const VERSION = 'zeri-v1';
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll([OFFLINE_URL, '/icon-192.png'])).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  const isStatic = url.pathname.startsWith('/assets/') || /\.(?:png|jpg|jpeg|svg|webp|woff2?|ico)$/i.test(url.pathname);
  if (!isStatic) return;

  event.respondWith(
    caches.open(STATIC).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    })
  );
});
