const CACHE_NAME = "bonnetjes-v2";
const SHELL_FILES = [
  "./",
  "style.css",
  "config.js",
  "app.js",
  "manifest.json",
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
// needs to reach Power Automate to actually submit a receipt), so the
// cache only exists to make the app shell load instantly and to satisfy
// the "installable PWA" requirement.
self.addEventListener("fetch", (event) => {
  // "no-store" bypasses the browser's own HTTP cache (Cache-Control:
  // max-age=600 on GitHub Pages) -- without it, an update can take up to
  // 10 minutes to actually reach a device even though this handler is
  // "network-first".
  event.respondWith(
    fetch(event.request, { cache: "no-store" }).catch(() => caches.match(event.request))
  );
});
