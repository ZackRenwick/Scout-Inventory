// API route for individual inventory items
import { Handlers } from "$fresh/server.ts";
import { getItemById, updateItem, deleteItem } from "../../../db/kv.ts";
import type { Session } from "../../../lib/auth.ts";

const FORBIDDEN = new Response(JSON.stringify({ error: "Insufficient permissions" }), {
  status: 403,
  headers: { "Content-Type": "application/json" },
});

export const handler: Handlers = {
  // GET /api/items/[id] - Get a specific item
  async GET(_req, ctx) {
    const { id } = ctx.params;
    
    try {
      const item = await getItemById(id);
      
      if (!item) {
        return new Response(JSON.stringify({ error: "Item not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify(item), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (_error) {
      return new Response(JSON.stringify({ error: "Failed to fetch item" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
  
  // PUT /api/items/[id] - Update an item
  async PUT(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") return FORBIDDEN;
    const { id } = ctx.params;
    
    try {
      const updates = await req.json();
      
      // Convert date strings to Date objects if needed
      if (updates.expiryDate) {
        updates.expiryDate = new Date(updates.expiryDate);
      }
      
      const updatedItem = await updateItem(id, updates);
      
      if (!updatedItem) {
        return new Response(JSON.stringify({ error: "Item not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify(updatedItem), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (_error) {
      return new Response(JSON.stringify({ error: "Failed to update item" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
  
  // DELETE /api/items/[id] - Delete an item
  async DELETE(_req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") return FORBIDDEN;
    const { id } = ctx.params;
    
    try {
      const success = await deleteItem(id);
      
      if (!success) {
        return new Response(JSON.stringify({ error: "Item not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (_error) {
      return new Response(JSON.stringify({ error: "Failed to delete item" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
