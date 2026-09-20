/* Service worker — app shell + progressive PDF cache */
const CACHE = 'sidur-bav-book-v1';
const PRECACHE = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/book.png',
  './data/toc.json',
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

  // Cache CDN pdf.js after first fetch
  const isPdfJs = url.hostname.includes('jsdelivr.net') && url.pathname.includes('pdfjs-dist');
  const isSameOrigin = url.origin === self.location.origin;
  if (!isSameOrigin && !isPdfJs) return;

  // Large PDF: cache-on-first-success (range requests pass through)
  const isPdf = isSameOrigin && url.pathname.endsWith('siddur.pdf');
  if (isPdf && req.headers.get('Range')) {
    // Let browser handle byte-range streaming; still try to put full response later
    event.respondWith(fetch(req).catch(() => caches.match('./siddur.pdf')));
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) {
        // Stale-while-revalidate for shell/data
        if (!isPdf) {
          fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); }).catch(() => {});
        }
        return cached;
      }
      try {
        const res = await fetch(req);
        if (res && res.ok && (isSameOrigin || isPdfJs)) {
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      } catch (e) {
        if (req.mode === 'navigate') return cache.match('./index.html');
        throw e;
      }
    })
  );
});
