// Service worker — required for PWA install prompt
// Cache-first for static assets, network-first for API calls

const CACHE_NAME = 'cc3-v1';
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

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-only for Convex and esm.sh (live data + CDN modules)
  if (url.hostname.includes('convex') || url.hostname.includes('esm.sh')) {
    return;
  }

  // Cache-first for local static assets
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
