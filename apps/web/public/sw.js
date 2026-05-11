// Lucky Biryani — minimal service worker
// - basic offline shell (cache-first for /_next static assets, network-first for pages)
// - web push notifications + click-to-open

const CACHE = 'lbc-v1';
const STATIC = ['/', '/menu', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Don't cache API or websocket
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) return;

  // Cache-first for Next.js static assets
  if (url.pathname.startsWith('/_next/static')) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        }),
      ),
    );
    return;
  }

  // Network-first for navigations with offline fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(req).then((hit) => hit || caches.match('/')),
      ),
    );
  }
});

self.addEventListener('push', (event) => {
  let data = { title: 'Lucky Biryani', body: 'You have an update.' };
  try { if (event.data) data = event.data.json(); } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
      vibrate: [120, 60, 120],
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) {
          if (c.url.endsWith(url)) return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
