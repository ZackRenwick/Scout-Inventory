// Navigation progress bar + hover prefetching
// - Shows a thin branded bar immediately on link click (perceived speed)
// - Prefetches same-origin pages on hover/focus so responses are cached by click time
// - Uses the View Transitions API cross-fade (see styles.css) on supported browsers
// - Respects prefers-reduced-motion and metered/slow network connections
(function () {
  // Pick up the brand colour from the already-rendered <meta name="theme-color">
  // so this file stays static regardless of APP_MODE.
  const COLOR =
    document.querySelector('meta[name="theme-color"]')?.content ?? "#7c3aed";

  // True when the user prefers reduced motion — skip bar animation.
  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Returns true when prefetching would waste data (metered or very slow connection).
  function isConstrainedNetwork() {
    const conn = navigator.connection;
    if (!conn) return false;
    return conn.saveData || conn.effectiveType === "slow-2g" || conn.effectiveType === "2g";
  }

  // ── Progress bar ────────────────────────────────────────────────────────────

  function getBar() {
    let bar = document.getElementById("_npb");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "_npb";
      bar.style.cssText =
        "position:fixed;top:0;left:0;height:3px;z-index:9999;" +
        "pointer-events:none;background:" +
        COLOR +
        ";width:0;opacity:0;transition:none;";
      document.body.appendChild(bar);
    }
    return bar;
  }

  function startBar() {
    if (REDUCED_MOTION) return;
    const bar = getBar();
    // Reset without transition, then animate toward 85 %
    bar.style.cssText =
      "position:fixed;top:0;left:0;height:3px;z-index:9999;" +
      "pointer-events:none;background:" +
      COLOR +
      ";width:0;opacity:1;transition:none;";
    bar.offsetWidth; // force reflow so the reset takes effect
    bar.style.transition = "width 8s cubic-bezier(0.05,0.5,0.5,1)";
    bar.style.width = "85%";
  }

  function finishBar() {
    if (REDUCED_MOTION) return;
    const bar = getBar();
    bar.style.transition = "width 150ms ease";
    bar.style.width = "100%";
    setTimeout(() => {
      bar.style.transition = "opacity 200ms ease";
      bar.style.opacity = "0";
    }, 150);
  }

  // ── Hover / focus prefetching ────────────────────────────────────────────────

  const prefetched = new Set();

  function prefetch(href) {
    if (prefetched.has(href)) return;
    prefetched.add(href);
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = href;
    link.as = "document";
    document.head.appendChild(link);
  }

  function tryPrefetch(event) {
    if (isConstrainedNetwork()) return;
    const anchor = event.target.closest("a");
    if (!anchor) return;
    const raw = anchor.getAttribute("href");
    if (!raw || raw[0] === "#" || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    try {
      const url = new URL(raw, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      prefetch(url.href);
    } catch (_) {
      // malformed href — ignore
    }
  }

  document.addEventListener("mouseover", tryPrefetch, { passive: true });
  document.addEventListener("touchstart", tryPrefetch, { passive: true });
  // capture:true so we see focus on links inside shadow roots / components too
  document.addEventListener("focus", tryPrefetch, { passive: true, capture: true });

  // ── Idle prefetch of all nav links ──────────────────────────────────────────
  // After the page is fully loaded, prefetch every same-origin link found in
  // <nav> elements during browser idle time. This warms the cache for any page
  // the user might navigate to next, without competing with the current render.
  // Skipped entirely on metered or slow connections.

  function prefetchNavLinksOnIdle() {
    if (isConstrainedNetwork()) return;

    const schedule = window.requestIdleCallback
      ? (fn) => requestIdleCallback(fn, { timeout: 3000 })
      : (fn) => setTimeout(fn, 200);

    schedule(() => {
      const navAnchors = document.querySelectorAll("nav a[href]");
      navAnchors.forEach((anchor) => {
        const raw = anchor.getAttribute("href");
        if (!raw || raw[0] === "#" || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
        try {
          const url = new URL(raw, location.href);
          if (url.origin !== location.origin) return;
          if (url.pathname === location.pathname && url.search === location.search) return;
          prefetch(url.href);
        } catch (_) {
          // malformed href — ignore
        }
      });
    });
  }

  // Run after load so it never delays the current page's critical resources.
  if (document.readyState === "complete") {
    prefetchNavLinksOnIdle();
  } else {
    window.addEventListener("load", prefetchNavLinksOnIdle, { once: true });
  }

  // ── Click → start bar ───────────────────────────────────────────────────────

  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a");
    if (!anchor) return;
    const raw = anchor.getAttribute("href");
    if (!raw || raw[0] === "#" || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    try {
      const url = new URL(raw, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
    } catch (_) {
      return;
    }
    // Flag survives the navigation so the new page can complete the bar
    sessionStorage.setItem("_npb", "1");
    startBar();
  });

  // ── New page load → finish bar ──────────────────────────────────────────────

  window.addEventListener("pageshow", () => {
    if (sessionStorage.getItem("_npb")) {
      sessionStorage.removeItem("_npb");
      finishBar();
    }
  });
})();
