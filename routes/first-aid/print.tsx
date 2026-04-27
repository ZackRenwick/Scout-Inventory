import { Handlers, PageProps } from "$fresh/server.ts";
import type { Session } from "../../lib/auth.ts";
import { getAllFirstAidKits } from "../../db/kv.ts";
import type { FirstAidKit } from "../../types/firstAid.ts";

interface FirstAidPrintData {
  kits: FirstAidKit[];
  session?: Session;
}

export const handler: Handlers<FirstAidPrintData> = {
  async GET(req, ctx) {
    const session = ctx.state.session as Session;
    const url = new URL(req.url);
    const kitId = url.searchParams.get("kit");
    const all = await getAllFirstAidKits();
    const kits = kitId ? all.filter((k) => k.id === kitId) : all;
    return ctx.render({ kits, session });
  },
};

export default function FirstAidPrintPage(
  { data }: PageProps<FirstAidPrintData>,
) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>First Aid Kit Inserts</title>
        <style>
          {`
          :root { color-scheme: light; }
          * { box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; }
          .page { max-width: 900px; margin: 0 auto; padding: 16px; }
          .toolbar { margin-bottom: 12px; display: flex; gap: 10px; align-items: center; }
          .btn { background: #b91c1c; color: #fff; border: 1px solid #991b1b; border-radius: 6px; padding: 8px 12px; cursor: pointer; }
          .sheet { border: 1px solid #d1d5db; border-radius: 8px; padding: 14px; margin-bottom: 16px; page-break-inside: avoid; }
          .meta { color: #4b5563; font-size: 12px; margin-top: 2px; }
          .fills { margin: 10px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; }
          .line { border-bottom: 1px solid #9ca3af; min-height: 16px; display: inline-block; width: 100%; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; }
          th { background: #f3f4f6; }
          .qty, .check { width: 90px; text-align: center; }
          @page { size: A4; margin: 10mm; }
          @media print {
            .toolbar { display: none; }
            .page { max-width: none; padding: 0; }
            .sheet { border: none; border-radius: 0; padding: 0; margin: 0 0 8mm; }
            .sheet + .sheet { page-break-before: always; }
          }
        `}
        </style>
      </head>
      <body>
        <div class="page">
          <div class="toolbar">
            <button class="btn" type="button" id="printBtn">Print</button>
            <a href="/first-aid" style="font-size: 13px; color: #374151;">
              Back to First Aid
            </a>
          </div>

          {data.kits.length === 0 ? <p>No first-aid kits available.</p> : (
            data.kits.map((kit) => {
              const sorted = [...kit.entries].sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { numeric: true })
              );
              return (
                <section class="sheet" key={kit.id}>
                  <h2>{kit.name}</h2>
                  <p class="meta">
                    Restock target list from app data. Last updated:{" "}
                    {kit.lastUpdated.toLocaleDateString()}
                  </p>

                  <div class="fills">
                    <div>
                      Checked by: <span class="line"></span>
                    </div>
                    <div>
                      Date: <span class="line"></span>
                    </div>
                    <div>
                      Event / Camp: <span class="line"></span>
                    </div>
                    <div>
                      Reorder needed: <span class="line"></span>
                    </div>
                  </div>

                  <table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th class="qty">Restock To</th>
                        <th class="check">In Bag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((entry) => (
                        <tr key={`${kit.id}-${entry.itemId}`}>
                          <td>{entry.name}</td>
                          <td class="qty">{entry.quantityTarget}</td>
                          <td class="check"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              );
            })
          )}
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.getElementById('printBtn')?.addEventListener('click',()=>window.print());",
          }}
        />
      </body>
    </html>
  );
}
