// POST /api/items/bulk-location — update location+space for a batch of items
import { Handlers } from "$fresh/server.ts";
import type { ItemLocation, ItemSpace } from "../../../types/inventory.ts";
import { updateItem } from "../../../db/kv.ts";
import {
  csrfFailed,
  csrfOk,
  forbidden,
  type Session,
} from "../../../lib/auth.ts";
import { logActivity } from "../../../lib/activityLog.ts";

export const handler: Handlers = {
  async POST(req, ctx) {
    const session = ctx.state.session as Session;
    if (session.role !== "admin" && session.role !== "editor") {
      return forbidden();
    }
    if (!csrfOk(req, session)) {
      return csrfFailed();
    }

    let body: {
      ids?: string[];
      location?: ItemLocation;
      space?: ItemSpace;
    };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { ids, location, space } = body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: "ids must be a non-empty array" }, {
        status: 400,
      });
    }
    if (!location) {
      return Response.json({ error: "location is required" }, { status: 400 });
    }
    if (ids.length > 200) {
      return Response.json({ error: "Maximum 200 items per request" }, {
        status: 400,
      });
    }

    const updates: { id: string; ok: boolean }[] = [];
    for (const id of ids) {
      const result = await updateItem(id, {
        location,
        ...(space ? { space } : {}),
      });
      updates.push({ id, ok: result !== null });
    }

    const succeeded = updates.filter((u) => u.ok).length;
    await logActivity({
      username: session.username,
      action: "item.bulk_moved",
      resource: location,
      details: `${succeeded} item${succeeded !== 1 ? "s" : ""} moved`,
    });

    return Response.json({ ok: true, succeeded, total: ids.length });
  },
};
