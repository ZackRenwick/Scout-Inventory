// API route for necker count management
// GET  /api/neckers          → { count: number }
// POST /api/neckers          → { delta?: number; value?: number } → { count: number }
import { Handlers } from "$fresh/server.ts";
import { getNeckerCount, adjustNeckerCount, setNeckerCount } from "../../db/kv.ts";
import type { Session } from "../../lib/auth.ts";

const FORBIDDEN = new Response(JSON.stringify({ error: "Insufficient permissions" }), {
  status: 403,
  headers: { "Content-Type": "application/json" },
});

export const handler: Handlers = {
  async GET() {
    try {
      const count = await getNeckerCount();
      return new Response(JSON.stringify({ count }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (_e) {
      return new Response(JSON.stringify({ error: "Failed to fetch necker count" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  async POST(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") return FORBIDDEN;

    const csrfHeader = req.headers.get("X-CSRF-Token");
    if (!csrfHeader || csrfHeader !== session.csrfToken) {
      return new Response(JSON.stringify({ error: "Invalid CSRF token" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const body = await req.json();
      let count: number;

      if (typeof body.value === "number") {
        count = await setNeckerCount(body.value);
      } else if (typeof body.delta === "number") {
        count = await adjustNeckerCount(body.delta);
      } else {
        return new Response(JSON.stringify({ error: "Provide 'delta' or 'value'" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ count }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (_e) {
      return new Response(JSON.stringify({ error: "Failed to update necker count" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
