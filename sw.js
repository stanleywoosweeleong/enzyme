/* Eco-Enzyme Dilution Guide — service worker
   Offline-first: precache the app shell, serve from cache, fall back to network.
   Bump CACHE_VERSION on every deploy so clients pick up the new build. */
const CACHE_VERSION = 'enzyme-20260707-06';
const CACHE_NAME = 'ecoenzyme-' + CACHE_VERSION;

/* All paths are relative so the app works from any GitHub Pages subfolder. */
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()) // don't block install if one asset 404s
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('ecoenzyme-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // only handle GET; let the browser deal with the rest
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Navigation requests: network-first so users get fresh HTML when online,
  // fall back to cached index.html when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Everything else (icons, manifest): cache-first, then network, then cache the result.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});

/* Allow the page to trigger an immediate update. */
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
