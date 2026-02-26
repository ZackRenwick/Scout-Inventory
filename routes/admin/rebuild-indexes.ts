// POST /admin/rebuild-indexes — rebuilds all KV secondary indexes and precomputed stats
// from primary item data. Safe to run at any time; protected by the admin middleware.
import type { Handlers } from "$fresh/server.ts";
import { rebuildIndexes } from "../../db/kv.ts";
import type { Session } from "../../lib/auth.ts";

export const handler: Handlers = {
  async POST(req, ctx) {
    const session = ctx.state.session as Session;
    if (session.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { "Content-Type": "application/json" } });
    }
    const csrfHeader = req.headers.get("X-CSRF-Token");
    if (!csrfHeader || csrfHeader !== session.csrfToken) {
      return new Response(JSON.stringify({ error: "Invalid CSRF token" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      await rebuildIndexes();
      return new Response(JSON.stringify({ ok: true, message: "Indexes rebuilt successfully." }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("rebuildIndexes failed:", err);
      return new Response(JSON.stringify({ error: "Rebuild failed." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
