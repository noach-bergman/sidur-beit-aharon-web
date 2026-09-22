/* Service worker — printed book reader */
const CACHE = 'sidur-bav-book-v12';
const PRECACHE = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/today.js',
  './js/vendor/hebcal.min.js',
  './manifest.webmanifest',
  './data/toc.json',
  './data/menu.json',
  './icons/book.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/tfilonHe.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_ALL') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  // Old text-reader paths → send them home (breaks stale cached JS loops)
  if (isSameOrigin && /\/data\/pages\//.test(url.pathname)) {
    event.respondWith(Response.redirect(new URL('./', url).href, 302));
    return;
  }

  const isPdfJs = url.hostname.includes('jsdelivr.net') && url.pathname.includes('pdfjs-dist');
  if (!isSameOrigin && !isPdfJs) return;

  const isPdf = isSameOrigin && url.pathname.endsWith('siddur.pdf');
  if (isPdf && req.headers.get('Range')) {
    event.respondWith(fetch(req).catch(() => caches.match('./siddur.pdf')));
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // Network-first for HTML/JS/CSS so updates win over stale shell
      const isShell = isSameOrigin && (
        url.pathname.endsWith('.html') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('/') ||
        url.pathname.endsWith('toc.json') ||
        url.pathname.endsWith('manifest.webmanifest')
      );
      if (isShell) {
        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
          return res;
        } catch (e) {
          const cached = await cache.match(req);
          if (cached) return cached;
          throw e;
        }
      }

      const cached = await cache.match(req);
      if (cached) {
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
        if (isPdf) {
          const pdfCached = await cache.match('./siddur.pdf');
          if (pdfCached) return pdfCached;
        }
        throw e;
      }
    })
  );
});
