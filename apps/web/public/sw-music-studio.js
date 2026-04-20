// Clisonix Service Worker - static assets + offline fallback
const CACHE_NAME = "clisonix-app-v4";
const APP_SHELL_ASSETS = [
  "/",
  "/manifest.json",
  "/manifest-music-studio.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/music-studio-192.png",
  "/icons/music-studio-512.png",
  "/offline",
  "/_offline",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (name) => name.startsWith("clisonix-") && name !== CACHE_NAME,
            )
            .map((name) => caches.delete(name)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  // APIs should stay fresh and never be served stale from cache.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => response)
        .catch(async () => {
          return (
            (await caches.match("/offline")) ||
            (await caches.match("/_offline"))
          );
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === "error") {
          return response;
        }

        // Keep cache focused on static shell assets only.
        if (
          url.pathname.startsWith("/icons/") ||
          url.pathname === "/manifest.json" ||
          url.pathname === "/manifest-music-studio.json"
        ) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      });
    }),
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "generate-music") {
    event.waitUntil(Promise.resolve());
  }
});

self.addEventListener("push", (event) => {
  const options = {
    body: event.data ? event.data.text() : "Music generation complete!",
    icon: "/icons/music-studio-192.png",
    badge: "/icons/badge.png",
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification("Music Studio", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/modules/music-studio"));
});
