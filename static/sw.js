// Service worker for 7th Whitburn Scouts Inventory PWA
// Strategy:
//   - Static assets (CSS, JS chunks, fonts, icons): cache-first
//   - Navigation/HTML pages: network-first, cached opportunistically
//   - API / admin routes: network-only (never cache sensitive data)

const CACHE_VERSION = "v5";
const STATIC_CACHE = `scouts-static-${CACHE_VERSION}`;
const PAGE_CACHE = `scouts-pages-${CACHE_VERSION}`;

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
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/")) {
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Non-hashed Fresh JS (island entrypoints, main.js, signals.js, etc.):
  // always try network first so redeployments are picked up immediately.
  // Fall back to cache only when offline.
  if (url.pathname.startsWith("/_fresh/") && /\.js$/i.test(url.pathname)) {
    event.respondWith(networkFirstStatic(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }
});

function isStaticAsset(pathname) {
  return (
    isHashedChunk(pathname) ||
    /\.(css|svg|png|ico|woff2?|ttf)$/i.test(pathname)
  );
}

// Content-hashed Fresh chunks are immutable — safe to cache forever.
// Island entrypoints (island-*.js, main.js, signals.js, deserializer.js) are
// NOT hashed and must NOT be served cache-first, otherwise a redeployment
// causes the stale entrypoint to reference chunk hashes that no longer exist,
// breaking island hydration.
//
// This build (Fresh v2 + @fresh/plugin-vite) outputs content-hashed shared
// chunks as /_fresh/chunk-XXXXXXXX.js.  The island entrypoints at
// /_fresh/island-*.js are non-hashed thin wrappers that import those chunks;
// they must stay network-first.
//
// The /_fresh/client/assets/ check below is kept as a forward-compatibility
// safety net in case a future Fresh/Vite version starts serving hashed assets
// at that path — it has no performance cost when it never matches.
function isHashedChunk(pathname) {
  // Forward-compat: if Fresh ever routes hashed Vite assets here, cache them.
  if (pathname.startsWith("/_fresh/client/assets/")) return true;
  // Current output: chunk-XXXXXXXX.js  (8+ char uppercase/digit hash)
  return pathname.startsWith("/_fresh/") &&
    /\/chunk-[A-Z0-9]{8,}\.(js|css)$/i.test(pathname);
}

async function networkFirstStatic(request) {
  try {
    const response = await fetch(request);
    // Cache write is fire-and-forget — don't await caches.open() before
    // returning, as the IDB round-trip would delay the response for no benefit.
    if (response.ok) {
      caches.open(STATIC_CACHE)
        .then((cache) => cache.put(request, response.clone()))
        .catch(() => {});
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response("Offline", { status: 503 });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    caches.open(cacheName)
      .then((cache) => cache.put(request, response.clone()))
      .catch(() => {});
  }
  return response;
}

async function networkFirstPage(request) {
  const cached = await caches.match(request);

  // Always kick off a background network request to keep the cache fresh.
  // Only cache genuine 200 pages — redirects (30x) must not be cached.
  const networkFetch = fetch(request)
    .then((response) => {
      if (response.ok && response.status === 200) {
        caches.open(PAGE_CACHE)
          .then((cache) => cache.put(request, response.clone()))
          .catch(() => {});
      }
      return response;
    })
    .catch(() => null);

  // Stale-while-revalidate: if we have a cached copy, return it immediately
  // and let the background fetch update the cache for the next visit.
  // This avoids blocking every navigation on a full SSR round-trip, which
  // is the primary cause of 5+ second page loads when Deno KV is slow.
  if (cached) return cached;

  // Nothing cached yet — must wait for the network on first visit.
  const response = await networkFetch;
  if (response) return response;

  // Network failed and no cache — show offline message.
  // Don't fall back to the home page for a different URL — that would render
  // the wrong content at the wrong address.
  return new Response(
    "<!doctype html><html><head><meta charset=utf-8><title>Offline</title>" +
      "<meta name=viewport content='width=device-width,initial-scale=1'></head>" +
      "<body style='font-family:sans-serif;text-align:center;padding:3rem'>" +
      "<h1>You're offline</h1>" +
      "<p>This page isn't available without a network connection.</p>" +
      "<p><a href='/'>Go to homepage</a></p></body></html>",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
