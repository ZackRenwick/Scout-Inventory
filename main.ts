/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />

import "$std/dotenv/load.ts";

import { start } from "$fresh/server.ts";
import manifest from "./fresh.gen.ts";
import config from "./fresh.config.ts";
import { ensureDefaultAdmin } from "./lib/auth.ts";
import { checkAndNotifyLowStock, checkAndNotifyExpiry, checkAndNotifyOverdueLoans } from "./lib/notifications.ts";

// Always ensure a default admin account exists — locally and on Deploy
await ensureDefaultAdmin();

if (Deno.env.get("DENO_DEPLOYMENT_ID")) {
  // Self-ping every 5 minutes to keep the isolate warm and avoid cold starts.
  // Set APP_URL to your deployment URL in Deno Deploy environment variables.
  const appUrl = Deno.env.get("APP_URL") ?? "https://7thwhitburnscoutsinventory.co.uk";
  Deno.cron("warmup-ping", "*/5 * * * *", async () => {
    try {
      await fetch(`${appUrl}/api/ping`);
    } catch {
      // Non-fatal — cron will retry on next interval
    }
  });

  // Daily 8:30 AM checks (Wed + Fri) — no-op when RESEND_API_KEY / NOTIFY_EMAIL not configured.
  // Running at 08:30 rather than 08:00 gives a buffer so a deploy just before 08:00 doesn't
  // cause the cron to be registered too late to fire that morning.
  Deno.cron("notify-low-stock", "30 8 * * 3,5", async () => {
    try {
      await checkAndNotifyLowStock();
    } catch (err) {
      console.error("[cron] notify-low-stock failed:", err);
    }
  });
  Deno.cron("notify-expiry", "30 8 * * 3,5", async () => {
    try {
      await checkAndNotifyExpiry();
    } catch (err) {
      console.error("[cron] notify-expiry failed:", err);
    }
  });
  Deno.cron("notify-overdue-loans", "30 8 * * 3,5", async () => {
    try {
      await checkAndNotifyOverdueLoans();
    } catch (err) {
      console.error("[cron] notify-overdue-loans failed:", err);
    }
  });

  // Startup catch-up: if we're deployed on a notification day (Wed=3, Fri=5) between
  // 08:30 and 09:30 UTC, run notifications immediately in case the 08:30 cron was missed.
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun … 6=Sat
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const minuteOfDay = utcHour * 60 + utcMin;
  const isNotificationDay = dayOfWeek === 3 || dayOfWeek === 5;
  const inCatchUpWindow = minuteOfDay >= 8 * 60 + 30 && minuteOfDay < 9 * 60 + 30;
  if (isNotificationDay && inCatchUpWindow) {
    console.log("[startup] Notification day and within catch-up window — running checks now.");
    Promise.all([
      checkAndNotifyLowStock().catch((e) => console.error("[startup] notify-low-stock failed:", e)),
      checkAndNotifyExpiry().catch((e) => console.error("[startup] notify-expiry failed:", e)),
      checkAndNotifyOverdueLoans().catch((e) => console.error("[startup] notify-overdue-loans failed:", e)),
    ]);
  }
}
await start(manifest, config);
