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
}
await start(manifest, config);
