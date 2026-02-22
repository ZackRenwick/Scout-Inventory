/// <reference lib="deno.unstable" />
// Deno KV database setup and operations
import type { InventoryItem, CheckOut, FoodItem, ItemCategory, ItemSpace, CampPlan } from "../types/inventory.ts";

// Initialize Deno KV
let kv: Deno.Kv;

export async function initKv(): Promise<Deno.Kv> {
  if (!kv) {
    kv = await Deno.openKv();
  }
  return kv;
}

// ===== KEY LAYOUT =====
//
// Primary data:
//   ["inventory", "items", <id>]                          → InventoryItem
//   ["inventory", "checkouts", <id>]                      → CheckOut
//   ["inventory", "neckers", "count"]                     → number
//
// Secondary indexes (value = item id):
//   ["inventory", "idx", "category", <category>, <id>]   → id
//   ["inventory", "idx", "space",    <space>,    <id>]   → id
//   ["inventory", "idx", "expiry",   <isoDate>,  <id>]   → id  (food only; ISO strings sort correctly)
//
// Precomputed stats (updated atomically on every write):
//   ["inventory", "stats", "computed"]                    → ComputedStats

const KEYS = {
  items:         ["inventory", "items"] as const,
  checkouts:     ["inventory", "checkouts"] as const,
  neckers:       ["inventory", "neckers", "count"] as const,
  computedStats: ["inventory", "stats", "computed"] as const,
  camps:         ["camps", "plans"] as const,
};

// Index key helpers
const IDX = {
  category:       ["inventory", "idx", "category"] as const,
  space:          ["inventory", "idx", "space"] as const,
  expiry:         ["inventory", "idx", "expiry"] as const,
  categoryKey:    (cat: string, id: string) => ["inventory", "idx", "category", cat, id] as const,
  spaceKey:       (sp: string,  id: string) => ["inventory", "idx", "space",    sp,  id] as const,
  expiryKey:      (iso: string, id: string) => ["inventory", "idx", "expiry",   iso, id] as const,
};

// ===== PRE-COMPUTED STATS =====

export interface ComputedStats {
  totalItems: number;
  totalQuantity: number;
  categoryBreakdown: Record<ItemCategory, { count: number; quantity: number }>;
  spaceBreakdown: Record<ItemSpace, { count: number; quantity: number }>;
  lowStockItems: number;
  needsRepairItems: number;
}

function emptyStats(): ComputedStats {
  return {
    totalItems: 0,
    totalQuantity: 0,
    categoryBreakdown: {
      tent: { count: 0, quantity: 0 },
      cooking: { count: 0, quantity: 0 },
      food: { count: 0, quantity: 0 },
      "camping-tools": { count: 0, quantity: 0 },
      games: { count: 0, quantity: 0 },
    },
    spaceBreakdown: {
      "camp-store": { count: 0, quantity: 0 },
      "scout-post-loft": { count: 0, quantity: 0 },
    },
    lowStockItems: 0,
    needsRepairItems: 0,
  };
}

function hasCondition(item: InventoryItem): item is InventoryItem & { condition: string } {
  return "condition" in item;
}

/**
 * Apply a single item to a stats snapshot (+1 to add it, -1 to remove it).
 * Uses sign to avoid duplicating logic for add vs remove.
 */
function applyItemToStats(stats: ComputedStats, item: InventoryItem, sign: 1 | -1): ComputedStats {
  const next: ComputedStats = {
    totalItems:    stats.totalItems    + sign,
    totalQuantity: stats.totalQuantity + sign * item.quantity,
    categoryBreakdown: { ...stats.categoryBreakdown } as ComputedStats["categoryBreakdown"],
    spaceBreakdown:    { ...stats.spaceBreakdown }    as ComputedStats["spaceBreakdown"],
    lowStockItems:     stats.lowStockItems,
    needsRepairItems:  stats.needsRepairItems,
  };

  // Deep-copy the two buckets we'll touch
  const cat  = item.category as ItemCategory;
  const sp   = (item.space ?? "camp-store") as ItemSpace;
  next.categoryBreakdown[cat] = { ...next.categoryBreakdown[cat] };
  next.spaceBreakdown[sp]     = { ...next.spaceBreakdown[sp] };

  next.categoryBreakdown[cat].count    += sign;
  next.categoryBreakdown[cat].quantity += sign * item.quantity;
  next.spaceBreakdown[sp].count        += sign;
  next.spaceBreakdown[sp].quantity     += sign * item.quantity;

  if (item.quantity <= item.minThreshold) next.lowStockItems += sign;
  if (hasCondition(item) && item.condition === "needs-repair") next.needsRepairItems += sign;

  return next;
}

/** Read the precomputed stats from KV (O(1)). Falls back to zero-state if not yet built. */
export async function getComputedStats(): Promise<ComputedStats> {
  const db = await initKv();
  const result = await db.get<ComputedStats>(KEYS.computedStats);
  return result.value ?? emptyStats();
}

// ===== IN-MEMORY CACHE (for getAllItems / full-list pages) =====
// All writes invalidate this cache immediately, so the TTL is just a safety net
// against external KV modifications. 5 minutes is a safe, sensible default.
const CACHE_TTL_MS = 5 * 60_000; // 5 minutes
let itemsCache: { items: InventoryItem[]; expiresAt: number } | null = null;

function invalidateItemsCache(): void {
  itemsCache = null;
}

// ===== ATOMIC INDEX HELPERS =====

/** Append index entries for one item onto an existing atomic operation. */
function addToIndex(op: Deno.AtomicOperation, item: InventoryItem): void {
  op.set(IDX.categoryKey(item.category, item.id), item.id);
  op.set(IDX.spaceKey(item.space ?? "camp-store", item.id), item.id);
  if (item.category === "food") {
    op.set(IDX.expiryKey((item as FoodItem).expiryDate.toISOString(), item.id), item.id);
  }
}

/** Remove index entries for one item from an existing atomic operation. */
function removeFromIndex(op: Deno.AtomicOperation, item: InventoryItem): void {
  op.delete(IDX.categoryKey(item.category, item.id));
  op.delete(IDX.spaceKey(item.space ?? "camp-store", item.id));
  if (item.category === "food") {
    op.delete(IDX.expiryKey((item as FoodItem).expiryDate.toISOString(), item.id));
  }
}

// ===== INVENTORY ITEMS OPERATIONS =====

export async function getAllItems(): Promise<InventoryItem[]> {
  if (itemsCache && Date.now() < itemsCache.expiresAt) {
    return itemsCache.items;
  }

  const db = await initKv();
  const items: InventoryItem[] = [];
  
  const entries = db.list<InventoryItem>({ prefix: KEYS.items });
  for await (const entry of entries) {
    items.push(deserializeItem(entry.value));
  }

  itemsCache = { items, expiresAt: Date.now() + CACHE_TTL_MS };
  return items;
}

export async function getItemById(id: string): Promise<InventoryItem | null> {
  const db = await initKv();
  const result = await db.get<InventoryItem>([...KEYS.items, id]);
  return result.value ? deserializeItem(result.value) : null;
}

/**
 * Fetch all items for a specific category directly from the category index.
 * O(n_category) — does not scan the full item list.
 */
export async function getItemsByCategory(category: ItemCategory): Promise<InventoryItem[]> {
  const db = await initKv();
  const ids: string[] = [];
  for await (const entry of db.list<string>({ prefix: [...IDX.category, category] })) {
    ids.push(entry.value);
  }
  const results = await Promise.all(ids.map((id) => getItemById(id)));
  return results.filter((item): item is InventoryItem => item !== null);
}

/**
 * Fetch all items for a specific space directly from the space index.
 * O(n_space) — does not scan the full item list.
 */
export async function getItemsBySpace(space: ItemSpace): Promise<InventoryItem[]> {
  const db = await initKv();
  const ids: string[] = [];
  for await (const entry of db.list<string>({ prefix: [...IDX.space, space] })) {
    ids.push(entry.value);
  }
  const results = await Promise.all(ids.map((id) => getItemById(id)));
  return results.filter((item): item is InventoryItem => item !== null);
}

/**
 * Fetch all food items ordered by expiry date (ascending) using the expiry index.
 * ISO date strings sort lexicographically, so the KV scan order is chronological.
 * O(n_food) — does not scan the full item list.
 */
export async function getFoodItemsSortedByExpiry(): Promise<FoodItem[]> {
  const db = await initKv();
  const ids: string[] = [];
  for await (const entry of db.list<string>({ prefix: IDX.expiry })) {
    ids.push(entry.value);
  }
  const results = await Promise.all(ids.map((id) => getItemById(id)));
  return results.filter((item): item is FoodItem => item !== null && item.category === "food");
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

export async function updateItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem | null> {
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
  const newStats = applyItemToStats(applyItemToStats(currentStats, existing, -1), updated, 1);

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
  for await (const entry of db.list({ prefix: ["inventory", "idx"] })) {
    await db.delete(entry.key);
  }

  // 2. Scan all items, rebuild indexes + stats
  let stats = emptyStats();
  const entries = db.list<InventoryItem>({ prefix: KEYS.items });

  for await (const entry of entries) {
    const item = deserializeItem(entry.value);
    const op = db.atomic();
    addToIndex(op, item);
    await op.commit();
    stats = applyItemToStats(stats, item, 1);
  }

  // 3. Write rebuilt stats
  await db.set(KEYS.computedStats, stats);
  
  // 4. Invalidate in-memory cache
  invalidateItemsCache();
}

// ===== CHECK-OUT OPERATIONS =====

export async function getAllCheckOuts(): Promise<CheckOut[]> {
  const db = await initKv();
  const checkouts: CheckOut[] = [];
  
  const entries = db.list<CheckOut>({ prefix: KEYS.checkouts });
  for await (const entry of entries) {
    checkouts.push(deserializeCheckOut(entry.value));
  }
  
  return checkouts;
}

export async function getActiveCheckOuts(): Promise<CheckOut[]> {
  const allCheckOuts = await getAllCheckOuts();
  return allCheckOuts.filter((co) => co.status === "checked-out" || co.status === "overdue");
}

export async function createCheckOut(checkout: CheckOut): Promise<CheckOut> {
  const db = await initKv();
  const serializedCheckOut = serializeCheckOut(checkout);
  await db.set([...KEYS.checkouts, checkout.id], serializedCheckOut);
  
  // Update item quantity
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
  
  await db.set([...KEYS.checkouts, id], serializeCheckOut(updated));
  
  // Restore item quantity
  const item = await getItemById(checkout.itemId);
  if (item) {
    await updateItem(checkout.itemId, {
      quantity: item.quantity + checkout.quantity,
    });
  }
  
  return updated;
}

// ===== NECKER COUNT =====

export async function getNeckerCount(): Promise<number> {
  const db = await initKv();
  const result = await db.get<number>(KEYS.neckers);
  return result.value ?? 0;
}

/** Adjust the necker count by `delta` (positive or negative). Returns the new total. */
export async function adjustNeckerCount(delta: number): Promise<number> {
  const db = await initKv();
  const current = (await db.get<number>(KEYS.neckers)).value ?? 0;
  const next = Math.max(0, current + delta);
  await db.set(KEYS.neckers, next);
  return next;
}

/** Set the necker count to an absolute value. Returns the new total. */
export async function setNeckerCount(value: number): Promise<number> {
  const db = await initKv();
  const next = Math.max(0, value);
  await db.set(KEYS.neckers, next);
  return next;
}

// ===== SERIALIZATION HELPERS =====
// Deno KV doesn't store Date objects directly, so we convert them

// deno-lint-ignore no-explicit-any
function serializeItem(item: InventoryItem): any {
  // deno-lint-ignore no-explicit-any
  const serialized: any = { ...item };
  serialized.addedDate = item.addedDate.toISOString();
  serialized.lastUpdated = item.lastUpdated.toISOString();
  
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
    actualReturnDate: data.actualReturnDate ? new Date(data.actualReturnDate) : undefined,
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
  const db = await initKv();
  const plans: CampPlan[] = [];
  for await (const entry of db.list<CampPlan>({ prefix: KEYS.camps })) {
    plans.push(deserializeCampPlan(entry.value));
  }
  plans.sort((a, b) => b.campDate.getTime() - a.campDate.getTime());
  return plans;
}

export async function getCampPlanById(id: string): Promise<CampPlan | null> {
  const db = await initKv();
  const result = await db.get<CampPlan>([...KEYS.camps, id]);
  return result.value ? deserializeCampPlan(result.value) : null;
}

export async function createCampPlan(plan: CampPlan): Promise<CampPlan> {
  const db = await initKv();
  await db.set([...KEYS.camps, plan.id], serializeCampPlan(plan));
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
  return updated;
}

export async function deleteCampPlan(id: string): Promise<boolean> {
  const existing = await getCampPlanById(id);
  if (!existing) {
    return false;
  }
  const db = await initKv();
  await db.delete([...KEYS.camps, id]);
  return true;
}
