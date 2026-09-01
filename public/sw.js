/* Service worker: keeps the park usable where cell service isn't.
   Artwork and vendor stay cache-first. HTML/CSS/JS are network-first so
   a new deploy is what guests see, with the last good copy as fallback. */
const CACHE = 'icecastles-v20';
const SHELL = [
  '/', '/app.css?v=20', '/manifest.webmanifest',
  '/js/api.js?v=19', '/js/map.js?v=19', '/js/scanner.js?v=19', '/js/app.js?v=19',
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

function isFreshPath(pathname) {
  return pathname === '/'
    || pathname.endsWith('.html')
    || pathname.endsWith('.css')
    || pathname.endsWith('.js')
    || pathname.startsWith('/nh');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/admin')) return;

  if (url.pathname.startsWith('/api/') || isFreshPath(url.pathname)) {
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
