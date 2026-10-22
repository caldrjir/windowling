// The earlier Windowling (a different app) installed a service worker that cached its files.
// This replacement removes those caches and unregisters itself, so nothing stale is served.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) await caches.delete(key);
			await self.registration.unregister();
			for (const client of await self.clients.matchAll({ type: 'window' }))
				client.navigate(client.url);
		})(),
	);
});
