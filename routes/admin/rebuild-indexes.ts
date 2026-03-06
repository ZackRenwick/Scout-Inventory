// POST /admin/rebuild-indexes — rebuilds all KV secondary indexes and precomputed stats
// from primary item data. Safe to run at any time; protected by the admin middleware.
import { rebuildIndexes } from "../../db/kv.ts";
import type { Session } from "../../lib/auth.ts";
import { csrfFailed, csrfOk, forbidden } from "../../lib/auth.ts";

export const handler = {
  async POST(ctx) {
    const req = ctx.req;
    const session = ctx.state.session as Session;
    if (session.role !== "admin") {
      return forbidden();
    }
    if (!csrfOk(req, session)) {
      return csrfFailed();
    }

    try {
      await rebuildIndexes();
      return Response.json({
        ok: true,
        message: "Indexes rebuilt successfully.",
      });
    } catch (err) {
      console.error("rebuildIndexes failed:", err);
      return Response.json({ error: "Rebuild failed." }, { status: 500 });
    }
  },
};
