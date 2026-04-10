const NODESMS_CACHE = 'nodesms-shell-v1';
const NODESMS_ASSETS = [
  '/nodesms',
  '/nodesms-manifest.json',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(NODESMS_CACHE).then((cache) => cache.addAll(NODESMS_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== NODESMS_CACHE)
          .map((cacheName) => caches.delete(cacheName))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  if (event.request.method !== 'GET') {
    return;
  }

  const isNodeSmsShell = requestUrl.pathname === '/nodesms';
  const isNodeSmsApi = requestUrl.pathname.startsWith('/api/nodesms');

  if (isNodeSmsApi) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
          JSON.stringify({
            ok: false,
            offline: true,
            message: 'NodeSMS API offline, retry when network is available.'
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      )
    );
    return;
  }

  if (isNodeSmsShell) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(NODESMS_CACHE).then((cache) => cache.put('/nodesms', responseClone));
          return response;
        })
        .catch(() => caches.match('/nodesms'))
    );
  }
});
