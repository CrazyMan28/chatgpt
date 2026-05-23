// Service Worker for Screen Streamer PWA
// This service worker enables offline caching for static assets and dynamic API responses.

const CACHE_NAME = 'screen-streamer-v2';
const STATIC_ASSETS = [
  '/',
  '/static/spinner.css',
  '/static/manifest.json',
  '/favicon.ico',
  '/favicon-dark.ico',
  '/static/icon-192x192.png',
  '/static/icon-512x512.png',
  '/static/offline.html'
];

const DYNAMIC_APIS = [
  '/stream'  // Prioritize network-first for real-time streaming
];

// Install event: Cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((error) => {
        console.error('Failed to cache static assets:', error);
      })
  );
});

// Fetch event: Network-first for dynamic APIs, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-first strategy for dynamic APIs (e.g., /stream)
  if (DYNAMIC_APIS.some(api => url.pathname.startsWith(api))) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and cache successful responses
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseClone);
            });
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request);
        })
    );
  }
  // Cache-first strategy for static assets
  else {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          return cachedResponse || fetch(event.request);
        })
        .catch(() => {
          return caches.match('/static/offline.html');
        })
    );
  }
});

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});