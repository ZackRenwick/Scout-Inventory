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
import { initKv } from "./db/kv.ts";

// Always ensure a default admin account exists — locally and on Deploy
await ensureDefaultAdmin();

// Atomically claim the notification run for today (UTC date).
// Returns true only for the first caller — cron or startup catch-up,
// whichever fires first. Prevents duplicate emails when Deno Deploy
// restarts an isolate between 08:30–09:30 on a notification day.
async function claimNotificationRun(): Promise<boolean> {
  const kv = await initKv();
  const key = ["notifications_last_run"];
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" UTC

  const entry = await kv.get<string>(key);
  if (entry.value === today) return false; // already ran today

  // Atomic: only succeeds if the value hasn't changed since we read it
  const result = await kv.atomic()
    .check(entry)
    .set(key, today, { expireIn: 48 * 60 * 60 * 1000 }) // auto-expire after 48 h
    .commit();

  return result.ok;
}

async function runNotifications(source: string) {
  if (!await claimNotificationRun()) {
    console.log(`[${source}] Notifications already sent today — skipping.`);
    return;
  }
  console.log(`[${source}] Claimed notification run — sending checks.`);
  await Promise.all([
    checkAndNotifyLowStock().catch((e) => console.error(`[${source}] notify-low-stock failed:`, e)),
    checkAndNotifyExpiry().catch((e) => console.error(`[${source}] notify-expiry failed:`, e)),
    checkAndNotifyOverdueLoans().catch((e) => console.error(`[${source}] notify-overdue-loans failed:`, e)),
  ]);
}

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
  Deno.cron("notify-daily", "30 8 * * 3,5", () => runNotifications("cron"));

  // Startup catch-up: if we're deployed on a notification day (Wed=3, Fri=5) between
  // 08:30 and 09:30 UTC, run notifications in case the 08:30 cron was missed.
  // The claimNotificationRun() lock ensures this is a no-op if the cron already fired.
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun … 6=Sat
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const minuteOfDay = utcHour * 60 + utcMin;
  const isNotificationDay = dayOfWeek === 3 || dayOfWeek === 5;
  const inCatchUpWindow = minuteOfDay >= 8 * 60 + 30 && minuteOfDay < 9 * 60 + 30;
  if (isNotificationDay && inCatchUpWindow) {
    runNotifications("startup-catchup");
  }
}
await start(manifest, config);
