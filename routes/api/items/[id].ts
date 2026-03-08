// API route for individual inventory items
import { deleteItem, getItemById, updateItem } from "../../../db/kv.ts";
import {
  csrfFailed,
  csrfOk,
  forbidden,
  type Session,
} from "../../../lib/auth.ts";
import { logActivity } from "../../../lib/activityLog.ts";

export const handler = {
  // GET /api/items/[id] - Get a specific item
  async GET(ctx) {
    const { id } = ctx.params;

    try {
      const item = await getItemById(id);

      if (!item) {
        return Response.json({ error: "Item not found" }, { status: 404 });
      }

      return Response.json(item);
    } catch (_error) {
      return Response.json({ error: "Failed to fetch item" }, { status: 500 });
    }
  },

  // PUT /api/items/[id] - Update an item
  async PUT(ctx) {
    const req = ctx.req;
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") {
      return forbidden();
    }
    if (!csrfOk(req, session)) {
      return csrfFailed();
    }
    const { id } = ctx.params;

    try {
      const updates = await req.json();

      // Convert date strings to Date objects if needed
      if (updates.expiryDate) {
        updates.expiryDate = new Date(updates.expiryDate);
      }

      const updatedItem = await updateItem(id, updates);

      if (!updatedItem) {
        return Response.json({ error: "Item not found" }, { status: 404 });
      }

      await logActivity({
        username: session.username,
        action: "item.updated",
        resource: updatedItem.name,
        resourceId: id,
        details: `${updatedItem.category} · qty ${updatedItem.quantity}`,
      });

      return Response.json(updatedItem);
    } catch (_error) {
      return Response.json({ error: "Failed to update item" }, { status: 500 });
    }
  },

  // DELETE /api/items/[id] - Delete an item
  async DELETE(ctx) {
    const req = ctx.req;
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") {
      return forbidden();
    }
    if (!csrfOk(req, session)) {
      return csrfFailed();
    }
    const { id } = ctx.params;

    try {
      // Fetch before deleting so we can log the item name
      const existing = await getItemById(id);
      const success = await deleteItem(id);

      if (!success) {
        return Response.json({ error: "Item not found" }, { status: 404 });
      }

      await logActivity({
        username: session.username,
        action: "item.deleted",
        resource: existing?.name,
        resourceId: id,
        details: existing
          ? `${existing.category} · qty was ${existing.quantity}`
          : undefined,
      });

      return Response.json({ success: true });
    } catch (_error) {
      return Response.json({ error: "Failed to delete item" }, { status: 500 });
    }
  },
};
