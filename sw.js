// Бота without the network: the service worker of the site keeps this version of the app — the
// page, its modules, icons, Preact and the fonts — so the app installed on a phone opens offline.
// A template: tools/site.mjs fills in VERSION (the commit) and CORE (the files of the version).
const VERSION = 'e7a2bae';
const CORE = [
 "./",
 "app.js?v=e7a2bae",
 "art.js?v=e7a2bae",
 "audio-index.js?v=e7a2bae",
 "content-a2.js?v=e7a2bae",
 "content-b1.js?v=e7a2bae",
 "content-b2.js?v=e7a2bae",
 "content.js?v=e7a2bae",
 "fsrs.js?v=e7a2bae",
 "mic.js?v=e7a2bae",
 "stats.js?v=e7a2bae",
 "typing.js?v=e7a2bae",
 "voice.js?v=e7a2bae",
 "apple-touch-icon.png",
 "icon-192.png",
 "icon-512.png",
 "icon-maskable-512.png",
 "manifest.webmanifest",
 "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Nunito:wght@700;800;900&display=swap",
 "https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.module.js"
];
const SHELL = `bota-${VERSION}`;
// Preact and the fonts do not change with a version: they stay across updates.
const SHARED = 'bota-shared';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    // The app's own files must all be kept; a missing font or CDN file must not stop the install.
    await shell.addAll(CORE.filter((url) => !/^https?:/.test(url)));
    const shared = await caches.open(SHARED);
    await Promise.all(CORE.filter((url) => /^https?:/.test(url)).map((url) => shared.add(url).catch(() => {})));
    // Module addresses carry their version, so the new worker may take over at once.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('bota-') && key !== SHELL && key !== SHARED).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

// The kept copy, or the network, kept for the next time.
async function kept(request, name) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) (await caches.open(name)).put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // The page itself: the network first, so a new version arrives at once; the kept page offline.
  // Other addresses opened as pages (a calendar file of the reminder) are never kept as the page.
  if (request.mode === 'navigate' && url.origin === self.location.origin && /\/(index\.html)?$/.test(url.pathname)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) (await caches.open(SHELL)).put('./', response.clone());
        return response;
      } catch (e) {
        return (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }
  // Recorded phrases go to the network as they are: Safari plays sound through a service worker
  // only with byte ranges, which a kept copy does not give.
  if (url.origin === self.location.origin && url.pathname.includes('/audio/')) return;
  if (url.origin === self.location.origin) {
    event.respondWith(kept(request, SHELL));
    return;
  }
  if (/(^|\.)jsdelivr\.net$|^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) event.respondWith(kept(request, SHARED));
});
