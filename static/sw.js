// Service worker for 7th Whitburn Scouts Inventory PWA
// Strategy:
//   - Static assets (CSS, JS chunks, fonts, icons): cache-first
//   - Navigation/HTML pages: network-first with cache fallback
//   - API requests: network-only (never cache sensitive data)

const CACHE_VERSION = "v1";
const STATIC_CACHE  = `scouts-static-${CACHE_VERSION}`;
const PAGE_CACHE    = `scouts-pages-${CACHE_VERSION}`;

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  "/",
  "/inventory",
  "/camps",
  "/loans",
  "/styles.css",
];

// ── Install: pre-cache shell assets ─────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS)),
  );
  // Activate immediately without waiting for existing tabs to close
  self.skipWaiting();
});

// ── Activate: remove caches from older versions ──────────────────────────────
self.addEventListener("activate", (event) => {
  const validCaches = new Set([STATIC_CACHE, PAGE_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !validCaches.has(k)).map((k) => caches.delete(k)),
      )
    ),
  );
  // Take control of all open pages immediately
  self.clients.claim();
});

// ── Fetch: route requests to the right strategy ──────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Never intercept API or admin routes — always hit the network
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/")) {
    return;
  }

  // Static assets (CSS, JS, images, fonts) — cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML navigation — network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Network failed — serve cached version if available
    const cached = await caches.match(request);
    if (cached) return cached;

    // Last resort: serve the cached home page for any navigation
    const fallback = await caches.match("/");
    return fallback ?? new Response("You are offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
