/* Service worker: keeps the park usable where cell service isn't.
   Shell + map artwork are cached on install; API calls always try the
   network first and fall back to the last good response. */
const CACHE = 'icecastles-v4';
const SHELL = [
  '/', '/app.css?v=4', '/manifest.webmanifest',
  '/js/api.js?v=4', '/js/map.js?v=4', '/js/scanner.js?v=4', '/js/app.js?v=4',
  '/vendor/leaflet.js', '/vendor/leaflet.css', '/vendor/jsqr.js',
  '/assets/park-map.webp', '/assets/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/admin')) return;

  // Bootstrap: network first so content edits show up, cache as the safety net.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
