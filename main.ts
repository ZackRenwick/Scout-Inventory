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

// Only seed the admin user when deployed — locally the dev bypass is used
if (Deno.env.get("DENO_DEPLOYMENT_ID")) {
  await ensureDefaultAdmin();

  // Self-ping every 5 minutes to keep the isolate warm and avoid cold starts.
  // Set APP_URL to your deployment URL in Deno Deploy environment variables.
  const appUrl = Deno.env.get("APP_URL") ?? "https://scout-inventory.zackrenwick.deno.net";
  Deno.cron("warmup-ping", "*/5 * * * *", async () => {
    try {
      await fetch(`${appUrl}/api/ping`);
    } catch {
      // Non-fatal — cron will retry on next interval
    }
  });
}
await start(manifest, config);
