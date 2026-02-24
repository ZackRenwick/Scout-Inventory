// Printable QR label page for a single inventory item
import { Handlers, PageProps } from "$fresh/server.ts";
import type { InventoryItem } from "../../../types/inventory.ts";
import type { Session } from "../../../lib/auth.ts";
import { getItemById } from "../../../db/kv.ts";
import PrintButton from "../../../islands/PrintButton.tsx";

const CATEGORY_EMOJI: Record<string, string> = {
  tent: "⛺",
  cooking: "🍳",
  food: "🥫",
  "camping-tools": "🪓",
  games: "🎮",
};

interface QrPageData {
  item: InventoryItem;
  itemUrl: string;
  qrDataUri: string;
  session?: Session;
}

export const handler: Handlers<QrPageData> = {
  async GET(req, ctx) {
    const { id } = ctx.params;
    const item = await getItemById(id);
    if (!item) {
      return new Response("Item not found", { status: 404 });
    }
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role !== "admin") {
      return new Response(null, { status: 302, headers: { location: `/inventory/${id}` } });
    }
    const origin = new URL(req.url).origin;
    const itemUrl = `${origin}/inventory/${id}`;

    // Fetch QR SVG server-side so no external request leaves the browser (avoids CSP img-src issues)
    let qrDataUri = "";
    try {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=svg&data=${encodeURIComponent(itemUrl)}`;
      const qrRes = await fetch(qrApiUrl);
      if (qrRes.ok) {
        const svgText = await qrRes.text();
        const b64 = btoa(unescape(encodeURIComponent(svgText)));
        qrDataUri = `data:image/svg+xml;base64,${b64}`;
      }
    } catch (_) { /* leave qrDataUri empty; label still prints with URL */ }

    return ctx.render({ item, itemUrl, qrDataUri, session });
  },
};

export default function QrLabelPage({ data }: PageProps<QrPageData>) {
  const { item, itemUrl, qrDataUri } = data;
  const emoji = CATEGORY_EMOJI[item.category] ?? "📦";

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>QR Label — {item.name}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: system-ui, -apple-system, sans-serif;
            background: #f9fafb;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
            padding: 2rem 1rem;
          }
          .no-print {
            display: flex;
            gap: 0.75rem;
            margin-bottom: 2rem;
            flex-wrap: wrap;
            justify-content: center;
          }
          .btn {
            padding: 0.5rem 1.25rem;
            border-radius: 0.375rem;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
          }
          .btn-primary { background: #7c3aed; color: white; border: none; }
          .btn-primary:hover { background: #6d28d9; }
          .btn-secondary { background: white; color: #374151; border: 1px solid #d1d5db; }
          .btn-secondary:hover { background: #f3f4f6; }
          .label {
            background: white;
            border: 2px solid #e5e7eb;
            border-radius: 0.75rem;
            padding: 1.5rem;
            width: 280px;
            text-align: center;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.07);
          }
          .label-emoji { font-size: 2rem; margin-bottom: 0.5rem; }
          .label-name {
            font-size: 1.125rem;
            font-weight: 700;
            color: #111827;
            margin-bottom: 0.25rem;
            word-break: break-word;
          }
          .label-location {
            font-size: 0.8rem;
            color: #6b7280;
            margin-bottom: 1rem;
          }
          .label-qr { margin: 0 auto; display: block; }
          .label-url {
            margin-top: 0.75rem;
            font-size: 0.65rem;
            color: #9ca3af;
            word-break: break-all;
          }
          .label-qty {
            margin-top: 0.5rem;
            font-size: 0.75rem;
            color: #374151;
          }
          @media print {
            body { background: white; padding: 0; }
            .no-print { display: none !important; }
            .label {
              border: 1.5px solid #000;
              border-radius: 0;
              box-shadow: none;
              page-break-inside: avoid;
            }
          }
        `}</style>
      </head>
      <body>
        <div class="no-print">
          <a href={`/inventory/${item.id}`} class="btn btn-secondary">← Back to Item</a>
          <PrintButton />
        </div>

        <div class="label">
          <div class="label-emoji">{emoji}</div>
          <div class="label-name">{item.name}</div>
          <div class="label-location">{item.location}</div>
          {qrDataUri
            ? (
              <img
                src={qrDataUri}
                alt={`QR code for ${item.name}`}
                width={220}
                height={220}
                class="label-qr"
              />
            )
            : <p style="font-size:0.75rem;color:#9ca3af;margin:1rem 0">QR code unavailable</p>
          }
          <div class="label-qty">Qty: {item.quantity}</div>
          <div class="label-url">{itemUrl}</div>
        </div>
      </body>
    </html>
  );
}
