// API route for individual camp plans
import { Handlers } from "$fresh/server.ts";
import {
  deleteCampPlan,
  getCampPlanById,
  getItemById,
  rebuildComputedStats,
  updateCampPlan,
  updateItem,
} from "../../../db/kv.ts";
import {
  csrfFailed,
  csrfOk,
  forbidden,
  type Session,
} from "../../../lib/auth.ts";
import type { CampPlanItem } from "../../../types/inventory.ts";

/**
 * Apply inventory side effects when a camp plan's items list changes.
 * - Food items: deduct quantity from inventory when packed; restore when unpacked or removed.
 * - Non-food items: set atCamp=true when packed; set atCamp=false when returned or removed.
 *
 * Side effects are applied sequentially because each updateItem call also rewrites
 * shared computed stats.
 * Gear transitions are merged into a single updateItem call per item to avoid races.
 */
async function applyItemSideEffects(
  oldItems: CampPlanItem[],
  newItems: CampPlanItem[],
): Promise<void> {
  const oldMap = new Map(oldItems.map((i) => [i.itemId, i]));
  const newMap = new Map(newItems.map((i) => [i.itemId, i]));

  const tasks: Array<() => Promise<unknown>> = [];

  // Items removed from the plan
  for (const [itemId, old] of oldMap) {
    if (newMap.has(itemId)) {
      continue;
    }
    if (old.itemCategory === "food" && old.packedStatus) {
      // Restore food quantity that was previously deducted
      tasks.push(() =>
        getItemById(itemId).then((inv) => {
          if (inv) {
            return updateItem(itemId, {
              quantity: inv.quantity + old.quantityPlanned,
            });
          }
        })
      );
    } else if (
      old.itemCategory !== "food" && old.packedStatus && !old.returnedStatus
    ) {
      // Gear removed while still at camp — mark as returned to store
      tasks.push(() =>
        updateItem(itemId, { atCamp: false, quantityAtCamp: 0 })
      );
    }
  }

  // Items still present — check for status transitions
  for (const [itemId, newItem] of newMap) {
    const old = oldMap.get(itemId);
    if (!old) {
      continue; // newly added item, no side effect yet
    }

    if (newItem.itemCategory === "food") {
      if (!old.packedStatus && newItem.packedStatus) {
        // Food packed → deduct from inventory
        tasks.push(() =>
          getItemById(itemId).then((inv) => {
            if (inv) {
              return updateItem(itemId, {
                quantity: Math.max(0, inv.quantity - newItem.quantityPlanned),
              });
            }
          })
        );
      } else if (old.packedStatus && !newItem.packedStatus) {
        // Food unpacked → restore quantity
        tasks.push(() =>
          getItemById(itemId).then((inv) => {
            if (inv) {
              return updateItem(itemId, {
                quantity: inv.quantity + old.quantityPlanned,
              });
            }
          })
        );
      }
    } else {
      // Non-food gear — compute the final atCamp value in one pass to avoid
      // issuing two sequential updateItem calls on the same item.
      let atCamp: boolean | undefined;
      if (!old.packedStatus && newItem.packedStatus) {
        atCamp = true;
      }
      if (old.packedStatus && !newItem.packedStatus) {
        atCamp = false;
      }
      if (!old.returnedStatus && newItem.returnedStatus) {
        atCamp = false; // returned overrides
      }
      if (atCamp !== undefined) {
        const quantityAtCamp = atCamp ? newItem.quantityPlanned : 0;
        tasks.push(() => updateItem(itemId, { atCamp, quantityAtCamp }));
      }
    }
  }

  for (const task of tasks) {
    await task();
  }
}

/**
 * Validates that each planned quantity is a positive integer and does not
 * exceed available inventory for that item.
 *
 * For food items that were already marked packed in the existing plan,
 * inventory stock has already been deducted. We add that packed amount back
 * when validating to avoid falsely rejecting unchanged items on later edits.
 */
async function validatePlannedItemQuantities(
  oldItems: CampPlanItem[],
  newItems: CampPlanItem[],
): Promise<string | null> {
  const oldMap = new Map(oldItems.map((i) => [i.itemId, i]));
  const ids = [...new Set(newItems.map((i) => i.itemId))];

  const inventoryEntries = await Promise.all(
    ids.map(async (id) => [id, await getItemById(id)] as const),
  );
  const inventoryById = new Map(inventoryEntries);

  for (const item of newItems) {
    if (!Number.isInteger(item.quantityPlanned) || item.quantityPlanned < 1) {
      return `Invalid quantity for "${item.itemName}". Quantity must be a whole number of at least 1.`;
    }

    const old = oldMap.get(item.itemId);
    const inv = inventoryById.get(item.itemId);
    if (!inv) {
      // Legacy plans may reference items that were deleted from inventory.
      // Allow unchanged legacy entries so users can still edit other items,
      // but block adding or modifying deleted items.
      const unchangedLegacyItem = !!old &&
        old.quantityPlanned === item.quantityPlanned &&
        old.packedStatus === item.packedStatus &&
        old.returnedStatus === item.returnedStatus &&
        (old.notes ?? "") === (item.notes ?? "");
      if (unchangedLegacyItem) {
        continue;
      }
      return `Item "${item.itemName}" no longer exists in inventory. Remove it from this plan before editing it.`;
    }

    const alreadyDeductedFoodQty =
      old && old.itemCategory === "food" && old.packedStatus
        ? old.quantityPlanned
        : 0;
    const currentlyAtCampQty = inv.category !== "food" && inv.atCamp
      ? Math.max(0, Math.min(inv.quantity, inv.quantityAtCamp ?? inv.quantity))
      : 0;
    const thisPlanReservedNonFoodQty =
      old && old.itemCategory !== "food" && old.packedStatus &&
        !old.returnedStatus
        ? old.quantityPlanned
        : 0;
    const effectiveAvailable = (inv.quantity - currentlyAtCampQty) +
      alreadyDeductedFoodQty +
      thisPlanReservedNonFoodQty;

    if (item.quantityPlanned > effectiveAvailable) {
      return `Cannot add ${item.quantityPlanned} of "${item.itemName}". Only ${effectiveAvailable} in stock.`;
    }
  }

  return null;
}

export const handler: Handlers = {
  // GET /api/camps/[id]
  async GET(_req, ctx) {
    const { id } = ctx.params;
    try {
      const plan = await getCampPlanById(id);
      if (!plan) {
        return Response.json({ error: "Camp plan not found" }, { status: 404 });
      }
      return Response.json(plan);
    } catch (_error) {
      return Response.json({ error: "Failed to fetch camp plan" }, {
        status: 500,
      });
    }
  },

  // PATCH /api/camps/[id] — update plan metadata, status, or checklist items
  async PATCH(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") {
      return forbidden();
    }
    if (!csrfOk(req, session)) {
      return csrfFailed();
    }
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
        return Response.json({ error: "Camp plan not found" }, { status: 404 });
      }

      if (body.items) {
        if (!Array.isArray(body.items)) {
          return Response.json({ error: "items must be an array" }, {
            status: 400,
          });
        }
        const nextItems = body.items as CampPlanItem[];
        const quantityError = await validatePlannedItemQuantities(
          existing.items,
          nextItems,
        );
        if (quantityError) {
          return Response.json({ error: quantityError }, { status: 400 });
        }
        await applyItemSideEffects(existing.items, nextItems);
        await rebuildComputedStats();
      }

      const updated = await updateCampPlan(id, body, existing);
      if (!updated) {
        return Response.json({ error: "Camp plan not found" }, { status: 404 });
      }
      return Response.json(updated);
    } catch (_error) {
      return Response.json({ error: "Failed to update camp plan" }, {
        status: 500,
      });
    }
  },

  // POST /api/camps/[id]/items is handled separately; here we handle bulk item updates
  // via PATCH body with an `items` array.

  // DELETE /api/camps/[id]
  async DELETE(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") {
      return forbidden();
    }
    if (!csrfOk(req, session)) {
      return csrfFailed();
    }
    const { id } = ctx.params;
    try {
      const success = await deleteCampPlan(id);
      if (!success) {
        return Response.json({ error: "Camp plan not found" }, { status: 404 });
      }
      return Response.json({ success: true });
    } catch (_error) {
      return Response.json({ error: "Failed to delete camp plan" }, {
        status: 500,
      });
    }
  },
};
