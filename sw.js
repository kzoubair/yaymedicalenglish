/* Yay Medical English — service worker: cache-first, everything cached at install.
 * Increment CACHE_VERSION on every change to the app files. */
const CACHE_VERSION = "yme-v1";

const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "vocabulaire.js",
  "css/style.css",
  "js/strings.js",
  "js/wordmatch.js",
  "js/engine.js",
  "js/progress.js",
  "js/corrector.js",
  "js/storage.js",
  "js/sounds.js",
  "js/app.js",
  "fonts/inter-latin-wght-normal.woff2",
  "fonts/space-grotesk-latin-wght-normal.woff2",
  "fonts/noto-sans-arabic-arabic-wght-normal.woff2",
  "icons/icon.svg",
  "icons/icon-maskable.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-192.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(ASSETS.map(a => new Request(a, { cache: "reload" })))));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("yme-") && k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => (req.mode === "navigate" ? caches.match("index.html") : Response.error()));
    })
  );
});
