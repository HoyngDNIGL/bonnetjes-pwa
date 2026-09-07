const CACHE_NAME = "bonnetjes-v1";
const SHELL_FILES = [
  "/",
  "/style.css",
  "/config.js",
  "/app.js",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

// Network-first for everything: this app is useless offline anyway (it
// needs live Graph calls), so the cache only exists to make the app shell
// load instantly and to satisfy the "installable PWA" requirement.
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
