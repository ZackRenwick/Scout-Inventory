// Print-optimised equipment list for a camp plan
import { Handlers, PageProps } from "$fresh/server.ts";
import type { CampPlan, CampPlanItem } from "../../../types/inventory.ts";
import { getCategoryEmoji, getCategoryLabel, ITEM_LOCATIONS } from "../../../types/inventory.ts";
import type { Session } from "../../../lib/auth.ts";
import { getCampPlanById, getItemById } from "../../../db/kv.ts";
import PrintButton from "../../../islands/PrintButton.tsx";

interface PrintPageData {
  plan: CampPlan;
  session: Session;
}

function fmt(d: Date | string | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export const handler: Handlers<PrintPageData> = {
  async GET(_req, ctx) {
    const { id } = ctx.params;
    const plan = await getCampPlanById(id);
    if (!plan) {
      return new Response(null, { status: 302, headers: { location: "/camps" } });
    }
    const session = ctx.state.session as Session;

    // Enrich plan items that are missing contents by looking up the inventory item.
    // This covers items added before the contents field was introduced.
    const enrichedItems: CampPlanItem[] = await Promise.all(
      plan.items.map(async (item) => {
        if (item.contents !== undefined) return item;
        const inv = await getItemById(item.itemId);
        if (!inv) return item;
        const contents = (inv as { contents?: { name: string; quantity: number }[] }).contents;
        if (!contents || contents.length === 0) return item;
        return { ...item, contents };
      }),
    );

    return ctx.render({ plan: { ...plan, items: enrichedItems }, session });
  },
};

export default function CampPrintPage({ data }: PageProps<PrintPageData>) {
  const { plan } = data;

  const gear = plan.items.filter((i) => i.itemCategory !== "food");
  const food = plan.items.filter((i) => i.itemCategory === "food");

  const BOX_LOCATIONS = new Set(
    ITEM_LOCATIONS.find((g) => g.group === "Boxes")?.options ?? []
  );

  // Items stored in a named box — group by box
  const boxGear: Record<string, typeof gear> = {};
  // Everything else — group by category
  const categoryGear: Record<string, typeof gear> = {};

  for (const item of gear) {
    if (BOX_LOCATIONS.has(item.itemLocation as never)) {
      (boxGear[item.itemLocation] ??= []).push(item);
    } else {
      (categoryGear[item.itemCategory] ??= []).push(item);
    }
  }

  const dateRange = plan.endDate
    ? `${fmt(plan.campDate)} – ${fmt(plan.endDate)}`
    : fmt(plan.campDate);

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Equipment List — {plan.name}</title>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 13px;
            color: #111;
            background: #f9fafb;
            padding: 1.5rem;
          }
          .no-print {
            display: flex;
            gap: 0.75rem;
            align-items: center;
            margin-bottom: 1.5rem;
            flex-wrap: wrap;
          }
          .btn {
            padding: 0.4rem 1rem;
            border-radius: 0.375rem;
            font-size: 0.8rem;
            font-weight: 500;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
          }
          .btn-secondary { background: white; color: #374151; border: 1px solid #d1d5db; }
          .btn-secondary:hover { background: #f3f4f6; }
          .page {
            background: white;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            border: 1px solid #e5e7eb;
          }
          .header { margin-bottom: 1.5rem; border-bottom: 2px solid #111; padding-bottom: 0.75rem; }
          .header h1 { font-size: 1.5rem; font-weight: 700; }
          .header .meta { font-size: 0.8rem; color: #555; margin-top: 0.25rem; display: flex; gap: 1.5rem; flex-wrap: wrap; }
          .header .meta span::before { margin-right: 0.25rem; }
          h2 { font-size: 0.95rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #555; margin: 1.25rem 0 0.5rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.25rem; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 0.5rem; }
          th { text-align: left; font-size: 0.75rem; font-weight: 600; color: #666; border-bottom: 1px solid #ccc; padding: 0.3rem 0.4rem; }
          td { padding: 0.35rem 0.4rem; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
          tr:last-child td { border-bottom: none; }
          .check { width: 1.2rem; height: 1.2rem; border: 1.5px solid #555; display: inline-block; border-radius: 3px; }
          .check.ticked { background: #111; }
          .check.ticked::after { content: "✓"; color: white; font-size: 0.75rem; display: flex; align-items: center; justify-content: center; line-height: 1.2rem; }
          .notes { font-size: 0.75rem; color: #888; font-style: italic; }
          .footer { margin-top: 2rem; font-size: 0.7rem; color: #aaa; border-top: 1px solid #e5e7eb; padding-top: 0.5rem; }
          @media print {
            body { background: white; padding: 0; }
            .no-print { display: none !important; }
            .page { border: none; padding: 0; max-width: 100%; }
            h2 { break-after: avoid; }
            table { break-inside: auto; }
            tr { break-inside: avoid; }
          }
        `}</style>
      </head>
      <body>
        <div class="no-print">
          <a href={`/camps/${plan.id}`} class="btn btn-secondary">← Back to Camp Plan</a>
          <PrintButton label="🖨️ Print List" />
        </div>

        <div class="page">
          <div class="header">
            <h1>📋 {plan.name}</h1>
            <div class="meta">
              <span>📅 {dateRange}</span>
              {plan.location && <span>📍 {plan.location}</span>}
              <span>Status: {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}</span>
              <span>Items: {plan.items.length}</span>
            </div>
            {plan.notes && <p style="margin-top:0.5rem;font-size:0.8rem;color:#555">{plan.notes}</p>}
          </div>

          {/* Box sections */}
          {Object.entries(boxGear).map(([box, items]) => (
            <div key={box}>
              <h2>📦 {box} — {items.length} item{items.length !== 1 ? "s" : ""}</h2>
              <table>
                <thead>
                  <tr>
                    <th style="width:2rem">Pack</th>
                    <th style="width:2rem">Return</th>
                    <th>Item</th>
                    <th style="width:4rem;text-align:right">Qty</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <>
                      <tr key={item.itemId}>
                        <td><span class={`check${item.packedStatus ? " ticked" : ""}`} /></td>
                        <td><span class={`check${item.returnedStatus ? " ticked" : ""}`} /></td>
                        <td>{item.itemName}</td>
                        <td style="text-align:right">{item.quantityPlanned}</td>
                        <td class="notes">{item.notes ?? ""}</td>
                      </tr>
                      {item.contents && item.contents.length > 0 && (
                        <tr key={`${item.itemId}-contents`}>
                          <td colspan={2} />
                          <td colspan={3} style="padding-top:0;padding-bottom:0.4rem">
                            <span style="font-size:0.7rem;color:#888">
                              {item.contents.map((c) => `${c.quantity}× ${c.name}`).join(" · ")}
                            </span>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {/* Remaining gear grouped by category */}
          {Object.entries(categoryGear).map(([cat, items]) => (
            <div key={cat}>
              <h2>{getCategoryEmoji(cat)} {getCategoryLabel(cat)}</h2>
              <table>
                <thead>
                  <tr>
                    <th style="width:2rem">Pack</th>
                    <th style="width:2rem">Return</th>
                    <th>Item</th>
                    <th style="width:4rem;text-align:right">Qty</th>
                    <th>Location</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <>
                      <tr key={item.itemId}>
                        <td><span class={`check${item.packedStatus ? " ticked" : ""}`} /></td>
                        <td><span class={`check${item.returnedStatus ? " ticked" : ""}`} /></td>
                        <td>{item.itemName}</td>
                        <td style="text-align:right">{item.quantityPlanned}</td>
                        <td class="notes">{item.itemLocation}</td>
                        <td class="notes">{item.notes ?? ""}</td>
                      </tr>
                      {item.contents && item.contents.length > 0 && (
                        <tr key={`${item.itemId}-contents`}>
                          <td colspan={2} />
                          <td colspan={4} style="padding-top:0;padding-bottom:0.4rem">
                            <span style="font-size:0.7rem;color:#888">
                              {item.contents.map((c) => `${c.quantity}× ${c.name}`).join(" · ")}
                            </span>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {/* Food list */}
          {food.length > 0 && (
            <div>
              <h2>🥫 Food</h2>
              <table>
                <thead>
                  <tr>
                    <th style="width:2rem">Pack</th>
                    <th>Item</th>
                    <th style="width:4rem;text-align:right">Qty</th>
                    <th>Location</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {food.map((item) => (
                    <tr key={item.itemId}>
                      <td><span class={`check${item.packedStatus ? " ticked" : ""}`} /></td>
                      <td>{item.itemName}</td>
                      <td style="text-align:right">{item.quantityPlanned}</td>
                      <td class="notes">{item.itemLocation}</td>
                      <td class="notes">{item.notes ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {plan.items.length === 0 && (
            <p style="color:#888;margin-top:1rem">No items have been added to this camp plan yet.</p>
          )}

          <div class="footer">
            Printed from 7th Whitburn Scouts Inventory · {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
      </body>
    </html>
  );
}
