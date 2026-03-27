/// <reference lib="deno.unstable" />
// Deno KV database setup and operations
import type {
  CampPlan,
  CampTemplate,
  CampTemplateItem,
  CheckOut,
  FoodItem,
  InventoryItem,
  ItemCategory,
  ItemSpace,
  MaintenanceRecord,
} from "../types/inventory.ts";
import type { Meal, MealPayload } from "../types/meals.ts";
import type { FirstAidKit } from "../types/firstAid.ts";
import type { FirstAidCatalogItem } from "../types/firstAid.ts";
import type { FirstAidCheckState } from "../types/firstAid.ts";
import type { RiskAssessment } from "../types/risk.ts";
import { DEFAULT_FIRST_AID_CATALOG } from "../lib/firstAidCatalog.ts";
import { FIRST_AID_SECTIONS } from "../types/firstAid.ts";

// Initialize Deno KV
let kv: Deno.Kv | null = null;
let kvInFlight: Promise<Deno.Kv> | null = null;

export async function initKv(): Promise<Deno.Kv> {
  if (kv) return kv;
  if (!kvInFlight) {
    kvInFlight = Deno.openKv().then((instance: Deno.Kv) => {
      kv = instance;
      kvInFlight = null;
      return instance;
    });
  }
  return await kvInFlight!;
}

// ===== KEY LAYOUT =====
//
// Primary data:
//   ["inventory", "items", <id>]                          → InventoryItem
//   ["inventory", "checkouts", <id>]                      → CheckOut
//   ["inventory", "neckers", "count"]                     → number
//   ["inventory", "neckers", "created"]                   → number
//   ["inventory", "neckers", "total-made"]                → number
//   ["inventory", "neckers", "adult-created"]             → number
//   ["inventory", "neckers", "adult-total-made"]          → number
//
// Secondary indexes (value = item id):
//   ["inventory", "idx", "category", <category>, <id>]   → id
//   ["inventory", "idx", "space",    <space>,    <id>]   → id
//   ["inventory", "idx", "expiry",   <isoDate>,  <id>]   → id  (food only; ISO strings sort correctly)
//
// Precomputed stats (updated atomically on every write):
//   ["inventory", "stats", "computed"]                    → ComputedStats

const KEYS = {
  items: ["inventory", "items"] as const,
  checkouts: ["inventory", "checkouts"] as const,
  neckers: ["inventory", "neckers", "count"] as const,
  neckersCreated: ["inventory", "neckers", "created"] as const,
  neckersTotalMade: ["inventory", "neckers", "total-made"] as const,
  adultNeckersCreated: ["inventory", "neckers", "adult-created"] as const,
  adultNeckersTotalMade: ["inventory", "neckers", "adult-total-made"] as const,
  computedStats: ["inventory", "stats", "computed"] as const,
  camps: ["camps", "plans"] as const,
  templates: ["camps", "templates"] as const,
  meals: ["meals"] as const,
  firstAidKits: ["first-aid", "kits"] as const,
  firstAidCatalog: ["first-aid", "catalog"] as const,
  firstAidChecks: ["first-aid", "checks"] as const,
  riskAssessments: ["risk-assessments", "records"] as const,
};

// Index key helpers
const IDX = {
  category: ["inventory", "idx", "category"] as const,
  space: ["inventory", "idx", "space"] as const,
  expiry: ["inventory", "idx", "expiry"] as const,
  categoryKey: (cat: string, id: string) =>
    ["inventory", "idx", "category", cat, id] as const,
  spaceKey: (sp: string, id: string) =>
    ["inventory", "idx", "space", sp, id] as const,
  expiryKey: (iso: string, id: string) =>
    ["inventory", "idx", "expiry", iso, id] as const,
};

// ===== PRE-COMPUTED STATS =====

export interface ComputedStats {
  totalItems: number;
  totalQuantity: number;
  categoryBreakdown: Record<ItemCategory, { count: number; quantity: number }>;
  spaceBreakdown: Record<ItemSpace, { count: number; quantity: number }>;
  lowStockItems: number;
  needsRepairItems: number;
  activeLoansCount: number;
}

function emptyStats(): ComputedStats {
  return {
    totalItems: 0,
    totalQuantity: 0,
    categoryBreakdown: {
      tent: { count: 0, quantity: 0 },
      cooking: { count: 0, quantity: 0 },
      food: { count: 0, quantity: 0 },
      fuel: { count: 0, quantity: 0 },
      "camping-tools": { count: 0, quantity: 0 },
      games: { count: 0, quantity: 0 },
      kit: { count: 0, quantity: 0 },
    },
    spaceBreakdown: {
      "camp-store": { count: 0, quantity: 0 },
      "scout-post-loft": { count: 0, quantity: 0 },
      "gas-storage-box": { count: 0, quantity: 0 },
    },
    lowStockItems: 0,
    needsRepairItems: 0,
    activeLoansCount: 0,
  };
}

function hasCondition(
  item: InventoryItem,
): item is InventoryItem & { condition: string } {
  return "condition" in item;
}

/**
 * Apply a single item to a stats snapshot (+1 to add it, -1 to remove it).
 * Uses sign to avoid duplicating logic for add vs remove.
 */
function applyItemToStats(
  stats: ComputedStats,
  item: InventoryItem,
  sign: 1 | -1,
): ComputedStats {
  const next: ComputedStats = {
    totalItems: stats.totalItems + sign,
    totalQuantity: stats.totalQuantity + sign * item.quantity,
    categoryBreakdown: {
      ...stats.categoryBreakdown,
    } as ComputedStats["categoryBreakdown"],
    spaceBreakdown: {
      ...stats.spaceBreakdown,
    } as ComputedStats["spaceBreakdown"],
    lowStockItems: stats.lowStockItems,
    needsRepairItems: stats.needsRepairItems,
    activeLoansCount: stats.activeLoansCount ?? 0,
  };

  // Deep-copy the two buckets we'll touch
  const cat = item.category as ItemCategory;
  const sp = (item.space ?? "camp-store") as ItemSpace;
  next.categoryBreakdown[cat] = { ...next.categoryBreakdown[cat] };
  next.spaceBreakdown[sp] = { ...next.spaceBreakdown[sp] };

  next.categoryBreakdown[cat].count += sign;
  next.categoryBreakdown[cat].quantity += sign * item.quantity;
  next.spaceBreakdown[sp].count += sign;
  next.spaceBreakdown[sp].quantity += sign * item.quantity;

  if (item.quantity <= item.minThreshold) next.lowStockItems += sign;
  if (
    hasCondition(item) &&
    (item.condition === "needs-repair" ||
      ((item as { quantityNeedsRepair?: number }).quantityNeedsRepair ?? 0) > 0)
  ) next.needsRepairItems += sign;

  return next;
}

/** Read the precomputed stats from KV (O(1)). Falls back to zero-state if not yet built. */
function normalizeComputedStats(stats: ComputedStats | null): ComputedStats {
  const base = emptyStats();
  if (!stats) {
    return base;
  }

  return {
    ...base,
    ...stats,
    categoryBreakdown: {
      ...base.categoryBreakdown,
      ...(stats.categoryBreakdown ?? {}),
    },
    spaceBreakdown: {
      ...base.spaceBreakdown,
      ...(stats.spaceBreakdown ?? {}),
    },
    activeLoansCount: stats.activeLoansCount ?? 0,
  };
}

export async function getComputedStats(): Promise<ComputedStats> {
  const db = await initKv();
  const result = await db.get<ComputedStats>(KEYS.computedStats);
  return normalizeComputedStats(result.value);
}

// ===== IN-MEMORY CACHE (for getAllItems / full-list pages) =====
// All writes invalidate this cache immediately, so the TTL is just a safety net
// against external KV modifications. 5 minutes is a safe, sensible default.
const CACHE_TTL_MS = 10 * 60_000; // 10 minutes
let itemsCache: { items: InventoryItem[]; expiresAt: number } | null = null;
let checkoutsCache: { checkouts: CheckOut[]; expiresAt: number } | null = null;

// In-flight deduplication: if a fetch is already running, subsequent callers
// get the same promise rather than each starting their own KV scan.
let itemsInFlight: Promise<InventoryItem[]> | null = null;
let checkoutsInFlight: Promise<CheckOut[]> | null = null;

let campPlansCache: { plans: CampPlan[]; expiresAt: number } | null = null;
let campPlansInFlight: Promise<CampPlan[]> | null = null;

let templatesCache: { templates: CampTemplate[]; expiresAt: number } | null =
  null;
let templatesInFlight: Promise<CampTemplate[]> | null = null;

let mealsCache: { meals: Meal[]; expiresAt: number } | null = null;
let mealsInFlight: Promise<Meal[]> | null = null;

let firstAidKitsCache: { kits: FirstAidKit[]; expiresAt: number } | null = null;
let firstAidKitsInFlight: Promise<FirstAidKit[]> | null = null;
let firstAidKitIdsCache: { ids: string[]; expiresAt: number } | null = null;
let firstAidKitIdsInFlight: Promise<string[]> | null = null;
let firstAidCatalogCache:
  | { items: FirstAidCatalogItem[]; expiresAt: number }
  | null = null;
let firstAidCatalogInFlight: Promise<FirstAidCatalogItem[]> | null = null;
let firstAidOverallCheckStateCache:
  | { state: FirstAidCheckState | null; expiresAt: number }
  | null = null;
let firstAidOverallCheckStateInFlight:
  | Promise<FirstAidCheckState | null>
  | null = null;
let firstAidKitCheckStatesCache:
  | { states: Record<string, FirstAidCheckState>; expiresAt: number }
  | null = null;
let firstAidKitCheckStatesInFlight:
  | Promise<Record<string, FirstAidCheckState>>
  | null = null;

let riskAssessmentsCache:
  | { assessments: RiskAssessment[]; expiresAt: number }
  | null = null;
let riskAssessmentsInFlight: Promise<RiskAssessment[]> | null = null;

export async function getAllItems(): Promise<InventoryItem[]> {
  if (itemsCache && Date.now() < itemsCache.expiresAt) {
    return itemsCache.items;
  }
  // Start a background refresh if not already running
  if (!itemsInFlight) {
    itemsInFlight = (async () => {
      const db = await initKv();
      const items: InventoryItem[] = [];
      const entries = db.list<InventoryItem>({ prefix: KEYS.items });
      for await (const entry of entries) {
        items.push(deserializeItem(entry.value));
      }
      itemsCache = { items, expiresAt: Date.now() + CACHE_TTL_MS };
      itemsInFlight = null;
      return items;
    })();
  }
  // Stale-while-revalidate: serve existing data immediately, refresh in background
  if (itemsCache) return itemsCache.items;
  // True cold start — no data yet, must wait
  return await itemsInFlight!;
}

function invalidateItemsCache(): void {
  itemsCache = null;
  itemsInFlight = null;
}

function invalidateCheckoutsCache(): void {
  checkoutsCache = null;
  checkoutsInFlight = null;
}

function invalidateCampPlansCache(): void {
  campPlansCache = null;
  campPlansInFlight = null;
}

function invalidateMealsCache(): void {
  mealsCache = null;
  mealsInFlight = null;
}

function invalidateTemplatesCache(): void {
  templatesCache = null;
  templatesInFlight = null;
}

function invalidateFirstAidKitsCache(): void {
  firstAidKitsCache = null;
  firstAidKitsInFlight = null;
  firstAidKitIdsCache = null;
  firstAidKitIdsInFlight = null;
}

function invalidateFirstAidCatalogCache(): void {
  firstAidCatalogCache = null;
  firstAidCatalogInFlight = null;
}

function invalidateFirstAidCheckStateCaches(): void {
  firstAidOverallCheckStateCache = null;
  firstAidOverallCheckStateInFlight = null;
  firstAidKitCheckStatesCache = null;
  firstAidKitCheckStatesInFlight = null;
}

function invalidateRiskAssessmentsCache(): void {
  riskAssessmentsCache = null;
  riskAssessmentsInFlight = null;
}

/**
 * Warm all KV caches concurrently. Returns a promise that resolves once every
 * cache has been populated. Awaiting this at startup ensures no request is
 * served until all data is in memory, eliminating cold-isolate TTFB spikes.
 */
export function preloadCaches(): Promise<void> {
  return Promise.all([
    getAllItems().catch(() => {}),
    getAllCheckOuts().catch(() => {}),
    getAllCampPlans().catch(() => {}),
    getAllCampTemplates().catch(() => {}),
    getAllMeals().catch(() => {}),
    getAllFirstAidKits().catch(() => {}),
    getAllFirstAidCatalogItems().catch(() => {}),
    getAllRiskAssessments().catch(() => {}),
  ]).then(() => {});
}

// ===== ATOMIC INDEX HELPERS =====

/** Append index entries for one item onto an existing atomic operation. */
function addToIndex(op: Deno.AtomicOperation, item: InventoryItem): void {
  op.set(IDX.categoryKey(item.category, item.id), item.id);
  op.set(IDX.spaceKey(item.space ?? "camp-store", item.id), item.id);
  if (item.category === "food") {
    op.set(
      IDX.expiryKey((item as FoodItem).expiryDate.toISOString(), item.id),
      item.id,
    );
  }
}

/** Remove index entries for one item from an existing atomic operation. */
function removeFromIndex(op: Deno.AtomicOperation, item: InventoryItem): void {
  op.delete(IDX.categoryKey(item.category, item.id));
  op.delete(IDX.spaceKey(item.space ?? "camp-store", item.id));
  if (item.category === "food") {
    op.delete(
      IDX.expiryKey((item as FoodItem).expiryDate.toISOString(), item.id),
    );
  }
}

// ===== INVENTORY ITEMS OPERATIONS =====

export async function getItemById(id: string): Promise<InventoryItem | null> {
  const db = await initKv();
  const result = await db.get<InventoryItem>([...KEYS.items, id]);
  return result.value ? deserializeItem(result.value) : null;
}

/**
 * Fetch all items for a specific category.
 * Uses the in-memory cache when warm; falls back to a full KV scan.
 * Avoids N individual KV reads that the index-then-lookup approach requires.
 */
export async function getItemsByCategory(
  category: ItemCategory,
): Promise<InventoryItem[]> {
  const all = await getAllItems();
  return all.filter((item) => item.category === category);
}

/**
 * Fetch all items for a specific space.
 * Uses the in-memory cache when warm; falls back to a full KV scan.
 */
export async function getItemsBySpace(
  space: ItemSpace,
): Promise<InventoryItem[]> {
  const all = await getAllItems();
  return all.filter((item) => (item.space ?? "camp-store") === space);
}

/**
 * Fetch all food items ordered by expiry date (ascending).
 * Uses the in-memory cache when warm; falls back to a full KV scan.
 * Avoids N individual KV reads from the expiry index approach.
 */
export async function getFoodItemsSortedByExpiry(): Promise<FoodItem[]> {
  const all = await getAllItems();
  return (all.filter((item): item is FoodItem => item.category === "food"))
    .sort((a, b) => {
      const aTime = a.expiryDate instanceof Date
        ? a.expiryDate.getTime()
        : new Date(a.expiryDate as string).getTime();
      const bTime = b.expiryDate instanceof Date
        ? b.expiryDate.getTime()
        : new Date(b.expiryDate as string).getTime();
      return aTime - bTime;
    });
}

export async function createItem(item: InventoryItem): Promise<InventoryItem> {
  const db = await initKv();
  const currentStats = await getComputedStats();
  const newStats = applyItemToStats(currentStats, item, 1);

  const op = db.atomic();
  op.set([...KEYS.items, item.id], serializeItem(item));
  addToIndex(op, item);
  op.set(KEYS.computedStats, newStats);
  await op.commit();

  invalidateItemsCache();
  return item;
}

export async function updateItem(
  id: string,
  updates: Partial<InventoryItem>,
): Promise<InventoryItem | null> {
  const existing = await getItemById(id);
  if (!existing) {
    return null;
  }

  const updated: InventoryItem = {
    ...existing,
    ...updates,
    id,
    lastUpdated: new Date(),
  } as InventoryItem;

  const currentStats = await getComputedStats();
  const newStats = applyItemToStats(
    applyItemToStats(currentStats, existing, -1),
    updated,
    1,
  );

  const db = await initKv();
  const op = db.atomic();
  op.set([...KEYS.items, id], serializeItem(updated));
  removeFromIndex(op, existing);
  addToIndex(op, updated);
  op.set(KEYS.computedStats, newStats);
  await op.commit();

  invalidateItemsCache();
  return updated;
}

export async function deleteItem(id: string): Promise<boolean> {
  const existing = await getItemById(id);
  if (!existing) {
    return false;
  }

  const currentStats = await getComputedStats();
  const newStats = applyItemToStats(currentStats, existing, -1);

  const db = await initKv();
  const op = db.atomic();
  op.delete([...KEYS.items, id]);
  removeFromIndex(op, existing);
  op.set(KEYS.computedStats, newStats);
  await op.commit();

  invalidateItemsCache();
  return true;
}

export async function searchItems(query: string): Promise<InventoryItem[]> {
  const allItems = await getAllItems();
  const lowerQuery = query.toLowerCase();

  return allItems.filter((item) =>
    item.name.toLowerCase().includes(lowerQuery) ||
    item.category.toLowerCase().includes(lowerQuery) ||
    item.notes?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Rebuild all secondary indexes and the precomputed stats from the primary item data.
 * Run this once after deploying indexing to migrate existing data, or to recover from drift.
 */
export async function rebuildIndexes(): Promise<void> {
  const db = await initKv();

  // 1. Delete all existing index entries
  const deleteOps = [];
  for await (const entry of db.list({ prefix: ["inventory", "idx"] })) {
    deleteOps.push(db.delete(entry.key));
  }
  await Promise.all(deleteOps);

  // 2. Scan all items, rebuild indexes + stats
  let stats = emptyStats();
  const entries = db.list<InventoryItem>({ prefix: KEYS.items });
  const batchOps = [];

  for await (const entry of entries) {
    const item = deserializeItem(entry.value);
    const op = db.atomic();
    addToIndex(op, item);
    batchOps.push(op.commit());
    stats = applyItemToStats(stats, item, 1);
  }
  await Promise.all(batchOps);

  // 3. Count active loans for stats
  let activeLoansCount = 0;
  for await (const entry of db.list<CheckOut>({ prefix: KEYS.checkouts })) {
    const co = deserializeCheckOut(entry.value);
    if (co.status !== "returned") activeLoansCount++;
  }
  stats.activeLoansCount = activeLoansCount;

  // 4. Write rebuilt stats
  await db.set(KEYS.computedStats, stats);

  // 5. Invalidate in-memory caches
  invalidateItemsCache();
  invalidateCheckoutsCache();
}

// ===== CHECK-OUT OPERATIONS =====

export async function getAllCheckOuts(): Promise<CheckOut[]> {
  if (checkoutsCache && Date.now() < checkoutsCache.expiresAt) {
    return checkoutsCache.checkouts;
  }
  if (!checkoutsInFlight) {
    checkoutsInFlight = (async () => {
      const db = await initKv();
      const checkouts: CheckOut[] = [];
      const entries = db.list<CheckOut>({ prefix: KEYS.checkouts });
      for await (const entry of entries) {
        checkouts.push(deserializeCheckOut(entry.value));
      }
      checkoutsCache = { checkouts, expiresAt: Date.now() + CACHE_TTL_MS };
      checkoutsInFlight = null;
      return checkouts;
    })();
  }
  if (checkoutsCache) return checkoutsCache.checkouts;
  return await checkoutsInFlight!;
}

export async function getActiveCheckOuts(): Promise<CheckOut[]> {
  const allCheckOuts = await getAllCheckOuts();
  return allCheckOuts.filter((co) =>
    co.status === "checked-out" || co.status === "overdue"
  );
}

export async function getActiveCheckOutsByItemId(
  itemId: string,
): Promise<CheckOut[]> {
  const active = await getActiveCheckOuts();
  return active.filter((co) => co.itemId === itemId)
    .sort((a, b) =>
      new Date(a.expectedReturnDate).getTime() -
      new Date(b.expectedReturnDate).getTime()
    );
}

export async function createCheckOut(checkout: CheckOut): Promise<CheckOut> {
  const db = await initKv();
  const serializedCheckOut = serializeCheckOut(checkout);

  // Atomically write the checkout record and increment active loans count
  const currentStats = await getComputedStats();
  const newStats: ComputedStats = {
    ...currentStats,
    activeLoansCount: (currentStats.activeLoansCount ?? 0) + 1,
  };
  await db.atomic()
    .set([...KEYS.checkouts, checkout.id], serializedCheckOut)
    .set(KEYS.computedStats, newStats)
    .commit();

  invalidateCheckoutsCache();

  // Deduct quantity from item stock
  const item = await getItemById(checkout.itemId);
  if (item) {
    await updateItem(checkout.itemId, {
      quantity: item.quantity - checkout.quantity,
    });
  }

  return checkout;
}

export async function returnCheckOut(id: string): Promise<CheckOut | null> {
  const db = await initKv();
  const result = await db.get<CheckOut>([...KEYS.checkouts, id]);

  if (!result.value) {
    return null;
  }

  const checkout = deserializeCheckOut(result.value);
  const updated: CheckOut = {
    ...checkout,
    actualReturnDate: new Date(),
    status: "returned",
  };

  // Atomically write the return and decrement active loans count
  const currentStats = await getComputedStats();
  const newStats: ComputedStats = {
    ...currentStats,
    activeLoansCount: Math.max(0, (currentStats.activeLoansCount ?? 1) - 1),
  };
  await db.atomic()
    .set([...KEYS.checkouts, id], serializeCheckOut(updated))
    .set(KEYS.computedStats, newStats)
    .commit();

  invalidateCheckoutsCache();

  // Restore item quantity
  const item = await getItemById(checkout.itemId);
  if (item) {
    await updateItem(checkout.itemId, {
      quantity: item.quantity + checkout.quantity,
    });
  }

  return updated;
}

export async function getCheckOutById(id: string): Promise<CheckOut | null> {
  const db = await initKv();
  const result = await db.get<CheckOut>([...KEYS.checkouts, id]);
  return result.value ? deserializeCheckOut(result.value) : null;
}

/**
 * Cancel/delete a loan record. If the loan has not been returned yet, the
 * loaned quantity is restored to the item's stock before the record is removed.
 */
export async function deleteCheckOut(id: string): Promise<boolean> {
  const db = await initKv();
  const result = await db.get<CheckOut>([...KEYS.checkouts, id]);
  if (!result.value) return false;

  const checkout = deserializeCheckOut(result.value);

  // Restore stock for loans that were never returned and decrement active loan count
  const isActive = checkout.status !== "returned";
  if (isActive) {
    const item = await getItemById(checkout.itemId);
    if (item) {
      await updateItem(checkout.itemId, {
        quantity: item.quantity + checkout.quantity,
      });
    }
    const currentStats = await getComputedStats();
    const newStats: ComputedStats = {
      ...currentStats,
      activeLoansCount: Math.max(0, (currentStats.activeLoansCount ?? 1) - 1),
    };
    await db.atomic()
      .delete([...KEYS.checkouts, id])
      .set(KEYS.computedStats, newStats)
      .commit();
  } else {
    await db.delete([...KEYS.checkouts, id]);
  }

  invalidateCheckoutsCache();
  return true;
}

// ===== MAINTENANCE OPERATIONS =====

export interface MaintenanceUpdateInput {
  date: Date;
  type: MaintenanceRecord["type"];
  notes: string;
  performedBy?: string;
  conditionAfter?: "excellent" | "good" | "fair" | "needs-repair";
  nextInspectionDate?: Date;
}

/**
 * Append a maintenance/inspection entry to an item and update inspection metadata.
 */
export async function addMaintenanceRecord(
  itemId: string,
  input: MaintenanceUpdateInput,
): Promise<InventoryItem | null> {
  const existing = await getItemById(itemId);
  if (!existing) return null;

  const history = existing.maintenanceHistory ?? [];
  const newRecord: MaintenanceRecord = {
    id: crypto.randomUUID(),
    date: input.date,
    type: input.type,
    notes: input.notes,
    performedBy: input.performedBy,
    conditionAfter: input.conditionAfter,
  };

  const updates: Partial<InventoryItem> = {
    lastInspectedDate: input.date,
    nextInspectionDate: input.nextInspectionDate,
    maintenanceHistory: [newRecord, ...history],
  };

  if (input.conditionAfter && "condition" in existing) {
    (updates as Partial<InventoryItem> & { condition?: string }).condition =
      input.conditionAfter;
  }

  return await updateItem(itemId, updates);
}

/** Update only inspection scheduling metadata for an item. */
export async function updateInspectionSchedule(
  itemId: string,
  updates: { lastInspectedDate?: Date; nextInspectionDate?: Date },
): Promise<InventoryItem | null> {
  const existing = await getItemById(itemId);
  if (!existing) return null;

  return await updateItem(itemId, {
    lastInspectedDate: updates.lastInspectedDate ?? existing.lastInspectedDate,
    nextInspectionDate: updates.nextInspectionDate ??
      existing.nextInspectionDate,
  });
}

// ===== NECKER COUNT =====

export interface NeckerMetrics {
  inStock: number;
  created: number;
  totalMade: number;
  adultCreated: number;
  adultTotalMade: number;
}

export interface MoveCreatedToStockResult {
  metrics: NeckerMetrics;
  moved: number;
}

export interface DeliverAdultNeckersResult {
  metrics: NeckerMetrics;
  delivered: number;
}

export async function getNeckerCount(): Promise<number> {
  const db = await initKv();
  const result = await db.get<number>(KEYS.neckers);
  return result.value ?? 0;
}

/**
 * Returns the persisted necker count, or null when no value has been stored yet.
 * Useful for jobs that should ignore neckers until an explicit count is set.
 */
export async function getNeckerCountOrNull(): Promise<number | null> {
  const db = await initKv();
  const result = await db.get<number>(KEYS.neckers);
  return typeof result.value === "number" ? result.value : null;
}

/** Returns all persisted necker metrics, defaulting missing values to zero. */
export async function getNeckerMetrics(): Promise<NeckerMetrics> {
  const db = await initKv();
  const [inStock, created, totalMade, adultCreated, adultTotalMade] =
    await Promise.all([
      db.get<number>(KEYS.neckers),
      db.get<number>(KEYS.neckersCreated),
      db.get<number>(KEYS.neckersTotalMade),
      db.get<number>(KEYS.adultNeckersCreated),
      db.get<number>(KEYS.adultNeckersTotalMade),
    ]);

  return {
    inStock: inStock.value ?? 0,
    created: created.value ?? 0,
    totalMade: totalMade.value ?? 0,
    adultCreated: adultCreated.value ?? 0,
    adultTotalMade: adultTotalMade.value ?? 0,
  };
}

/** Adjust the necker count by `delta` (positive or negative). Returns the new total. */
export async function adjustNeckerCount(delta: number): Promise<number> {
  const db = await initKv();
  for (let attempt = 0; attempt < 3; attempt++) {
    const [stockRes, totalRes] = await Promise.all([
      db.get<number>(KEYS.neckers),
      db.get<number>(KEYS.neckersTotalMade),
    ]);
    const currentStock = stockRes.value ?? 0;
    const nextStock = Math.max(0, currentStock + delta);
    const positiveIncrease = Math.max(0, nextStock - currentStock);
    const nextTotal = (totalRes.value ?? 0) + positiveIncrease;

    const result = await db.atomic()
      .check(stockRes)
      .check(totalRes)
      .set(KEYS.neckers, nextStock)
      .set(KEYS.neckersTotalMade, nextTotal)
      .commit();

    if (result.ok) {
      return nextStock;
    }
  }

  // Fallback to current persisted stock if all retries lose a race.
  return await getNeckerCount();
}

/** Set the necker count to an absolute value. Returns the new total. */
export async function setNeckerCount(value: number): Promise<number> {
  const db = await initKv();
  const requested = Math.max(0, value);

  for (let attempt = 0; attempt < 3; attempt++) {
    const [stockRes, totalRes] = await Promise.all([
      db.get<number>(KEYS.neckers),
      db.get<number>(KEYS.neckersTotalMade),
    ]);
    const currentStock = stockRes.value ?? 0;
    const positiveIncrease = Math.max(0, requested - currentStock);
    const nextTotal = (totalRes.value ?? 0) + positiveIncrease;

    const result = await db.atomic()
      .check(stockRes)
      .check(totalRes)
      .set(KEYS.neckers, requested)
      .set(KEYS.neckersTotalMade, nextTotal)
      .commit();

    if (result.ok) {
      return requested;
    }
  }

  // Fallback to current persisted stock if all retries lose a race.
  return await getNeckerCount();
}

/**
 * Records newly made neckers.
 * Increases current created counter and all-time total made.
 */
export async function recordNeckersMade(
  quantity: number,
): Promise<NeckerMetrics> {
  const db = await initKv();
  const made = Math.max(0, Math.floor(quantity));
  if (made <= 0) {
    return await getNeckerMetrics();
  }

  const [stockRes, createdRes, totalRes, adultCreatedRes, adultTotalRes] =
    await Promise.all([
      db.get<number>(KEYS.neckers),
      db.get<number>(KEYS.neckersCreated),
      db.get<number>(KEYS.neckersTotalMade),
      db.get<number>(KEYS.adultNeckersCreated),
      db.get<number>(KEYS.adultNeckersTotalMade),
    ]);

  const next = {
    inStock: stockRes.value ?? 0,
    created: (createdRes.value ?? 0) + made,
    totalMade: (totalRes.value ?? 0) + made,
  };

  const result = await db.atomic()
    .check(stockRes)
    .check(createdRes)
    .check(totalRes)
    .set(KEYS.neckers, next.inStock)
    .set(KEYS.neckersCreated, next.created)
    .set(KEYS.neckersTotalMade, next.totalMade)
    .commit();

  if (!result.ok) {
    return await getNeckerMetrics();
  }

  return {
    inStock: next.inStock,
    created: next.created,
    totalMade: next.totalMade,
    adultCreated: adultCreatedRes.value ?? 0,
    adultTotalMade: adultTotalRes.value ?? 0,
  };
}

/**
 * Moves neckers from "created" into "in stock".
 * Returns the actual moved quantity (clamped to available created count).
 */
export async function moveCreatedToStock(
  quantity: number,
): Promise<MoveCreatedToStockResult> {
  const db = await initKv();
  const requested = Math.max(0, Math.floor(quantity));
  if (requested <= 0) {
    return { metrics: await getNeckerMetrics(), moved: 0 };
  }

  const [stockRes, createdRes, totalRes, adultCreatedRes, adultTotalRes] =
    await Promise.all([
      db.get<number>(KEYS.neckers),
      db.get<number>(KEYS.neckersCreated),
      db.get<number>(KEYS.neckersTotalMade),
      db.get<number>(KEYS.adultNeckersCreated),
      db.get<number>(KEYS.adultNeckersTotalMade),
    ]);

  const created = createdRes.value ?? 0;
  const moved = Math.min(created, requested);
  const next = {
    inStock: (stockRes.value ?? 0) + moved,
    created: created - moved,
    totalMade: totalRes.value ?? 0,
  };

  const result = await db.atomic()
    .check(stockRes)
    .check(createdRes)
    .check(totalRes)
    .set(KEYS.neckers, next.inStock)
    .set(KEYS.neckersCreated, next.created)
    .set(KEYS.neckersTotalMade, next.totalMade)
    .commit();

  if (!result.ok) {
    return { metrics: await getNeckerMetrics(), moved: 0 };
  }

  return {
    metrics: {
      inStock: next.inStock,
      created: next.created,
      totalMade: next.totalMade,
      adultCreated: adultCreatedRes.value ?? 0,
      adultTotalMade: adultTotalRes.value ?? 0,
    },
    moved,
  };
}

/** Records newly made adult neckers (affects adult counters only). */
export async function recordAdultNeckersMade(
  quantity: number,
): Promise<NeckerMetrics> {
  const db = await initKv();
  const made = Math.max(0, Math.floor(quantity));
  if (made <= 0) {
    return await getNeckerMetrics();
  }

  const [stockRes, createdRes, totalRes, adultCreatedRes, adultTotalRes] =
    await Promise.all([
      db.get<number>(KEYS.neckers),
      db.get<number>(KEYS.neckersCreated),
      db.get<number>(KEYS.neckersTotalMade),
      db.get<number>(KEYS.adultNeckersCreated),
      db.get<number>(KEYS.adultNeckersTotalMade),
    ]);

  const nextAdultCreated = (adultCreatedRes.value ?? 0) + made;
  const nextAdultTotal = (adultTotalRes.value ?? 0) + made;

  const result = await db.atomic()
    .check(adultCreatedRes)
    .check(adultTotalRes)
    .set(KEYS.adultNeckersCreated, nextAdultCreated)
    .set(KEYS.adultNeckersTotalMade, nextAdultTotal)
    .commit();

  if (!result.ok) {
    return await getNeckerMetrics();
  }

  return {
    inStock: stockRes.value ?? 0,
    created: createdRes.value ?? 0,
    totalMade: totalRes.value ?? 0,
    adultCreated: nextAdultCreated,
    adultTotalMade: nextAdultTotal,
  };
}

/** Marks adult neckers as delivered (decrements adult created, does not add extra counters). */
export async function deliverAdultNeckers(
  quantity: number,
): Promise<DeliverAdultNeckersResult> {
  const db = await initKv();
  const requested = Math.max(0, Math.floor(quantity));
  if (requested <= 0) {
    return { metrics: await getNeckerMetrics(), delivered: 0 };
  }

  const [stockRes, createdRes, totalRes, adultCreatedRes, adultTotalRes] =
    await Promise.all([
      db.get<number>(KEYS.neckers),
      db.get<number>(KEYS.neckersCreated),
      db.get<number>(KEYS.neckersTotalMade),
      db.get<number>(KEYS.adultNeckersCreated),
      db.get<number>(KEYS.adultNeckersTotalMade),
    ]);
  const current = adultCreatedRes.value ?? 0;
  const delivered = Math.min(current, requested);
  const next = current - delivered;

  const result = await db.atomic()
    .check(adultCreatedRes)
    .set(KEYS.adultNeckersCreated, next)
    .commit();

  if (!result.ok) {
    return { metrics: await getNeckerMetrics(), delivered: 0 };
  }

  return {
    metrics: {
      inStock: stockRes.value ?? 0,
      created: createdRes.value ?? 0,
      totalMade: totalRes.value ?? 0,
      adultCreated: next,
      adultTotalMade: adultTotalRes.value ?? 0,
    },
    delivered,
  };
}

/** Sets all-time total made, useful for importing a legacy baseline. */
export async function setNeckersTotalMade(
  value: number,
): Promise<NeckerMetrics> {
  const db = await initKv();
  const next = Math.max(0, Math.floor(value));
  const [stockRes, createdRes, adultCreatedRes, adultTotalRes] = await Promise
    .all([
      db.get<number>(KEYS.neckers),
      db.get<number>(KEYS.neckersCreated),
      db.get<number>(KEYS.adultNeckersCreated),
      db.get<number>(KEYS.adultNeckersTotalMade),
    ]);
  await db.set(KEYS.neckersTotalMade, next);
  return {
    inStock: stockRes.value ?? 0,
    created: createdRes.value ?? 0,
    totalMade: next,
    adultCreated: adultCreatedRes.value ?? 0,
    adultTotalMade: adultTotalRes.value ?? 0,
  };
}

/** Sets all-time adult total made, useful for importing a legacy adult baseline. */
export async function setAdultNeckersTotalMade(
  value: number,
): Promise<NeckerMetrics> {
  const db = await initKv();
  const next = Math.max(0, Math.floor(value));
  const [stockRes, createdRes, totalRes, adultCreatedRes] = await Promise.all([
    db.get<number>(KEYS.neckers),
    db.get<number>(KEYS.neckersCreated),
    db.get<number>(KEYS.neckersTotalMade),
    db.get<number>(KEYS.adultNeckersCreated),
  ]);
  await db.set(KEYS.adultNeckersTotalMade, next);
  return {
    inStock: stockRes.value ?? 0,
    created: createdRes.value ?? 0,
    totalMade: totalRes.value ?? 0,
    adultCreated: adultCreatedRes.value ?? 0,
    adultTotalMade: next,
  };
}

/** Resets only the current created counter; all-time total remains unchanged. */
export async function resetNeckersCreated(): Promise<NeckerMetrics> {
  const db = await initKv();
  const [stockRes, totalRes, adultCreatedRes, adultTotalRes] = await Promise
    .all([
      db.get<number>(KEYS.neckers),
      db.get<number>(KEYS.neckersTotalMade),
      db.get<number>(KEYS.adultNeckersCreated),
      db.get<number>(KEYS.adultNeckersTotalMade),
    ]);
  await db.set(KEYS.neckersCreated, 0);
  return {
    inStock: stockRes.value ?? 0,
    created: 0,
    totalMade: totalRes.value ?? 0,
    adultCreated: adultCreatedRes.value ?? 0,
    adultTotalMade: adultTotalRes.value ?? 0,
  };
}

/** Resets only the current adult created counter; adult total made remains unchanged. */
export async function resetAdultNeckersCreated(): Promise<NeckerMetrics> {
  const db = await initKv();
  const [stockRes, createdRes, totalRes, adultTotalRes] = await Promise.all([
    db.get<number>(KEYS.neckers),
    db.get<number>(KEYS.neckersCreated),
    db.get<number>(KEYS.neckersTotalMade),
    db.get<number>(KEYS.adultNeckersTotalMade),
  ]);
  await db.set(KEYS.adultNeckersCreated, 0);
  return {
    inStock: stockRes.value ?? 0,
    created: createdRes.value ?? 0,
    totalMade: totalRes.value ?? 0,
    adultCreated: 0,
    adultTotalMade: adultTotalRes.value ?? 0,
  };
}

// ===== SERIALIZATION HELPERS =====
// Deno KV doesn't store Date objects directly, so we convert them

// deno-lint-ignore no-explicit-any
function serializeItem(item: InventoryItem): any {
  // deno-lint-ignore no-explicit-any
  const serialized: any = { ...item };
  serialized.addedDate = item.addedDate.toISOString();
  serialized.lastUpdated = item.lastUpdated.toISOString();

  if (item.lastInspectedDate) {
    serialized.lastInspectedDate = item.lastInspectedDate.toISOString();
  }
  if (item.nextInspectionDate) {
    serialized.nextInspectionDate = item.nextInspectionDate.toISOString();
  }
  if (item.maintenanceHistory && item.maintenanceHistory.length > 0) {
    serialized.maintenanceHistory = item.maintenanceHistory.map((entry) => ({
      ...entry,
      date: entry.date.toISOString(),
    }));
  }

  if (item.category === "food") {
    serialized.expiryDate = item.expiryDate.toISOString();
  }

  return serialized;
}

// deno-lint-ignore no-explicit-any
function deserializeItem(data: any): InventoryItem {
  // deno-lint-ignore no-explicit-any
  const item: any = { ...data };
  item.addedDate = new Date(data.addedDate);
  item.lastUpdated = new Date(data.lastUpdated);

  if (data.lastInspectedDate) {
    item.lastInspectedDate = new Date(data.lastInspectedDate);
  }
  if (data.nextInspectionDate) {
    item.nextInspectionDate = new Date(data.nextInspectionDate);
  }
  if (Array.isArray(data.maintenanceHistory)) {
    item.maintenanceHistory = data.maintenanceHistory.map((entry: any) => ({
      ...entry,
      date: new Date(entry.date),
    }));
  }

  if (data.category === "food") {
    item.expiryDate = new Date(data.expiryDate);
  }

  return item as InventoryItem;
}

// deno-lint-ignore no-explicit-any
function serializeCheckOut(checkout: CheckOut): any {
  return {
    ...checkout,
    checkOutDate: checkout.checkOutDate.toISOString(),
    expectedReturnDate: checkout.expectedReturnDate.toISOString(),
    actualReturnDate: checkout.actualReturnDate?.toISOString(),
  };
}

// deno-lint-ignore no-explicit-any
function deserializeCheckOut(data: any): CheckOut {
  return {
    ...data,
    checkOutDate: new Date(data.checkOutDate),
    expectedReturnDate: new Date(data.expectedReturnDate),
    actualReturnDate: data.actualReturnDate
      ? new Date(data.actualReturnDate)
      : undefined,
  };
}

// ===== CAMP PLAN SERIALIZATION =====

// deno-lint-ignore no-explicit-any
function serializeCampPlan(plan: CampPlan): any {
  return {
    ...plan,
    campDate: plan.campDate.toISOString(),
    endDate: plan.endDate?.toISOString(),
    createdAt: plan.createdAt.toISOString(),
    lastUpdated: plan.lastUpdated.toISOString(),
  };
}

// deno-lint-ignore no-explicit-any
function deserializeCampPlan(data: any): CampPlan {
  return {
    ...data,
    campDate: new Date(data.campDate),
    endDate: data.endDate ? new Date(data.endDate) : undefined,
    createdAt: new Date(data.createdAt),
    lastUpdated: new Date(data.lastUpdated),
  };
}

// ===== CAMP PLAN OPERATIONS =====

export async function getAllCampPlans(): Promise<CampPlan[]> {
  if (campPlansCache && Date.now() < campPlansCache.expiresAt) {
    return campPlansCache.plans;
  }
  if (!campPlansInFlight) {
    campPlansInFlight = (async () => {
      const db = await initKv();
      const plans: CampPlan[] = [];
      for await (const entry of db.list<CampPlan>({ prefix: KEYS.camps })) {
        plans.push(deserializeCampPlan(entry.value));
      }
      plans.sort((a, b) => b.campDate.getTime() - a.campDate.getTime());
      campPlansCache = { plans, expiresAt: Date.now() + CACHE_TTL_MS };
      campPlansInFlight = null;
      return plans;
    })();
  }
  if (campPlansCache) return campPlansCache.plans;
  return await campPlansInFlight!;
}

export async function getCampPlanById(id: string): Promise<CampPlan | null> {
  const db = await initKv();
  const result = await db.get<CampPlan>([...KEYS.camps, id]);
  return result.value ? deserializeCampPlan(result.value) : null;
}

export async function createCampPlan(plan: CampPlan): Promise<CampPlan> {
  const db = await initKv();
  await db.set([...KEYS.camps, plan.id], serializeCampPlan(plan));
  invalidateCampPlansCache();
  return plan;
}

export async function updateCampPlan(
  id: string,
  updates: Partial<CampPlan>,
  /** Pass an already-fetched plan to skip the extra KV read. */
  existing?: CampPlan,
): Promise<CampPlan | null> {
  const plan = existing ?? await getCampPlanById(id);
  if (!plan) {
    return null;
  }

  const updated: CampPlan = {
    ...plan,
    ...updates,
    id,
    lastUpdated: new Date(),
  };

  const db = await initKv();
  await db.set([...KEYS.camps, id], serializeCampPlan(updated));
  invalidateCampPlansCache();
  return updated;
}

export async function deleteCampPlan(id: string): Promise<boolean> {
  const existing = await getCampPlanById(id);
  if (!existing) {
    return false;
  }
  const db = await initKv();
  await db.delete([...KEYS.camps, id]);
  invalidateCampPlansCache();
  return true;
}

// ===== CAMP TEMPLATES =====

// deno-lint-ignore no-explicit-any
function serializeCampTemplate(t: CampTemplate): any {
  return {
    ...t,
    createdAt: t.createdAt.toISOString(),
    lastUpdated: t.lastUpdated.toISOString(),
  };
}

// deno-lint-ignore no-explicit-any
function deserializeCampTemplate(data: any): CampTemplate {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    lastUpdated: new Date(data.lastUpdated),
  };
}

export async function getAllCampTemplates(): Promise<CampTemplate[]> {
  if (templatesCache && Date.now() < templatesCache.expiresAt) {
    return templatesCache.templates;
  }
  if (!templatesInFlight) {
    templatesInFlight = (async () => {
      const db = await initKv();
      const templates: CampTemplate[] = [];
      for await (
        const entry of db.list<CampTemplate>({ prefix: KEYS.templates })
      ) {
        templates.push(deserializeCampTemplate(entry.value));
      }
      templates.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );
      templatesCache = { templates, expiresAt: Date.now() + CACHE_TTL_MS };
      templatesInFlight = null;
      return templates;
    })();
  }
  if (templatesCache) return templatesCache.templates;
  return await templatesInFlight!;
}

export async function getCampTemplateById(
  id: string,
): Promise<CampTemplate | null> {
  const db = await initKv();
  const result = await db.get<CampTemplate>([...KEYS.templates, id]);
  return result.value ? deserializeCampTemplate(result.value) : null;
}

export async function createCampTemplate(
  name: string,
  items: CampTemplateItem[],
  createdBy: string,
  description?: string,
): Promise<CampTemplate> {
  const db = await initKv();
  const now = new Date();
  const template: CampTemplate = {
    id: crypto.randomUUID(),
    name,
    description,
    items,
    createdBy,
    createdAt: now,
    lastUpdated: now,
  };
  await db.set(
    [...KEYS.templates, template.id],
    serializeCampTemplate(template),
  );
  invalidateTemplatesCache();
  return template;
}

export async function updateCampTemplate(
  id: string,
  updates: Partial<CampTemplate>,
  existing?: CampTemplate,
): Promise<CampTemplate | null> {
  const template = existing ?? await getCampTemplateById(id);
  if (!template) return null;

  const updated: CampTemplate = {
    ...template,
    ...updates,
    id,
    lastUpdated: new Date(),
  };

  const db = await initKv();
  await db.set([...KEYS.templates, id], serializeCampTemplate(updated));
  invalidateTemplatesCache();
  return updated;
}

export async function deleteCampTemplate(id: string): Promise<boolean> {
  const existing = await getCampTemplateById(id);
  if (!existing) return false;
  const db = await initKv();
  await db.delete([...KEYS.templates, id]);
  invalidateTemplatesCache();
  return true;
}

// ===== FIRST AID KITS =====

// deno-lint-ignore no-explicit-any
function serializeFirstAidKit(kit: FirstAidKit): any {
  return {
    ...kit,
    createdAt: kit.createdAt.toISOString(),
    lastUpdated: kit.lastUpdated.toISOString(),
  };
}

// deno-lint-ignore no-explicit-any
function deserializeFirstAidKit(data: any): FirstAidKit {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    lastUpdated: new Date(data.lastUpdated),
  };
}

interface FirstAidCheckStateStored {
  lastCheckedAt: string | null;
  dismissedUntil: string | null;
  updatedAt: string;
}

// deno-lint-ignore no-explicit-any
function deserializeFirstAidCheckState(data: any): FirstAidCheckState {
  return {
    lastCheckedAt: data.lastCheckedAt ? new Date(data.lastCheckedAt) : null,
    dismissedUntil: data.dismissedUntil ? new Date(data.dismissedUntil) : null,
    updatedAt: new Date(data.updatedAt),
  };
}

function serializeFirstAidCheckState(
  state: FirstAidCheckState,
): FirstAidCheckStateStored {
  return {
    lastCheckedAt: state.lastCheckedAt
      ? state.lastCheckedAt.toISOString()
      : null,
    dismissedUntil: state.dismissedUntil
      ? state.dismissedUntil.toISOString()
      : null,
    updatedAt: state.updatedAt.toISOString(),
  };
}

function addOneCalendarMonth(from: Date): Date {
  const next = new Date(from);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + 1);
  const daysInTargetMonth = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0,
  ).getDate();
  next.setDate(Math.min(day, daysInTargetMonth));
  return next;
}

export async function getAllFirstAidKits(): Promise<FirstAidKit[]> {
  if (firstAidKitsCache && Date.now() < firstAidKitsCache.expiresAt) {
    return firstAidKitsCache.kits;
  }
  if (!firstAidKitsInFlight) {
    firstAidKitsInFlight = (async () => {
      const db = await initKv();
      const kits: FirstAidKit[] = [];
      for await (
        const entry of db.list<FirstAidKit>({ prefix: KEYS.firstAidKits })
      ) {
        kits.push(deserializeFirstAidKit(entry.value));
      }
      kits.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );
      firstAidKitsCache = { kits, expiresAt: Date.now() + CACHE_TTL_MS };
      firstAidKitsInFlight = null;
      return kits;
    })();
  }
  if (firstAidKitsCache) return firstAidKitsCache.kits;
  return await firstAidKitsInFlight!;
}

export async function getAllFirstAidKitIds(): Promise<string[]> {
  if (firstAidKitIdsCache && Date.now() < firstAidKitIdsCache.expiresAt) {
    return firstAidKitIdsCache.ids;
  }
  if (!firstAidKitIdsInFlight) {
    firstAidKitIdsInFlight = (async () => {
      const db = await initKv();
      const ids: string[] = [];
      for await (
        const entry of db.list<FirstAidKit>({ prefix: KEYS.firstAidKits })
      ) {
        ids.push(String(entry.key[entry.key.length - 1]));
      }
      ids.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      firstAidKitIdsCache = { ids, expiresAt: Date.now() + CACHE_TTL_MS };
      firstAidKitIdsInFlight = null;
      return ids;
    })();
  }
  if (firstAidKitIdsCache) return firstAidKitIdsCache.ids;
  return await firstAidKitIdsInFlight!;
}

export async function getFirstAidKitById(
  id: string,
): Promise<FirstAidKit | null> {
  const db = await initKv();
  const result = await db.get<FirstAidKit>([...KEYS.firstAidKits, id]);
  return result.value ? deserializeFirstAidKit(result.value) : null;
}

export async function createFirstAidKit(
  name: string,
  entries: FirstAidKit["entries"],
  createdBy: string,
  profileId?: string,
): Promise<FirstAidKit> {
  const db = await initKv();
  const now = new Date();
  const kit: FirstAidKit = {
    id: crypto.randomUUID(),
    name,
    profileId,
    entries,
    createdBy,
    createdAt: now,
    lastUpdated: now,
  };
  await db.set([...KEYS.firstAidKits, kit.id], serializeFirstAidKit(kit));
  invalidateFirstAidKitsCache();
  return kit;
}

export async function updateFirstAidKit(
  id: string,
  updates: Partial<FirstAidKit>,
  existing?: FirstAidKit,
): Promise<FirstAidKit | null> {
  const kit = existing ?? await getFirstAidKitById(id);
  if (!kit) return null;

  const updated: FirstAidKit = {
    ...kit,
    ...updates,
    id,
    lastUpdated: new Date(),
  };

  const db = await initKv();
  await db.set([...KEYS.firstAidKits, id], serializeFirstAidKit(updated));
  invalidateFirstAidKitsCache();
  return updated;
}

export async function deleteFirstAidKit(id: string): Promise<boolean> {
  const existing = await getFirstAidKitById(id);
  if (!existing) return false;
  const db = await initKv();
  await db.delete([...KEYS.firstAidKits, id]);
  invalidateFirstAidKitsCache();
  return true;
}

export async function getFirstAidOverallCheckState(): Promise<
  FirstAidCheckState | null
> {
  if (
    firstAidOverallCheckStateCache &&
    Date.now() < firstAidOverallCheckStateCache.expiresAt
  ) {
    return firstAidOverallCheckStateCache.state;
  }
  if (!firstAidOverallCheckStateInFlight) {
    firstAidOverallCheckStateInFlight = (async () => {
      const db = await initKv();
      const result = await db.get<FirstAidCheckStateStored>([
        ...KEYS.firstAidChecks,
        "overall",
      ]);
      const state = result.value
        ? deserializeFirstAidCheckState(result.value)
        : null;
      firstAidOverallCheckStateCache = {
        state,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
      firstAidOverallCheckStateInFlight = null;
      return state;
    })();
  }
  if (firstAidOverallCheckStateCache) {
    return firstAidOverallCheckStateCache.state;
  }
  return await firstAidOverallCheckStateInFlight!;
}

export async function getFirstAidKitCheckStates(): Promise<
  Record<string, FirstAidCheckState>
> {
  if (
    firstAidKitCheckStatesCache &&
    Date.now() < firstAidKitCheckStatesCache.expiresAt
  ) {
    return firstAidKitCheckStatesCache.states;
  }
  if (!firstAidKitCheckStatesInFlight) {
    firstAidKitCheckStatesInFlight = (async () => {
      const db = await initKv();
      const states: Record<string, FirstAidCheckState> = {};
      for await (
        const entry of db.list<FirstAidCheckStateStored>({
          prefix: [...KEYS.firstAidChecks, "kits"],
        })
      ) {
        const kitId = String(entry.key[entry.key.length - 1]);
        states[kitId] = deserializeFirstAidCheckState(entry.value);
      }
      firstAidKitCheckStatesCache = {
        states,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
      firstAidKitCheckStatesInFlight = null;
      return states;
    })();
  }
  if (firstAidKitCheckStatesCache) return firstAidKitCheckStatesCache.states;
  return await firstAidKitCheckStatesInFlight!;
}

export async function recordFirstAidCheckCompletion(
  kitIds: string[],
  markOverall: boolean,
): Promise<void> {
  const db = await initKv();
  const now = new Date();

  const uniqueKitIds = [
    ...new Set(kitIds.filter((kitId) => kitId.trim().length > 0)),
  ];
  const ops: Promise<unknown>[] = uniqueKitIds.map((kitId) =>
    db.set(
      [...KEYS.firstAidChecks, "kits", kitId],
      serializeFirstAidCheckState({
        lastCheckedAt: now,
        dismissedUntil: null,
        updatedAt: now,
      }),
    )
  );

  if (markOverall) {
    ops.push(
      db.set(
        [...KEYS.firstAidChecks, "overall"],
        serializeFirstAidCheckState({
          lastCheckedAt: now,
          dismissedUntil: null,
          updatedAt: now,
        }),
      ),
    );
  }

  await Promise.all(ops);
  invalidateFirstAidCheckStateCaches();
}

export async function dismissFirstAidOverallCheckReminder(): Promise<void> {
  const db = await initKv();
  const current = await getFirstAidOverallCheckState();
  const now = new Date();
  const dismissedUntil = addOneCalendarMonth(now);

  const kitStates = await getFirstAidKitCheckStates();
  const kitIds = await getAllFirstAidKitIds();

  const ops: Promise<unknown>[] = [
    db.set(
      [...KEYS.firstAidChecks, "overall"],
      serializeFirstAidCheckState({
        lastCheckedAt: current?.lastCheckedAt ?? null,
        dismissedUntil,
        updatedAt: now,
      }),
    ),
  ];

  for (const kitId of kitIds) {
    const state = kitStates[kitId] ?? null;
    ops.push(
      db.set(
        [...KEYS.firstAidChecks, "kits", kitId],
        serializeFirstAidCheckState({
          lastCheckedAt: state?.lastCheckedAt ?? null,
          dismissedUntil,
          updatedAt: now,
        }),
      ),
    );
  }

  await Promise.all(ops);
  invalidateFirstAidCheckStateCaches();
}

export async function dismissFirstAidKitCheckReminder(
  kitId: string,
): Promise<void> {
  const db = await initKv();
  const key = [...KEYS.firstAidChecks, "kits", kitId] as const;
  const existing = await db.get<FirstAidCheckStateStored>(key);
  const current = existing.value
    ? deserializeFirstAidCheckState(existing.value)
    : null;
  const now = new Date();
  const dismissedUntil = addOneCalendarMonth(now);

  await db.set(
    key,
    serializeFirstAidCheckState({
      lastCheckedAt: current?.lastCheckedAt ?? null,
      dismissedUntil,
      updatedAt: now,
    }),
  );

  // If every kit reminder is now dismissed, keep overall reminder in sync.
  const [kitIds, kitStates, overallState] = await Promise.all([
    getAllFirstAidKitIds(),
    getFirstAidKitCheckStates(),
    getFirstAidOverallCheckState(),
  ]);

  const allKitsDismissed = kitIds.length > 0 && kitIds.every((id) => {
    const state = id === kitId
      ? {
        lastCheckedAt: current?.lastCheckedAt ?? null,
        dismissedUntil,
        updatedAt: now,
      }
      : kitStates[id];
    return !!state?.dismissedUntil &&
      state.dismissedUntil.getTime() >= dismissedUntil.getTime();
  });

  if (allKitsDismissed) {
    await db.set(
      [...KEYS.firstAidChecks, "overall"],
      serializeFirstAidCheckState({
        lastCheckedAt: overallState?.lastCheckedAt ?? null,
        dismissedUntil,
        updatedAt: now,
      }),
    );
  }

  invalidateFirstAidCheckStateCaches();
}

export async function resetFirstAidCheckStates(): Promise<void> {
  const db = await initKv();
  const ops: Promise<unknown>[] = [
    db.delete([...KEYS.firstAidChecks, "overall"]),
  ];

  for await (
    const entry of db.list({
      prefix: [...KEYS.firstAidChecks, "kits"],
    })
  ) {
    ops.push(db.delete(entry.key));
  }

  await Promise.all(ops);
  invalidateFirstAidCheckStateCaches();
}

export async function getAllFirstAidCatalogItems(): Promise<
  FirstAidCatalogItem[]
> {
  if (firstAidCatalogCache && Date.now() < firstAidCatalogCache.expiresAt) {
    return firstAidCatalogCache.items;
  }
  if (!firstAidCatalogInFlight) {
    firstAidCatalogInFlight = (async () => {
      const db = await initKv();
      const items: FirstAidCatalogItem[] = [];
      for await (
        const entry of db.list<FirstAidCatalogItem>({
          prefix: KEYS.firstAidCatalog,
        })
      ) {
        const section = (FIRST_AID_SECTIONS as readonly string[]).includes(
            entry.value.section,
          )
          ? entry.value.section
          : "General";
        items.push({ ...entry.value, section });
      }

      if (items.length === 0) {
        const seedOps = DEFAULT_FIRST_AID_CATALOG.map((item) =>
          db.set([...KEYS.firstAidCatalog, item.id], item)
        );
        await Promise.all(seedOps);
        items.push(...DEFAULT_FIRST_AID_CATALOG);
      } else {
        const existingIds = new Set(items.map((item) => item.id));
        const missingDefaults = DEFAULT_FIRST_AID_CATALOG.filter((item) =>
          !existingIds.has(item.id)
        );
        if (missingDefaults.length > 0) {
          await Promise.all(
            missingDefaults.map((item) =>
              db.set([...KEYS.firstAidCatalog, item.id], item)
            ),
          );
          items.push(...missingDefaults);
        }
      }

      items.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );
      firstAidCatalogCache = { items, expiresAt: Date.now() + CACHE_TTL_MS };
      firstAidCatalogInFlight = null;
      return items;
    })();
  }
  if (firstAidCatalogCache) return firstAidCatalogCache.items;
  return await firstAidCatalogInFlight!;
}

export async function createFirstAidCatalogItem(
  item: FirstAidCatalogItem,
): Promise<FirstAidCatalogItem> {
  const db = await initKv();
  const section =
    (FIRST_AID_SECTIONS as readonly string[]).includes(item.section)
      ? item.section
      : "General";
  await db.set([...KEYS.firstAidCatalog, item.id], { ...item, section });
  invalidateFirstAidCatalogCache();
  return { ...item, section };
}

export async function updateFirstAidCatalogItem(
  id: string,
  updates: Partial<FirstAidCatalogItem>,
): Promise<FirstAidCatalogItem | null> {
  const db = await initKv();
  const existing = await db.get<FirstAidCatalogItem>([
    ...KEYS.firstAidCatalog,
    id,
  ]);
  if (!existing.value) return null;

  const updated: FirstAidCatalogItem = {
    ...existing.value,
    ...updates,
    id,
  };
  const section =
    (FIRST_AID_SECTIONS as readonly string[]).includes(updated.section)
      ? updated.section
      : "General";
  await db.set([...KEYS.firstAidCatalog, id], { ...updated, section });
  invalidateFirstAidCatalogCache();
  return { ...updated, section };
}

export async function deleteFirstAidCatalogItem(id: string): Promise<boolean> {
  const db = await initKv();
  const existing = await db.get<FirstAidCatalogItem>([
    ...KEYS.firstAidCatalog,
    id,
  ]);
  if (!existing.value) return false;
  await db.delete([...KEYS.firstAidCatalog, id]);
  invalidateFirstAidCatalogCache();
  return true;
}

// ===== RISK ASSESSMENTS =====

// deno-lint-ignore no-explicit-any
function serializeRiskAssessment(assessment: RiskAssessment): any {
  return {
    ...assessment,
    createdAt: assessment.createdAt.toISOString(),
    lastUpdated: assessment.lastUpdated.toISOString(),
    lastReviewedAt: assessment.lastReviewedAt
      ? assessment.lastReviewedAt.toISOString()
      : null,
    lastAnnualCheckAt: assessment.lastAnnualCheckAt
      ? assessment.lastAnnualCheckAt.toISOString()
      : null,
    annualReminderDismissedUntil: assessment.annualReminderDismissedUntil
      ? assessment.annualReminderDismissedUntil.toISOString()
      : null,
  };
}

// deno-lint-ignore no-explicit-any
function deserializeRiskAssessment(data: any): RiskAssessment {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    lastUpdated: new Date(data.lastUpdated),
    lastReviewedAt: data.lastReviewedAt ? new Date(data.lastReviewedAt) : null,
    lastAnnualCheckAt: data.lastAnnualCheckAt
      ? new Date(data.lastAnnualCheckAt)
      : null,
    lastAnnualCheckedBy: data.lastAnnualCheckedBy ?? null,
    annualReminderDismissedUntil: data.annualReminderDismissedUntil
      ? new Date(data.annualReminderDismissedUntil)
      : null,
  };
}

export async function getAllRiskAssessments(): Promise<RiskAssessment[]> {
  if (riskAssessmentsCache && Date.now() < riskAssessmentsCache.expiresAt) {
    return riskAssessmentsCache.assessments;
  }
  if (!riskAssessmentsInFlight) {
    riskAssessmentsInFlight = (async () => {
      const db = await initKv();
      const assessments: RiskAssessment[] = [];
      for await (
        const entry of db.list<RiskAssessment>({ prefix: KEYS.riskAssessments })
      ) {
        assessments.push(deserializeRiskAssessment(entry.value));
      }
      assessments.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );
      riskAssessmentsCache = {
        assessments,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
      riskAssessmentsInFlight = null;
      return assessments;
    })();
  }
  if (riskAssessmentsCache) return riskAssessmentsCache.assessments;
  return await riskAssessmentsInFlight!;
}

export async function getRiskAssessmentById(
  id: string,
): Promise<RiskAssessment | null> {
  const db = await initKv();
  const result = await db.get<RiskAssessment>([...KEYS.riskAssessments, id]);
  return result.value ? deserializeRiskAssessment(result.value) : null;
}

export async function createRiskAssessment(
  name: string,
  risks: RiskAssessment["risks"],
  createdBy: string,
): Promise<RiskAssessment> {
  const db = await initKv();
  const now = new Date();
  const assessment: RiskAssessment = {
    id: crypto.randomUUID(),
    name,
    risks,
    lastReviewedAt: null,
    lastAnnualCheckAt: null,
    lastAnnualCheckedBy: null,
    annualReminderDismissedUntil: null,
    createdBy,
    createdAt: now,
    lastUpdated: now,
  };
  await db.set(
    [...KEYS.riskAssessments, assessment.id],
    serializeRiskAssessment(assessment),
  );
  invalidateRiskAssessmentsCache();
  return assessment;
}

export async function updateRiskAssessment(
  id: string,
  updates: Partial<RiskAssessment>,
  existing?: RiskAssessment,
): Promise<RiskAssessment | null> {
  const assessment = existing ?? await getRiskAssessmentById(id);
  if (!assessment) return null;

  const updated: RiskAssessment = {
    ...assessment,
    ...updates,
    id,
    lastUpdated: new Date(),
  };

  const db = await initKv();
  await db.set([...KEYS.riskAssessments, id], serializeRiskAssessment(updated));
  invalidateRiskAssessmentsCache();
  return updated;
}

export async function deleteRiskAssessment(id: string): Promise<boolean> {
  const existing = await getRiskAssessmentById(id);
  if (!existing) return false;
  const db = await initKv();
  await db.delete([...KEYS.riskAssessments, id]);
  invalidateRiskAssessmentsCache();
  return true;
}

export async function markRiskAssessmentReviewed(id: string): Promise<void> {
  const assessment = await getRiskAssessmentById(id);
  if (!assessment) return;
  await updateRiskAssessment(id, { lastReviewedAt: new Date() }, assessment);
}

export async function recordRiskAssessmentAnnualCheck(
  id: string,
  checkedBy: string,
): Promise<void> {
  const assessment = await getRiskAssessmentById(id);
  if (!assessment) return;
  await updateRiskAssessment(
    id,
    {
      lastAnnualCheckAt: new Date(),
      lastAnnualCheckedBy: checkedBy,
      annualReminderDismissedUntil: null,
    },
    assessment,
  );
}

export async function dismissRiskAssessmentAnnualReminder(
  id: string,
): Promise<void> {
  const assessment = await getRiskAssessmentById(id);
  if (!assessment) return;
  const now = new Date();
  const dismissedUntil = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  await updateRiskAssessment(
    id,
    {
      annualReminderDismissedUntil: dismissedUntil,
    },
    assessment,
  );
}

export async function replaceAllRiskAssessmentsFromBackup(
  assessments: RiskAssessment[],
): Promise<number> {
  const db = await initKv();

  for await (const entry of db.list({ prefix: KEYS.riskAssessments })) {
    await db.delete(entry.key);
  }

  for (const assessment of assessments) {
    await db.set(
      [...KEYS.riskAssessments, assessment.id],
      serializeRiskAssessment(assessment),
    );
  }

  invalidateRiskAssessmentsCache();
  return assessments.length;
}

export async function mergeRiskAssessmentsFromBackup(
  assessments: RiskAssessment[],
): Promise<{ created: number; updated: number; total: number }> {
  const db = await initKv();
  const existingIds = new Set<string>();

  for await (const entry of db.list({ prefix: KEYS.riskAssessments })) {
    const keyPart = entry.key[entry.key.length - 1];
    if (typeof keyPart === "string") {
      existingIds.add(keyPart);
    }
  }

  let created = 0;
  let updated = 0;

  for (const assessment of assessments) {
    if (existingIds.has(assessment.id)) {
      updated++;
    } else {
      created++;
      existingIds.add(assessment.id);
    }

    await db.set(
      [...KEYS.riskAssessments, assessment.id],
      serializeRiskAssessment(assessment),
    );
  }

  invalidateRiskAssessmentsCache();
  return { created, updated, total: assessments.length };
}

// ===== MEAL PLANNER =====

export async function getAllMeals(): Promise<Meal[]> {
  if (mealsCache && Date.now() < mealsCache.expiresAt) {
    return mealsCache.meals;
  }
  if (!mealsInFlight) {
    mealsInFlight = (async () => {
      const db = await initKv();
      const meals: Meal[] = [];
      for await (const entry of db.list<Meal>({ prefix: KEYS.meals })) {
        if (entry.value) meals.push(entry.value);
      }
      const sorted = meals.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
      );
      mealsCache = { meals: sorted, expiresAt: Date.now() + CACHE_TTL_MS };
      mealsInFlight = null;
      return sorted;
    })();
  }
  if (mealsCache) return mealsCache.meals;
  return await mealsInFlight!;
}

export async function getMealById(id: string): Promise<Meal | null> {
  const db = await initKv();
  const result = await db.get<Meal>([...KEYS.meals, id]);
  return result.value ?? null;
}

export async function createMeal(payload: MealPayload): Promise<Meal> {
  const db = await initKv();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const meal: Meal = { id, ...payload, createdAt: now, updatedAt: now };
  await db.set([...KEYS.meals, id], meal);
  invalidateMealsCache();
  return meal;
}

export async function updateMeal(
  id: string,
  payload: MealPayload,
): Promise<Meal | null> {
  const db = await initKv();
  const existing = await getMealById(id);
  if (!existing) return null;
  const updated: Meal = {
    ...existing,
    ...payload,
    id,
    updatedAt: new Date().toISOString(),
  };
  await db.set([...KEYS.meals, id], updated);
  invalidateMealsCache();
  return updated;
}

export async function deleteMeal(id: string): Promise<boolean> {
  const existing = await getMealById(id);
  if (!existing) return false;
  const db = await initKv();
  await db.delete([...KEYS.meals, id]);
  invalidateMealsCache();
  return true;
}

// ===== DATABASE CLEANUP =====

export interface CleanUpReport {
  /** Secondary index entries that pointed to deleted items, now removed. */
  orphanedIndexes: number;
  /** Returned loan records older than retainMonths, now purged. */
  oldReturnedLoans: number;
}

/**
 * Removes stale data that accumulates over time:
 *  1. Orphaned secondary index entries (item deleted but index entry left behind)
 *  2. Returned loan records older than `retainMonths` months (default: 6)
 *
 * Safe to run at any time — does not touch active items, active loans, or stats.
 */
export async function cleanUpDb(retainMonths = 6): Promise<CleanUpReport> {
  const db = await initKv();
  let orphanedIndexes = 0;
  let oldReturnedLoans = 0;

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - retainMonths);

  const deleteOps: Promise<void>[] = [];

  // 1. Orphaned secondary indexes — item ID is always the last key segment
  for await (const entry of db.list({ prefix: ["inventory", "idx"] })) {
    const itemId = entry.key[entry.key.length - 1] as string;
    const item = await db.get([...KEYS.items, itemId]);
    if (!item.value) {
      deleteOps.push(db.delete(entry.key));
      orphanedIndexes++;
    }
  }

  // 2. Old returned loans
  for await (const entry of db.list<CheckOut>({ prefix: KEYS.checkouts })) {
    const checkout = deserializeCheckOut(entry.value);
    if (
      checkout.status === "returned" &&
      checkout.actualReturnDate &&
      new Date(checkout.actualReturnDate as unknown as string) < cutoff
    ) {
      deleteOps.push(db.delete(entry.key));
      oldReturnedLoans++;
    }
  }

  await Promise.all(deleteOps);

  if (oldReturnedLoans > 0) {
    invalidateCheckoutsCache();
  }

  return { orphanedIndexes, oldReturnedLoans };
}

// ===== CLEAR DATA =====

export interface ClearReport {
  items: number;
  indexes: number;
}

/**
 * Deletes all inventory items and their secondary indexes.
 * Resets the necker count and computed stats to zero.
 */
export async function clearInventoryData(): Promise<ClearReport> {
  const db = await initKv();
  const report: ClearReport = { items: 0, indexes: 0 };

  const deleteOps: Promise<void>[] = [];

  for await (const entry of db.list({ prefix: KEYS.items })) {
    deleteOps.push(db.delete(entry.key));
    report.items++;
  }

  for await (const entry of db.list({ prefix: ["inventory", "idx"] })) {
    deleteOps.push(db.delete(entry.key));
    report.indexes++;
  }

  // Reset scalar keys
  deleteOps.push(db.delete(KEYS.neckers));
  deleteOps.push(db.delete(KEYS.neckersCreated));
  deleteOps.push(db.delete(KEYS.neckersTotalMade));
  deleteOps.push(db.delete(KEYS.adultNeckersCreated));
  deleteOps.push(db.delete(KEYS.adultNeckersTotalMade));
  deleteOps.push(db.set(KEYS.computedStats, emptyStats()).then(() => {}));

  await Promise.all(deleteOps);

  return report;
}

/** Deletes all loan/checkout records and resets the active loans count. */
export async function clearLoans(): Promise<number> {
  const db = await initKv();
  const deleteOps: Promise<void>[] = [];
  for await (const entry of db.list({ prefix: KEYS.checkouts })) {
    deleteOps.push(db.delete(entry.key));
  }
  // Reset activeLoansCount in computed stats
  const current = await db.get<ComputedStats>(KEYS.computedStats);
  const stats = current.value ?? emptyStats();
  deleteOps.push(
    db.set(KEYS.computedStats, {
      ...stats,
      activeLoansCount: 0,
    }) as unknown as Promise<void>,
  );
  await Promise.all(deleteOps);
  invalidateCheckoutsCache();
  return deleteOps.length - 1; // exclude the stats set
}

/** Deletes all camp plans and templates. */
export async function clearCamps(): Promise<number> {
  const db = await initKv();
  const deleteOps: Promise<void>[] = [];
  for await (const entry of db.list({ prefix: KEYS.camps })) {
    deleteOps.push(db.delete(entry.key));
  }
  for await (const entry of db.list({ prefix: KEYS.templates })) {
    deleteOps.push(db.delete(entry.key));
  }
  await Promise.all(deleteOps);
  return deleteOps.length;
}

/** Deletes all meal records. */
export async function clearMeals(): Promise<number> {
  const db = await initKv();
  const deleteOps: Promise<void>[] = [];
  for await (const entry of db.list({ prefix: KEYS.meals })) {
    deleteOps.push(db.delete(entry.key));
  }
  await Promise.all(deleteOps);
  return deleteOps.length;
}
