/// <reference lib="deno.unstable" />
// Deno KV database setup and operations
import type { InventoryItem, CheckOut } from "../types/inventory.ts";

// Initialize Deno KV
let kv: Deno.Kv;

export async function initKv(): Promise<Deno.Kv> {
  if (!kv) {
    kv = await Deno.openKv();
  }
  return kv;
}

// Key prefixes for organization
const KEYS = {
  items: ["inventory", "items"],
  checkouts: ["inventory", "checkouts"],
  stats: ["inventory", "stats"],
  neckers: ["inventory", "neckers", "count"],
};

// ===== IN-MEMORY CACHE =====
const CACHE_TTL_MS = 60_000; // 60 seconds
let itemsCache: { items: InventoryItem[]; expiresAt: number } | null = null;

function invalidateItemsCache(): void {
  itemsCache = null;
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
    // Convert date strings back to Date objects
    const item = deserializeItem(entry.value);
    items.push(item);
  }

  itemsCache = { items, expiresAt: Date.now() + CACHE_TTL_MS };
  return items;
}

export async function getItemById(id: string): Promise<InventoryItem | null> {
  const db = await initKv();
  const result = await db.get<InventoryItem>([...KEYS.items, id]);
  return result.value ? deserializeItem(result.value) : null;
}

export async function getItemsByCategory(category: "tent" | "cooking" | "food"): Promise<InventoryItem[]> {
  const allItems = await getAllItems();
  return allItems.filter((item) => item.category === category);
}

export async function createItem(item: InventoryItem): Promise<InventoryItem> {
  const db = await initKv();
  const serializedItem = serializeItem(item);
  await db.set([...KEYS.items, item.id], serializedItem);
  invalidateItemsCache();
  return item;
}

export async function updateItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem | null> {
  const db = await initKv();
  const existing = await getItemById(id);
  
  if (!existing) return null;
  
  const updated: InventoryItem = {
    ...existing,
    ...updates,
    id, // Ensure ID doesn't change
    lastUpdated: new Date(),
  } as InventoryItem;
  
  const serializedItem = serializeItem(updated);
  await db.set([...KEYS.items, id], serializedItem);
  invalidateItemsCache();
  return updated;
}

export async function deleteItem(id: string): Promise<boolean> {
  const db = await initKv();
  const existing = await getItemById(id);
  
  if (!existing) return false;
  
  await db.delete([...KEYS.items, id]);
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
  
  if (!result.value) return null;
  
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
