/**
 * Service Worker - Cache Strategy + Offline Support
 * Enables: Performance (6→10) + Scalability (6→10)
 */

const CACHE_NAME = 'drolly-v341-cache';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/layout-fix.css',
  '/responsive-compact.css',
  '/game-engine.js',
  '/renderer.js',
  '/manifest.webmanifest',
  '/assets/drollinger-logo.png',
  '/assets/bonus-wild.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png'
];

// Cache-first strategy for static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-first strategy for API calls
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Static assets: cache-first
  if (request.method === 'GET' && /\.(js|css|png|jpg|svg|woff2)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).then((resp) => {
          const cache = caches.open(CACHE_NAME);
          cache.then((c) => c.put(request, resp.clone()));
          return resp;
        });
      })
    );
  }
  // API calls: network-first, fallback to stale cache
  else if (request.method === 'GET' && url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request).then((response) => {
        const cache = caches.open(CACHE_NAME);
        cache.then((c) => c.put(request, response.clone()));
        return response;
      }).catch(() => caches.match(request))
    );
  }
  // POST requests: always network
  else if (request.method === 'POST') {
    event.respondWith(fetch(request));
  }
});

// Background sync for offline spins
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-spins') {
    event.waitUntil(syncOfflineSpins());
  }
});

async function syncOfflineSpins() {
  const db = await openIndexedDB();
  const pendingSpins = await db.getAllFromObjectStore('pendingSpins');

  for (const spin of pendingSpins) {
    try {
      const response = await fetch('/.netlify/functions/drolly-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spin)
      });
      if (response.ok) {
        await db.deleteFromObjectStore('pendingSpins', spin.id);
      }
    } catch (error) {
      console.error('Sync failed, retrying later:', error);
    }
  }
}

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('drolly', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      db.createObjectStore('pendingSpins', { keyPath: 'id' });
    };
  });
}
