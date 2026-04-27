import { clearCamps, clearInventoryData, clearLoans, clearMeals, rebuildIndexes } from "../db/kv.ts";
import { seedDatabase } from "../db/seed.ts";
import { clearActivityLog } from "../lib/activityLog.ts";

export interface NormalizeOptions {
  clearActivity?: boolean;
  reseed?: boolean;
}

export async function normalizeLocalData(options: NormalizeOptions = {}): Promise<void> {
  const clearActivity = options.clearActivity ?? true;
  const reseed = options.reseed ?? true;

  console.log("[normalize] Clearing mutable data...");
  const inventory = await clearInventoryData();
  const loans = await clearLoans();
  const camps = await clearCamps();
  const meals = await clearMeals();
  const activity = clearActivity ? await clearActivityLog() : 0;

  console.log(
    `[normalize] Cleared inventory=${inventory.items} (indexes=${inventory.indexes}), loans=${loans}, camps=${camps}, meals=${meals}${clearActivity ? `, activity=${activity}` : ""}`,
  );

  if (reseed) {
    console.log("[normalize] Reseeding baseline data...");
    await seedDatabase();
  }

  console.log("[normalize] Rebuilding indexes/stats...");
  await rebuildIndexes();
  console.log("[normalize] Done.");
}

if (import.meta.main) {
  const args = new Set(Deno.args);
  const clearActivity = !args.has("--keep-activity");
  const reseed = !args.has("--no-seed");
  await normalizeLocalData({ clearActivity, reseed });
}
