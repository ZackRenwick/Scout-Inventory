// API route for individual camp plans
import { Handlers } from "$fresh/server.ts";
import { getCampPlanById, updateCampPlan, deleteCampPlan, getItemById, updateItem } from "../../../db/kv.ts";
import { type Session, csrfOk, forbidden, csrfFailed } from "../../../lib/auth.ts";
import type { CampPlanItem } from "../../../types/inventory.ts";

/**
 * Apply inventory side effects when a camp plan's items list changes.
 * - Food items: deduct quantity from inventory when packed; restore when unpacked or removed.
 * - Non-food items: set atCamp=true when packed; set atCamp=false when returned or removed.
 *
 * All independent KV operations are issued concurrently via Promise.all.
 * Gear transitions are merged into a single updateItem call per item to avoid races.
 */
async function applyItemSideEffects(
  oldItems: CampPlanItem[],
  newItems: CampPlanItem[],
): Promise<void> {
  const oldMap = new Map(oldItems.map((i) => [i.itemId, i]));
  const newMap = new Map(newItems.map((i) => [i.itemId, i]));

  const tasks: Promise<unknown>[] = [];

  // Items removed from the plan
  for (const [itemId, old] of oldMap) {
    if (newMap.has(itemId)) continue;
    if (old.itemCategory === "food" && old.packedStatus) {
      // Restore food quantity that was previously deducted
      tasks.push(
        getItemById(itemId).then((inv) => {
          if (inv) return updateItem(itemId, { quantity: inv.quantity + old.quantityPlanned });
        }),
      );
    } else if (old.itemCategory !== "food" && old.packedStatus && !old.returnedStatus) {
      // Gear removed while still at camp — mark as returned to store
      tasks.push(updateItem(itemId, { atCamp: false, quantityAtCamp: 0 }));
    }
  }

  // Items still present — check for status transitions
  for (const [itemId, newItem] of newMap) {
    const old = oldMap.get(itemId);
    if (!old) continue; // newly added item, no side effect yet

    if (newItem.itemCategory === "food") {
      if (!old.packedStatus && newItem.packedStatus) {
        // Food packed → deduct from inventory
        tasks.push(
          getItemById(itemId).then((inv) => {
            if (inv) return updateItem(itemId, { quantity: Math.max(0, inv.quantity - newItem.quantityPlanned) });
          }),
        );
      } else if (old.packedStatus && !newItem.packedStatus) {
        // Food unpacked → restore quantity
        tasks.push(
          getItemById(itemId).then((inv) => {
            if (inv) return updateItem(itemId, { quantity: inv.quantity + old.quantityPlanned });
          }),
        );
      }
    } else {
      // Non-food gear — compute the final atCamp value in one pass to avoid
      // issuing two sequential updateItem calls on the same item.
      let atCamp: boolean | undefined;
      if (!old.packedStatus && newItem.packedStatus) atCamp = true;
      if (old.packedStatus && !newItem.packedStatus) atCamp = false;
      if (!old.returnedStatus && newItem.returnedStatus) atCamp = false; // returned overrides
      if (atCamp !== undefined) {
        const quantityAtCamp = atCamp ? newItem.quantityPlanned : 0;
        tasks.push(updateItem(itemId, { atCamp, quantityAtCamp }));
      }
    }
  }

  await Promise.all(tasks);
}

export const handler: Handlers = {
  // GET /api/camps/[id]
  async GET(_req, ctx) {
    const { id } = ctx.params;
    try {
      const plan = await getCampPlanById(id);
      if (!plan) {
        return new Response(JSON.stringify({ error: "Camp plan not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(plan), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (_error) {
      return new Response(JSON.stringify({ error: "Failed to fetch camp plan" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // PATCH /api/camps/[id] — update plan metadata, status, or checklist items
  async PATCH(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") return forbidden();
    if (!csrfOk(req, session)) return csrfFailed();
    const { id } = ctx.params;
    try {
      const body = await req.json();

      // Convert date strings
      if (body.campDate) body.campDate = new Date(body.campDate);
      if (body.endDate) body.endDate = new Date(body.endDate);

      // Fetch the plan once; reuse it for both side effects and the update to avoid
      // a redundant second read inside updateCampPlan.
      const existing = await getCampPlanById(id);
      if (!existing) {
        return new Response(JSON.stringify({ error: "Camp plan not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (body.items) {
        await applyItemSideEffects(existing.items, body.items as CampPlanItem[]);
      }

      const updated = await updateCampPlan(id, body, existing);
      if (!updated) {
        return new Response(JSON.stringify({ error: "Camp plan not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(updated), {  // updated is always set when existing was found
        headers: { "Content-Type": "application/json" },
      });
    } catch (_error) {
      return new Response(JSON.stringify({ error: "Failed to update camp plan" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // POST /api/camps/[id]/items is handled separately; here we handle bulk item updates
  // via PATCH body with an `items` array.

  // DELETE /api/camps/[id]
  async DELETE(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") return forbidden();
    if (!csrfOk(req, session)) return csrfFailed();
    const { id } = ctx.params;
    try {
      const success = await deleteCampPlan(id);
      if (!success) {
        return new Response(JSON.stringify({ error: "Camp plan not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (_error) {
      return new Response(JSON.stringify({ error: "Failed to delete camp plan" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
