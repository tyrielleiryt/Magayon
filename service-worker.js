// service-worker.js
//
// v1 precached "./images/placeholder.png", a file that doesn't exist in
// this repo. cache.addAll() aborts the ENTIRE precache if any one URL
// 404s, so the install step has likely been silently failing on every
// visit — meaning offline mode probably never actually worked. Fixed by
// caching each asset independently, versioning the cache name, cleaning
// up old versions on activate, and using stale-while-revalidate so
// updates don't get stuck behind an old cached copy forever.

const CACHE_VERSION = "v2";
const CACHE_NAME = `magayon-pos-${CACHE_VERSION}`;

// Same-origin files only — cross-origin assets (like the Firebase SDK
// modules from gstatic.com) get picked up opportunistically by the fetch
// handler below the first time they're requested online.
const ASSETS = [
  "./",
  "./order.html",
  "./order.css",
  "./order.js",
  "./firebase-config.js",
  "./auth-guard.js",
  "./manifest.json",
  "./images/logo.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        ASSETS.map(url =>
          cache.add(url).catch(err =>
            console.warn("[SW] Failed to precache:", url, err)
          )
        )
      );
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
      self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached);

      // Serve the cached copy instantly when there is one (fast + works
      // offline); refresh the cache from the network in the background.
      return cached || network;
    })
  );
});
