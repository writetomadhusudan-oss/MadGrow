/*
 * MadGrow service worker.
 *
 * Deliberately narrow. It caches the shell — the build's static chunks and the
 * icons — so the installed app opens quickly and survives a flaky connection.
 * It never caches /api or page HTML: prices, wallets and orders must always
 * come from the network, because a trading simulator that replays stale prices
 * as current teaches the wrong lesson. Offline, the app says so instead.
 */

const VERSION = "madgrow-v1";
const SHELL = `${VERSION}-shell`;

/* Fetched on install so the offline notice exists the first time the network drops. */
const PRECACHE = ["/offline", "/icons/icon-192.png"];

/* Addressed by build hash or part of the brand, so a cached copy is always correct. */
const CACHEABLE = ["/_next/static/", "/icons/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pages always come from the network so every price on them is current.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline")));
    return;
  }

  if (!CACHEABLE.some((prefix) => url.pathname.startsWith(prefix))) return;

  event.respondWith(
    caches.open(SHELL).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
