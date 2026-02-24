// Print-optimised equipment list for a camp plan
import { Handlers, PageProps } from "$fresh/server.ts";
import type { CampPlan } from "../../../types/inventory.ts";
import type { Session } from "../../../lib/auth.ts";
import { getCampPlanById } from "../../../db/kv.ts";
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

const CATEGORY_EMOJI: Record<string, string> = {
  tent: "⛺",
  cooking: "🍳",
  food: "🥫",
  "camping-tools": "🪓",
  games: "🎮",
};

export const handler: Handlers<PrintPageData> = {
  async GET(_req, ctx) {
    const { id } = ctx.params;
    const plan = await getCampPlanById(id);
    if (!plan) {
      return new Response(null, { status: 302, headers: { location: "/camps" } });
    }
    const session = ctx.state.session as Session;
    return ctx.render({ plan, session });
  },
};

export default function CampPrintPage({ data }: PageProps<PrintPageData>) {
  const { plan } = data;

  const gear = plan.items.filter((i) => i.itemCategory !== "food");
  const food = plan.items.filter((i) => i.itemCategory === "food");

  // Group gear by category
  const gearByCategory: Record<string, typeof gear> = {};
  for (const item of gear) {
    (gearByCategory[item.itemCategory] ??= []).push(item);
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

          {/* Gear sections grouped by category */}
          {Object.entries(gearByCategory).map(([cat, items]) => (
            <div key={cat}>
              <h2>{CATEGORY_EMOJI[cat] ?? "📦"} {cat.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</h2>
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
                    <tr key={item.itemId}>
                      <td><span class={`check${item.packedStatus ? " ticked" : ""}`} /></td>
                      <td><span class={`check${item.returnedStatus ? " ticked" : ""}`} /></td>
                      <td>{item.itemName}</td>
                      <td style="text-align:right">{item.quantityPlanned}</td>
                      <td class="notes">{item.itemLocation}</td>
                      <td class="notes">{item.notes ?? ""}</td>
                    </tr>
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
