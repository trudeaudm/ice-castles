/* Service worker: keeps the park usable where cell service isn't.
   Artwork and vendor stay cache-first. HTML/CSS/JS are network-first so
   a new deploy is what guests see, with the last good copy as fallback.

   Private /api responses (bootstrap with session tokens, names, email) are
   never stored in this shared URL-keyed cache. Guest progress offline uses
   the guest-scoped localStorage snapshot in api.js instead. */
const CACHE = 'icecastles-v142';
const SHELL = [
  '/', '/app.css?v=113', '/manifest.webmanifest',
  '/js/guest-support.js?v=1', '/js/api.js?v=25', '/js/map.js?v=31',
  '/js/scanner.js?v=20', '/js/wind-wisps.js?v=9', '/js/app.js?v=126',
  '/vendor/leaflet.js', '/vendor/leaflet.css', '/vendor/jsqr.js',
  '/assets/park-map.webp', '/assets/art/logo-mark.svg?v=4', '/assets/art/logo-mark.png?v=4', '/assets/art/logo-mark-app.png?v=4',
  '/assets/art/icon-threshold.svg?v=1', '/assets/art/icon-builders.svg?v=1', '/assets/art/icon-throne.svg?v=1',
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

function isFreshPath(pathname) {
  return pathname === '/'
    || pathname.endsWith('.html')
    || pathname.endsWith('.css')
    || pathname.endsWith('.js')
    || pathname.startsWith('/nh')
    || pathname.startsWith('/mtl');
}

function isPrivateApi(pathname) {
  return pathname.startsWith('/api/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/admin')) return;

  // Never put guest/session API bodies into the shared Cache Storage.
  if (isPrivateApi(url.pathname)) {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ error: 'offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }))
    );
    return;
  }

  if (isFreshPath(url.pathname)) {
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
