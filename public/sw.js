const CACHE_NAME = 'mediascraper-cache-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.json',
  '/assets/logo.svg',
  '/css/variables.css',
  '/css/base.css',
  '/css/components.css',
  '/css/drawer.css',
  '/css/videoPlayer.css',
  '/css/responsive.css',
  '/js/app.js',
  '/js/config/constants.js',
  '/js/utils/dom.util.js',
  '/js/services/api.service.js',
  '/js/services/aiVision.service.js',
  '/js/services/audioExtractor.service.js',
  '/js/services/pdfReport.service.js',
  '/js/components/theme.component.js',
  '/js/components/history.component.js',
  '/js/components/fullscreen.component.js',
  '/js/components/imageEditor.component.js',
  '/js/components/drawer.component.js',
  '/js/components/videoPlayer.component.js',
  '/js/components/gallery.component.js',
  '/js/components/exportModal.component.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('SW cache prefetch partial warning:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  let reqUrl;
  try {
    reqUrl = new URL(event.request.url);
  } catch (e) {
    return;
  }

  // Pass-through estricto para orígenes externos (AdSense, TensorFlow, Tesseract, Fonts), API, ads.txt y Range
  if (
    reqUrl.origin !== self.location.origin ||
    reqUrl.pathname.startsWith('/api/') ||
    reqUrl.pathname === '/ads.txt' ||
    reqUrl.pathname === '/sw.js' ||
    event.request.headers.has('range')
  ) {
    return;
  }

  // Navegación HTML: Network-First para reflejar nuevos deploys al instante con respaldo offline
  const isHtmlNavigation = event.request.mode === 'navigate' || reqUrl.pathname === '/' || reqUrl.pathname.endsWith('.html');
  if (isHtmlNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
          }
          return networkRes;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  // Activos estáticos propios: Stale-While-Revalidate resiliente
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
