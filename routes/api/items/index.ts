// API route for all inventory items
import { Handlers } from "$fresh/server.ts";
import type { InventoryItem } from "../../../types/inventory.ts";
import { getAllItems, createItem, searchItems } from "../../../db/kv.ts";
import type { Session } from "../../../lib/auth.ts";

const FORBIDDEN = new Response(JSON.stringify({ error: "Insufficient permissions" }), {
  status: 403,
  headers: { "Content-Type": "application/json" },
});

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
      if (category && (category === "tent" || category === "cooking" || category === "food" || category === "camping-tools")) {
        items = items.filter(item => item.category === category);
      }

      // Apply needs-repair filter
      const needsRepair = url.searchParams.get("needsrepair");
      if (needsRepair === "true") {
        items = items.filter(item => "condition" in item && (item as { condition: string }).condition === "needs-repair");
      }
      
      // Sort by name
      items.sort((a, b) => a.name.localeCompare(b.name));
      
      return new Response(JSON.stringify(items), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (_error) {
      return new Response(JSON.stringify({ error: "Failed to fetch items" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
  
  // POST /api/items - Create a new item
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
      
      // Validate required fields
      if (!body.name || !body.category || body.quantity === undefined) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: name, category, quantity" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
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
      
      return new Response(JSON.stringify(newItem), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (_error) {
      return new Response(
        JSON.stringify({ error: "Failed to create item" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};
