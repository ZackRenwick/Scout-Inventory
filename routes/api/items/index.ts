// API route for all inventory items
import { Handlers } from "$fresh/server.ts";
import type { InventoryItem } from "../../../types/inventory.ts";
import { getAllItems, createItem, searchItems } from "../../../db/kv.ts";
import { type Session, csrfOk, forbidden, csrfFailed } from "../../../lib/auth.ts";
import { validateItemBase, validateFoodItem } from "../../../lib/validation.ts";
import { logActivity } from "../../../lib/activityLog.ts";

export const handler: Handlers = {
  // GET /api/items - Get all items or search
  async GET(req) {
    const url = new URL(req.url);
    const searchQuery = url.searchParams.get("search");
    const category = url.searchParams.get("category");
    
    try {
      let items = await getAllItems();
      
      // Apply search filter
      if (searchQuery) {
        items = await searchItems(searchQuery);
      }
      
      // Apply category filter
      const validCategories = ["tent", "cooking", "food", "camping-tools", "games"];
      if (category && validCategories.includes(category)) {
        items = items.filter(item => item.category === category);
      }

      // Apply needs-repair filter
      const needsRepair = url.searchParams.get("needsrepair");
      if (needsRepair === "true") {
        items = items.filter(item => {
          const condRepair = "condition" in item && (item as { condition: string }).condition === "needs-repair";
          const partialRepair = ((item as { quantityNeedsRepair?: number }).quantityNeedsRepair ?? 0) > 0;
          return condRepair || partialRepair;
        });
      }
      
      // Sort by name
      items.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      
      return Response.json(items);
    } catch (_error) {
      return Response.json({ error: "Failed to fetch items" }, { status: 500 });
    }
  },
  
  // POST /api/items - Create a new item
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
      
      // Validate base fields
      const baseErr = validateItemBase(body);
      if (baseErr) {
        return Response.json({ error: baseErr }, { status: 400 });
      }
      // Validate food-specific fields
      if (body.category === "food") {
        const foodErr = validateFoodItem(body);
        if (foodErr) {
          return Response.json({ error: foodErr }, { status: 400 });
        }
      }
      
      // Create new item with defaults
      const newItem: InventoryItem = {
        ...body,
        id: crypto.randomUUID(),
        addedDate: new Date(),
        lastUpdated: new Date(),
      };
      
      // Convert date strings to Date objects if needed
      if (body.expiryDate && body.category === "food") {
        (newItem as { expiryDate: Date }).expiryDate = new Date(body.expiryDate);
      }
      
      await createItem(newItem);
      
      await logActivity({
        username: session.username,
        action: "item.created",
        resource: newItem.name,
        resourceId: newItem.id,
        details: `${newItem.category} · qty ${newItem.quantity}`,
      });

      return Response.json(newItem, { status: 201 });
    } catch (_error) {
      return Response.json({ error: "Failed to create item" }, { status: 500 });
    }
  },
};
