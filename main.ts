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
import { checkAndNotifyLowStock, checkAndNotifyExpiry } from "./lib/notifications.ts";

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

  // Daily 8 AM checks — no-op when RESEND_API_KEY / NOTIFY_EMAIL not configured
  Deno.cron("notify-low-stock", "0 8 * * *", async () => {
    try {
      await checkAndNotifyLowStock();
    } catch (err) {
      console.error("[cron] notify-low-stock failed:", err);
    }
  });
  Deno.cron("notify-expiry", "0 8 * * *", async () => {
    try {
      await checkAndNotifyExpiry();
    } catch (err) {
      console.error("[cron] notify-expiry failed:", err);
    }
  });
}
await start(manifest, config);
