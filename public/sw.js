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

// Freeze-updates mode: when the app tells us the signed-in teacher has
// enabled freeze, we hold this SW in "waiting" and refuse to serve the new
// bundle to any tab until the flag flips off. Persisted in a distinct
// cache slot so it survives worker restarts.
const META_CACHE = 'webide-meta-v1';
const FREEZE_KEY = new Request('/__freeze_flag__');

async function isFrozen() {
  try {
    const cache = await caches.open(META_CACHE);
    const res = await cache.match(FREEZE_KEY);
    if (!res) return false;
    return (await res.text()) === '1';
  } catch {
    return false;
  }
}

async function setFrozen(on) {
  const cache = await caches.open(META_CACHE);
  await cache.put(FREEZE_KEY, new Response(on ? '1' : '0'));
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'set_freeze') {
    event.waitUntil((async () => {
      await setFrozen(!!data.on);
      // When unfreezing, immediately claim + skipWaiting so the queued bundle
      // takes over. When freezing, do nothing extra — SW stays where it is.
      if (!data.on) {
        await self.skipWaiting();
        await self.clients.claim();
      }
    })());
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    console.log('[SW] Caching libraries');
    // Use individual add() so a single missing asset (e.g. the CDN fallback
    // when offline) doesn't abort the whole install. addAll() is all-or-nothing.
    await Promise.allSettled(ALL_ASSETS.map((url) => cache.add(url)));
    console.log('[SW] Libraries cached');
    // Only auto-promote when NOT frozen — frozen SWs stay in "waiting" until
    // the teacher unfreezes, keeping the running bundle stable mid-lesson.
    if (!(await isFrozen())) {
      await self.skipWaiting();
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          // Preserve the meta cache across upgrades so the freeze flag survives.
          .filter((name) => name !== CACHE_NAME && name !== META_CACHE)
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
