// Root middleware — protects all routes except /login and public assets
import { FreshContext } from "$fresh/server.ts";
import { getSessionCookie, getSession, extendSession, ensureDefaultAdmin, makeSessionCookie, type Session } from "../lib/auth.ts";

// Routes that don't require authentication
const PUBLIC_PATHS = ["/login", "/styles.css", "/api/joke", "/api/ping"];

// True when running on Deno Deploy
const IS_DEPLOYED = !!Deno.env.get("DENO_DEPLOYMENT_ID");

// Synthetic session injected for local dev bypass
const DEV_SESSION: Session = {
  id: "local-dev",
  userId: "local-dev",
  username: "dev",
  role: "admin",
  expiresAt: new Date(Date.now() + 1e12).toISOString(),
  csrfToken: "dev-csrf-token",
};

export async function handler(req: Request, ctx: FreshContext) {
  const url = new URL(req.url);
  const path = url.pathname;

  // Allow public paths and static assets — add long-lived cache headers for immutable assets
  if (
    PUBLIC_PATHS.includes(path) ||
    path.startsWith("/_fresh/") ||
    path.startsWith("/static/")
  ) {
    const res = await ctx.next();
    if (path.startsWith("/_fresh/")) {
      // Versioned chunks — immutable for 1 year
      res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else if (path === "/styles.css" || path.startsWith("/static/")) {
      // Static assets — cache for 1 day, revalidate
      res.headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    }
    return res;
  }

  // Local dev bypass — only when DEV_BYPASS=true AND request is from localhost
  if (
    Deno.env.get("DEV_BYPASS") === "true" &&
    !IS_DEPLOYED &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  ) {
    ctx.state.session = DEV_SESSION;
    return ctx.next();
  }

  // Validate session
  const sessionId = getSessionCookie(req);
  const session: Session | null = sessionId ? await getSession(sessionId) : null;

  if (!session) {
    await ensureDefaultAdmin();
    const loginUrl = `/login?redirect=${encodeURIComponent(path)}`;
    return new Response(null, { status: 302, headers: { location: loginUrl } });
  }

  // Attach session to state so handlers/pages can read it
  ctx.state.session = session;

  // Rolling session — extend expiry on every authenticated request so
  // any activity (navigation, API call, form submission) resets the idle timer.
  const [res] = await Promise.all([
    ctx.next(),
    extendSession(sessionId!),
  ]);

  // Re-issue the cookie so the browser Max-Age counter also resets.
  res.headers.append("Set-Cookie", makeSessionCookie(sessionId!));

  return res;
}
