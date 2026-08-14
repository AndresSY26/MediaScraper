const CACHE_NAME = 'mediascraper-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.json',
  '/ads.txt',
  '/assets/logo.svg',
  '/css/variables.css',
  '/css/base.css',
  '/css/components.css',
  '/css/drawer.css',
  '/css/videoPlayer.css',
  '/css/responsive.css',
  '/js/app.js',
  '/js/config/constants.js',
  '/js/services/api.service.js',
  '/js/services/aiVision.service.js',
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
        console.warn('SW cache prefetch partial error:', err);
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
  // Pass-through for API requests, stream proxies, and external CDNs
  if (event.request.url.includes('/api/') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Network in background to revalidate cache
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    })
  );
});
