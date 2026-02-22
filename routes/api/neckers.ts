// API route for necker count management
// GET  /api/neckers          → { count: number }
// POST /api/neckers          → { delta?: number; value?: number } → { count: number }
import { Handlers } from "$fresh/server.ts";
import { getNeckerCount, adjustNeckerCount, setNeckerCount } from "../../db/kv.ts";
import { type Session, csrfOk, forbidden, csrfFailed } from "../../lib/auth.ts";

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
    if (!session || session.role === "viewer") {
      return forbidden();
    }
    if (!csrfOk(req, session)) {
      return csrfFailed();
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
