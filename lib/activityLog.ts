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
  | "inventory.backup_exported"
  | "inventory.backup_restored"
  | "feedback.submitted"
  | "feedback.reviewed"
  | "item.qr_failed"
  | "item.maintenance_logged"
  | "items.imported"
  | "camp.created"
  | "camp.updated"
  | "camp.deleted"
  | "camp_templates.imported"
  | "first_aid.kit_created"
  | "first_aid.kit_deleted"
  | "first_aid.check_completed"
  | "first_aid.check_reset"
  | "risk_assessment.created"
  | "risk_assessment.updated"
  | "risk_assessment.deleted"
  | "risk_assessment.reviewed"
  | "risk_assessment.annual_check_completed"
  | "risk_assessment.backup_exported"
  | "risk_assessment.backup_restored"
  | "meal.created"
  | "meal.updated"
  | "meal.deleted"
  | "loan.created"
  | "loan.returned"
  | "loan.cancelled"
  | "neckers.made"
  | "neckers.stock_adjusted"
  | "neckers.created_reset"
  | "neckers.total_set"
  | "stocktake.completed"
  | "easter_egg.found"
  | "db.cleared";

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
const ACTIVITY_LOG_ENABLED =
  Deno.env.get("ACTIVITY_LOG_ENABLED")?.toLowerCase() !== "false";

let _kv: Deno.Kv | null = null;
let _kvInFlight: Promise<Deno.Kv> | null = null;
function getKv(): Promise<Deno.Kv> {
  if (_kv) return Promise.resolve(_kv);
  if (!_kvInFlight) {
    _kvInFlight = Deno.openKv().then((instance) => {
      _kv = instance;
      _kvInFlight = null;
      return instance;
    });
  }
  return _kvInFlight;
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
  if (!ACTIVITY_LOG_ENABLED) {
    return;
  }
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
    invalidateActivityCache();
  } catch (err) {
    console.error("[activityLog] Failed to write entry:", err);
  }
}

/** Delete all activity log entries from KV. */
export async function clearActivityLog(): Promise<number> {
  const kv = await getKv();
  const deleteOps: Promise<void>[] = [];
  for await (const entry of kv.list({ prefix: LOG_PREFIX })) {
    deleteOps.push(kv.delete(entry.key));
  }
  await Promise.all(deleteOps);
  return deleteOps.length;
}

// In-memory cache for dashboard widget — avoids a KV scan on every page load.
// Writes invalidate immediately via invalidateActivityCache(); the TTL is a
// safety net matching the 10-minute window used by the other KV caches.
const ACTIVITY_CACHE_TTL_MS = 10 * 60_000; // 10 minutes
let activityCache: { entries: ActivityEntry[]; limit: number; expiresAt: number } | null = null;

/** Invalidate the activity cache (called after writing a new entry). */
function invalidateActivityCache() {
  activityCache = null;
}

/**
 * Retrieve the most recent activity entries (default 100, max 500).
 * Returns entries in reverse chronological order (newest first).
 */
export async function getRecentActivity(limit = 100): Promise<ActivityEntry[]> {
  if (activityCache && Date.now() < activityCache.expiresAt && limit <= activityCache.limit) {
    return activityCache.entries.slice(0, limit);
  }
  const kv = await getKv();
  const entries: ActivityEntry[] = [];
  const effectiveLimit = Math.min(limit, 500);
  for await (
    const entry of kv.list<ActivityEntry>({ prefix: LOG_PREFIX }, {
      limit: effectiveLimit,
    })
  ) {
    entries.push(entry.value);
  }
  activityCache = { entries, limit: effectiveLimit, expiresAt: Date.now() + ACTIVITY_CACHE_TTL_MS };
  return entries;
}
