/// <reference lib="deno.unstable" />
// Activity log — records key mutations to inventory, users, and camp plans in Deno KV.
//
// Key layout:
//   ["activity", "log", <inverted-epoch>, <uuid>]  →  ActivityEntry
//
// Inverted epoch (Number.MAX_SAFE_INTEGER − Date.now()) makes KV prefix scans
// return entries newest-first without any client-side sorting.
//
// Entries expire after 90 days to prevent unbounded KV growth.

export type ActivityAction =
  | "user.login"
  | "user.logout"
  | "user.created"
  | "user.deleted"
  | "user.password_changed"
  | "user.role_changed"
  | "item.created"
  | "item.updated"
  | "item.deleted"
  | "items.imported"
  | "camp.created"
  | "camp.updated"
  | "camp.deleted"
  | "meal.created"
  | "meal.updated"
  | "meal.deleted"
  | "loan.created"
  | "loan.returned"
  | "loan.cancelled"
  | "stocktake.completed";

export interface ActivityEntry {
  id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  username: string;
  action: ActivityAction;
  /** Human-readable resource name (e.g. item name, target username) */
  resource?: string;
  resourceId?: string;
  details?: string;
}

const LOG_PREFIX = ["activity", "log"] as const;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

let _kv: Deno.Kv | null = null;
async function getKv(): Promise<Deno.Kv> {
  if (!_kv) _kv = await Deno.openKv();
  return _kv;
}

/** Produces a zero-padded inverted epoch so KV scans return entries newest-first. */
function invertedEpoch(): string {
  return String(Number.MAX_SAFE_INTEGER - Date.now()).padStart(17, "0");
}

/**
 * Write a single activity entry to KV.
 * Fire-and-forget — errors are caught and logged to console so they never
 * surface to the user or interrupt the calling request.
 */
export async function logActivity(
  entry: Omit<ActivityEntry, "id" | "timestamp">,
): Promise<void> {
  try {
    const kv = await getKv();
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const key = [...LOG_PREFIX, invertedEpoch(), id];
    await kv.set(
      key,
      { ...entry, id, timestamp } satisfies ActivityEntry,
      { expireIn: NINETY_DAYS_MS },
    );
  } catch (err) {
    console.error("[activityLog] Failed to write entry:", err);
  }
}

/**
 * Retrieve the most recent activity entries (default 100, max 500).
 * Returns entries in reverse chronological order (newest first).
 */
export async function getRecentActivity(limit = 100): Promise<ActivityEntry[]> {
  const kv = await getKv();
  const entries: ActivityEntry[] = [];
  const effectiveLimit = Math.min(limit, 500);
  for await (
    const entry of kv.list<ActivityEntry>({ prefix: LOG_PREFIX }, { limit: effectiveLimit })
  ) {
    entries.push(entry.value);
  }
  return entries;
}
