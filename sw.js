/* Service worker — cache-first for app shell + prayer data */
const CACHE = 'sidur-bai-v2';
const PRECACHE = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/zmanim.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/book.png',
  './data/menus.json',
  './data/cities.json',
  './data/pages-index.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) {
        if (url.pathname.includes('/data/')) {
          fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); }).catch(() => {});
        }
        return cached;
      }
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (e) {
        if (req.mode === 'navigate') return cache.match('./index.html');
        throw e;
      }
    })
  );
});
