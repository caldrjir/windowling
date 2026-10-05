/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

// PWA foundation only: precache the immutable app shell assets.
// Pages and API calls always go to the network - the world lives on the server.
const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `windowling-${version}`;
// Large on-demand runtimes (speech recognition) are fetched only by players who use them.
const ASSETS = [...build, ...files].filter((path) => !/\/ort-wasm[^/]*$/.test(path));

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => sw.skipWaiting()),
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
			)
			.then(() => sw.clients.claim()),
	);
});

sw.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin || !ASSETS.includes(url.pathname)) return;

	event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
});
