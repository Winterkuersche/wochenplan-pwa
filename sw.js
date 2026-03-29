importScripts("./version.js");

const CACHE_NAME = APP_META.cacheName;

const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./version.js",
  "./app.js",
  "./month-engine.js",
  "./balance-utils.js",
  "./backup-utils.js",
  "./manual-month-utils.js",
  "./day-view.js",
  "./week-view.js",
  "./mep-view.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_FILES);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isNavigationRequest = event.request.mode === "navigate";
  const isStaticAssetRequest = isSameOrigin && ["script", "style", "image", "font"].includes(event.request.destination);

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (!isSameOrigin) return networkResponse;

        const responseClone = networkResponse.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });

        return networkResponse;
      })
      .catch(() => {
        if (isNavigationRequest) {
          return caches.match("./index.html", { ignoreSearch: true });
        }

        if (isStaticAssetRequest) {
          return caches.match(event.request, { ignoreSearch: true });
        }

        return caches.match(event.request);
      })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
