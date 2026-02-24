// POST /api/stocktake — apply a batch of quantity/condition corrections from a stock-take
import { Handlers } from "$fresh/server.ts";
import { getItemById, updateItem } from "../../db/kv.ts";
import { type Session, csrfOk, forbidden, csrfFailed } from "../../lib/auth.ts";
import { logActivity } from "../../lib/activityLog.ts";

interface StocktakeUpdate {
  id: string;
  quantity: number;
  condition?: string;
}

export const handler: Handlers = {
  async POST(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") return forbidden();
    if (!csrfOk(req, session)) return csrfFailed();

    let body: { updates: StocktakeUpdate[] };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { updates } = body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return new Response(JSON.stringify({ error: "No updates provided." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let applied = 0;
    const errors: string[] = [];

    await Promise.all(
      updates.map(async ({ id, quantity, condition }) => {
        if (typeof quantity !== "number" || quantity < 0 || !Number.isInteger(quantity)) {
          errors.push(`Invalid quantity for item ${id}`);
          return;
        }
        try {
          const patch: Record<string, unknown> = { quantity };
          if (condition) patch.condition = condition;
          const result = await updateItem(id, patch as Parameters<typeof updateItem>[1]);
          if (result) applied++;
          else errors.push(`Item ${id} not found`);
        } catch (e) {
          errors.push(`Failed to update ${id}: ${e}`);
        }
      }),
    );

    await logActivity({
      username: session.username,
      action: "stocktake.completed",
      details: `Stock-take applied ${applied} correction${applied !== 1 ? "s" : ""}${errors.length > 0 ? ` (${errors.length} error${errors.length !== 1 ? "s" : ""})` : ""}`,
    });

    return new Response(JSON.stringify({ applied, errors }), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
