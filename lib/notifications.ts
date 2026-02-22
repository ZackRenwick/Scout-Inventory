// Email notifications via the Resend API (https://resend.com).
//
// Required environment variables:
//   RESEND_API_KEY   — API key from resend.com
//   NOTIFY_EMAIL     — recipient address for all alert emails
//
// Optional:
//   NOTIFY_FROM_EMAIL — sender address (defaults to noreply@7thwhitburnscoutsinventory.co.uk)
//
// If RESEND_API_KEY or NOTIFY_EMAIL are unset the helpers are safe no-ops — they
// log to console instead so local dev works without any configuration.

import { getAllItems, getFoodItemsSortedByExpiry, getNeckerCount } from "../db/kv.ts";
import { getDaysUntil } from "./date-utils.ts";

const RESEND_URL = "https://api.resend.com/emails";

// ===== INTERNAL SEND HELPER =====

async function sendEmail(subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("NOTIFY_EMAIL");
  const from = Deno.env.get("NOTIFY_FROM_EMAIL") ?? "noreply@7thwhitburnscoutsinventory.co.uk";

  if (!apiKey || !to) {
    console.log(`[notifications] Email not configured — skipping: "${subject}"`);
    return;
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[notifications] Resend API error ${res.status}: ${text}`);
    } else {
      console.log(`[notifications] Sent: "${subject}" → ${to}`);
    }
  } catch (err) {
    console.error("[notifications] Network error sending email:", err);
  }
}

// ===== PUBLIC NOTIFICATION FUNCTIONS =====

/**
 * Checks all inventory items for low stock and sends a summary email
 * if any items are at or below their minimum threshold.
 */
export async function checkAndNotifyLowStock(): Promise<void> {
  const [items, neckerCount] = await Promise.all([getAllItems(), getNeckerCount()]);
  const lowStock = items.filter((i) => i.quantity <= i.minThreshold);

  // Necker threshold: configurable via NECKER_MIN_THRESHOLD env var, default 5
  const neckerThreshold = parseInt(Deno.env.get("NECKER_MIN_THRESHOLD") ?? "10", 10);
  const neckersLow = neckerCount <= neckerThreshold;

  if (lowStock.length === 0 && !neckersLow) {
    return;
  }

  const itemRows = lowStock.map((i) =>
    `<tr>
      <td style="padding:6px 12px">${escHtml(i.name)}</td>
      <td style="padding:6px 12px">${escHtml(i.category)}</td>
      <td style="padding:6px 12px;text-align:center">${i.quantity}</td>
      <td style="padding:6px 12px;text-align:center">${i.minThreshold}</td>
    </tr>`
  ).join("\n");

  const neckerRow = neckersLow
    ? `<tr>
      <td style="padding:6px 12px">Neckers</td>
      <td style="padding:6px 12px">Uniform</td>
      <td style="padding:6px 12px;text-align:center">${neckerCount}</td>
      <td style="padding:6px 12px;text-align:center">${neckerThreshold}</td>
    </tr>`
    : "";

  const totalCount = lowStock.length + (neckersLow ? 1 : 0);

  const html = `
    <h2 style="color:#7c3aed">⚠️ Low Stock Alert — 7th Whitburn Scouts</h2>
    <p>${totalCount} item${totalCount !== 1 ? "s are" : " is"} at or below minimum threshold:</p>
    <table border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;width:100%">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #e5e7eb">Item</th>
          <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #e5e7eb">Category</th>
          <th style="padding:8px 12px;text-align:center;border-bottom:1px solid #e5e7eb">Current Qty</th>
          <th style="padding:8px 12px;text-align:center;border-bottom:1px solid #e5e7eb">Min Threshold</th>
        </tr>
      </thead>
      <tbody>${itemRows}${neckerRow}</tbody>
    </table>
    <p style="color:#6b7280;font-size:13px;margin-top:16px">Sent by 7th Whitburn Scouts Inventory — visit the app to restock.</p>
  `;

  await sendEmail(
    `⚠️ 7th Whitburn Scouts: ${totalCount} item${totalCount !== 1 ? "s" : ""} low on stock`,
    html,
  );
}

/**
 * Checks all food items for upcoming expiry and sends a summary email
 * if any items are expired or expiring within 30 days.
 */
export async function checkAndNotifyExpiry(): Promise<void> {
  const foodItems = await getFoodItemsSortedByExpiry();
  const alertItems = foodItems.filter((i) => getDaysUntil(i.expiryDate) <= 30);
  if (alertItems.length === 0) {
    return;
  }

  const rows = alertItems.map((i) => {
    const days = getDaysUntil(i.expiryDate);
    const statusText = days < 0
      ? `EXPIRED ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} ago`
      : days === 0
      ? "Expires today"
      : `${days} day${days !== 1 ? "s" : ""} remaining`;
    const statusColor = days < 0 ? "#dc2626" : days <= 7 ? "#d97706" : "#ca8a04";
    return `<tr>
      <td style="padding:6px 12px">${escHtml(i.name)}</td>
      <td style="padding:6px 12px">${i.expiryDate.toISOString().slice(0, 10)}</td>
      <td style="padding:6px 12px;color:${statusColor};font-weight:600">${statusText}</td>
    </tr>`;
  }).join("\n");

  const html = `
    <h2 style="color:#7c3aed">🥫 Food Expiry Alert — 7th Whitburn Scouts</h2>
    <p>${alertItems.length} food item${alertItems.length !== 1 ? "s" : ""} expiring within 30 days (or already expired):</p>
    <table border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;width:100%">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #e5e7eb">Item</th>
          <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #e5e7eb">Expiry Date</th>
          <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #e5e7eb">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#6b7280;font-size:13px;margin-top:16px">Sent by 7th Whitburn Scouts Inventory — visit the app to manage food stock.</p>
  `;

  const count = alertItems.length;
  await sendEmail(
    `🥫 7th Whitburn Scouts: ${count} food item${count !== 1 ? "s" : ""} expiring soon`,
    html,
  );
}

// ===== UTILITIES =====

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
