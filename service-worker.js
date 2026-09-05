// service-worker.js
//
// v1 precached "./images/placeholder.png", a file that doesn't exist in
// this repo. cache.addAll() aborts the ENTIRE precache if any one URL
// 404s, so the install step has likely been silently failing on every
// visit — meaning offline mode probably never actually worked. Fixed by
// caching each asset independently, versioning the cache name, and
// cleaning up old versions on activate.
//
// v2's fetch handler was cache-first ("serve the cached copy instantly
// when there is one"): every visit showed whatever was cached from the
// PREVIOUS visit, and only refreshed the cache in the background for
// the visit after that — so tablets kept showing old features/styles no
// matter how many times someone reloaded, since a normal reload doesn't
// bypass a service worker's own cache. v3 flips this to network-first:
// always try the network for the freshest copy, and only fall back to
// the cache when the request actually fails (actually offline).

const CACHE_VERSION = "v3";
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
    fetch(e.request)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
        }
        return res;
      })
      // Only reached when the network request itself fails (offline,
      // DNS failure, etc.) — falls back to whatever was last cached.
      .catch(() => caches.match(e.request))
  );
});
