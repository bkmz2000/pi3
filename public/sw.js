const CACHE_NAME = 'webide-v4';
const PYODIDE_VERSION = '0.29.3';

// We ship Pyodide from the same origin (public/pyodide/, mirrored from
// node_modules at build time). The CDN URLs remain as a runtime fallback
// path, so we keep them in the precache list to survive offline use if the
// local bundle is ever missing.
const PYODIDE_ASSETS = [
  '/pyodide/pyodide.mjs',
  '/pyodide/pyodide.js',
  '/pyodide/pyodide.asm.js',
  '/pyodide/pyodide.asm.wasm',
  '/pyodide/python_stdlib.zip',
  '/pyodide/pyodide-lock.json',
  `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.mjs`,
  `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`,
];

const APP_SHELL = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.svg',
  '/icon-512.svg',
];

const ALL_ASSETS = [...PYODIDE_ASSETS];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Caching libraries');
      // Use individual add() so a single missing asset (e.g. the CDN fallback
      // when offline) doesn't abort the whole install. addAll() is all-or-nothing.
      await Promise.allSettled(ALL_ASSETS.map((url) => cache.add(url)));
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
  
  const isPyodide = url.href.includes('cdn.jsdelivr.net/pyodide')
    || url.pathname.startsWith('/pyodide/');
  const isAppShell = APP_SHELL.includes(url.pathname);
  
  if (isPyodide) {
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
      fetch(event.request).then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        return caches.match(event.request).then(cached => cached || caches.match('/index.html'));
      })
    );
  }
});
