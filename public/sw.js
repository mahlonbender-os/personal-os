// One-time cleanup for phones that already installed the old offline worker.
// This file does not cache anything and does not stay registered.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.registration.unregister();
    await self.clients.claim();
    const windows = await self.clients.matchAll({ type: 'window' });
    await Promise.all(windows.map((client) => client.navigate(client.url)));
  })());
});
