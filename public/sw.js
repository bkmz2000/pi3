const CACHE_NAME = 'webide-v2';
const PYODIDE_VERSION = '0.26.4';
const RUFF_VERSION = '0.15.8';

const PYODIDE_ASSETS = [
  `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.mjs`,
  `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`,
];

const RUFF_ASSETS = [
  `https://cdn.jsdelivr.net/npm/@astral-sh/ruff-wasm-web@${RUFF_VERSION}/ruff_wasm.js`,
  `https://cdn.jsdelivr.net/npm/@astral-sh/ruff-wasm-web@${RUFF_VERSION}/ruff_wasm_bg.wasm`,
];

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.svg',
  '/icon-512.svg',
];

const ALL_ASSETS = [...PYODIDE_ASSETS, ...RUFF_ASSETS];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Caching app shell and libraries');
      try {
        await cache.addAll(APP_SHELL);
        console.log('[SW] App shell cached');
      } catch (e) {
        console.log('[SW] App shell caching failed:', e);
      }
      await cache.addAll(ALL_ASSETS);
      console.log('[SW] Libraries cached');
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  const isPyodide = url.href.includes('cdn.jsdelivr.net/pyodide');
  const isRuff = url.href.includes('@astral-sh/ruff-wasm-web');
  const isAppShell = APP_SHELL.includes(url.pathname);
  
  if (isPyodide || isRuff) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          return new Response('Network error', { status: 408 });
        });
      })
    );
    return;
  }
  
  if (isAppShell || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          return caches.match('/index.html');
        });
      })
    );
  }
});
