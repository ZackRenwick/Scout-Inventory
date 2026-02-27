// Service worker for 7th Whitburn Scouts Inventory PWA
// Strategy:
//   - Static assets (CSS, JS chunks, fonts, icons): cache-first
//   - Navigation/HTML pages: network-first, cached opportunistically
//   - API / admin routes: network-only (never cache sensitive data)

const CACHE_VERSION = "v1";
const STATIC_CACHE  = `scouts-static-${CACHE_VERSION}`;
const PAGE_CACHE    = `scouts-pages-${CACHE_VERSION}`;

// Only pre-cache assets guaranteed to return 200 with no auth.
// Authenticated page URLs redirect to /login — addAll() rejects on any
// non-ok response, aborting the SW install entirely, so we cache pages
// opportunistically via the fetch handler instead.
const PRECACHE_ASSETS = ["/styles.css"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const validCaches = new Set([STATIC_CACHE, PAGE_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !validCaches.has(k)).map((k) => caches.delete(k)),
        )
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin, API and admin routes entirely.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/")) return;

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }
});

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/_fresh/") ||
    /\.(css|js|svg|png|ico|woff2?|ttf)$/i.test(pathname)
  );
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    // Only cache genuine 200 pages — redirects (30x) must not be cached.
    if (response.ok && response.status === 200) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const fallback = await caches.match("/");
    return (
      fallback ??
      new Response("You are offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      })
    );
  }
}
