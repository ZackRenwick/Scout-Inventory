// GET /admin/export-json — downloads inventory as an import-compatible JSON file.
// Protected by routes/admin/_middleware.ts (admin-only).
//
// Strips server-assigned fields (id, addedDate, lastUpdated, atCamp,
// quantityAtCamp) so the file can be dropped straight into the bulk importer
// on another environment without modification.
import type { Handlers } from "$fresh/server.ts";
import { getAllItems } from "../../db/kv.ts";
import type { InventoryItem } from "../../types/inventory.ts";

// deno-lint-ignore no-explicit-any
function toImportShape(item: InventoryItem): Record<string, any> {
  // deno-lint-ignore no-explicit-any
  const i = item as any;

  // Fields stripped because they are generated server-side on import
  const { id: _id, addedDate: _a, lastUpdated: _l, atCamp: _ac, quantityAtCamp: _qac, ...rest } = i;

  // Serialise Date objects to strings
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value instanceof Date) {
      out[key] = isNaN((value as Date).getTime()) ? null : (value as Date).toISOString().slice(0, 10);
    } else {
      out[key] = value;
    }
  }

  return out;
}

export const handler: Handlers = {
  async GET(_req, _ctx) {
    const items = await getAllItems();
    items.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    const payload = items.map(toImportShape);
    const json = JSON.stringify(payload, null, 2);

    const today = new Date().toISOString().slice(0, 10);
    const filename = `inventory-export-${today}.json`;

    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  },
};
