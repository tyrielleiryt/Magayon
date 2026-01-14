const CACHE_NAME = "magayon-pos-v1";

const ASSETS = [
  "./",
  "./order.html",
  "./order.css",
  "./order.js",
  "./manifest.json",
  "./images/placeholder.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(res => {
      return res || fetch(e.request);
    })
  );
});