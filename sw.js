// Бота without the network: the service worker of the site keeps this version of the app — the
// page, its modules, icons, Preact and the fonts — so the app installed on a phone opens offline.
// A template: tools/site.mjs fills in VERSION (the commit) and CORE (the files of the version).
const VERSION = '51d4143';
const CORE = [
 "./",
 "app.js?v=51d4143",
 "art.js?v=51d4143",
 "audio-index.js?v=51d4143",
 "content-a2.js?v=51d4143",
 "content-b1.js?v=51d4143",
 "content-b2.js?v=51d4143",
 "content.js?v=51d4143",
 "exam.js?v=51d4143",
 "fsrs.js?v=51d4143",
 "mic.js?v=51d4143",
 "stats.js?v=51d4143",
 "typing.js?v=51d4143",
 "voice.js?v=51d4143",
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
  // The page itself: the network first, so a new version arrives at once; the kept page of this
  // version offline, or after three seconds of a weak network, so the app never waits on a white
  // screen. The page from the network is not kept: a newer page points at modules this version does
  // not keep, and a new version keeps its own page when it installs (CORE). Other addresses opened as
  // pages (a calendar file of the reminder) are never taken for the page.
  if (request.mode === 'navigate' && url.origin === self.location.origin && /\/(index\.html)?$/.test(url.pathname)) {
    event.respondWith((async () => {
      const net = fetch(request);
      net.catch(() => { /* answered by the kept page */ });
      const copy = await caches.match('./');
      if (!copy) return net;
      const late = new Promise((resolve) => { setTimeout(() => resolve(copy), 3000); });
      try {
        return await Promise.race([net.then((r) => (r.ok ? r : copy)), late]);
      } catch (e) {
        return copy;
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
