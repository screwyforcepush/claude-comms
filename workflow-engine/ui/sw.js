// Service worker — required for PWA install prompt
//
// App shell (index.html, styles.css, manifest) is NETWORK-FIRST with cache
// fallback: it changes with every deploy, and precaching it cache-first froze
// styles.css on installed PWAs twice (see git history of this file). JS modules
// are never cached — always fresh from the network. Icons are cache-first.

const CACHE_NAME = 'cc3-v3';
const SHELL_PATHS = new Set(['/', '/index.html', '/styles.css', '/manifest.json']);
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.json',
  '/public/cc3icon.png',
  '/public/icon-192.png',
  '/public/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(() =>
      caches.match(request).then((cached) => cached || caches.match('/index.html'))
    );
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-only for anything cross-origin (Convex, esm.sh, fonts)
  if (url.origin !== self.location.origin) {
    return;
  }

  // Navigations (Vercel rewrites every path to index.html) and the shell files
  const isShell = event.request.mode === 'navigate' || SHELL_PATHS.has(url.pathname);
  if (isShell) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Cache-first for the remaining precached statics (icons); everything else
  // falls through to the network uncached.
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
