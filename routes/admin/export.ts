// GET /admin/export — downloads inventory as a UTF-8 CSV file
// Protected by routes/admin/_middleware.ts (admin-only)
//
// Uses plain CSV with a UTF-8 BOM so Excel auto-detects encoding and opens
// the file directly without an import wizard. No npm dependencies needed.
import type { Handlers } from "$fresh/server.ts";
import { getAllItems } from "../../db/kv.ts";
import type { InventoryItem } from "../../types/inventory.ts";

// Wrap a cell value for CSV: quote strings containing commas, quotes or newlines
function csvCell(value: string | number | Date | undefined | null): string {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  }
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildRow(item: InventoryItem): string {
  // deno-lint-ignore no-explicit-any
  const i = item as any;
  const cols = [
    item.name,
    item.category,
    item.quantity,
    item.location,
    i.yearPurchased ?? "",
  ];
  return cols.map(csvCell).join(",");
}

const HEADERS = ["Name", "Category", "Quantity", "Location", "Year Purchased"];

export const handler: Handlers = {
  async GET(_req, _ctx) {
    const items = await getAllItems();

    const today = new Date().toISOString().slice(0, 10);
    const filename = `inventory-${today}.csv`;

    const headerRow = HEADERS.join(",");
    const dataRows = items.map(buildRow).join("\r\n");

    // UTF-8 BOM (\uFEFF) tells Excel to open the file as UTF-8 without prompting
    const csv = "\uFEFF" + headerRow + "\r\n" + dataRows;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  },
};
