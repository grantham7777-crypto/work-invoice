// Bump this version whenever the app shell changes.
const CACHE_PREFIX = 'work-invoice-shell-';
const CACHE = CACHE_PREFIX + '2026-10-27-v2';
const APP_FILES = ['./', './index.html', './manifest.webmanifest', './icon.svg'];
const APP_URLS = new Set(APP_FILES.map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Bypass the HTTP cache so a new worker does not precache old app files.
    await cache.addAll(APP_FILES.map(path =>
      new Request(new URL(path, self.registration.scope), { cache: 'reload' })
    ));
    // Activate only after the complete offline shell is ready.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name =>
      // invoice-v1 is the exact legacy cache; leave other apps' caches alone.
      name === 'invoice-v1' || (name.startsWith(CACHE_PREFIX) && name !== CACHE)
    ).map(name => caches.delete(name)));
    // Native equivalent of Workbox's clientsClaim().
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Only cache known app files. Never intercept APIs, exports or other origins.
  url.search = '';
  url.hash = '';
  if (!APP_URLS.has(url.href)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(new Request(event.request, {
        cache: 'no-store',
        signal: controller.signal
      }));
      if (response.ok && response.type === 'basic') {
        // A full or unavailable cache must not prevent online use.
        await cache.put(url.href, response.clone()).catch(() => {});
      } else if (response.status >= 500) {
        const cached = await cache.match(url.href);
        if (cached) return cached;
      }
      return response;
    } catch (error) {
      const cached = await cache.match(url.href);
      if (cached) return cached;
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  })());
});
