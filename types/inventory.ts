// Base inventory item interface
export type ItemCategory = "tent" | "cooking" | "food" | "camping-tools" | "games" | "kit" | "fuel" | "kilt";

export const CATEGORY_META: Record<ItemCategory, { emoji: string; label: string; searchLabel: string }> = {
  tent: { emoji: "⛺", label: "Tents", searchLabel: "tents" },
  cooking: { emoji: "🥘", label: "Cooking Equipment", searchLabel: "cooking equipment" },
  food: { emoji: "🥫", label: "Food", searchLabel: "food" },
  fuel: { emoji: "🛢️", label: "Fuel", searchLabel: "fuel gas" },
  "camping-tools": { emoji: "🧰", label: "Camping Tools", searchLabel: "camping tools" },
  games: { emoji: "⚽", label: "Games Equipment", searchLabel: "games" },
  kit: { emoji: "📦", label: "Box / Kit", searchLabel: "box kit" },
  kilt: { emoji: "🏴\uDB40\uDC67\uDB40\uDC62\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74\uDB40\uDC7F", label: "Kilts", searchLabel: "kilt highland dress sporran" },
};

export const CAMP_STORE_CATEGORIES: ItemCategory[] = ["tent", "cooking", "food", "camping-tools", "kit", "kilt"];
export const LOFT_CATEGORIES: ItemCategory[] = ["games", "kit"];
export const GAS_STORAGE_CATEGORIES: ItemCategory[] = ["fuel"];

export function getCategoryEmoji(category: string): string {
  return CATEGORY_META[category as ItemCategory]?.emoji ?? "📦";
}

export function getCategoryLabel(category: string): string {
  return CATEGORY_META[category as ItemCategory]?.label ?? category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getCategorySearchLabel(category: string): string {
  return CATEGORY_META[category as ItemCategory]?.searchLabel ?? category.replace(/-/g, " ");
}

export type ItemSpace = "camp-store" | "scout-post-loft" | "gas-storage-box";

export type ItemLocation =
  | "Plastic Shelf 1 - Level 1" | "Plastic Shelf 1 - Level 2" | "Plastic Shelf 1 - Level 3" | "Plastic Shelf 1 - Level 4"
  | "Plastic Shelf 2 - Level 1" | "Plastic Shelf 2 - Level 2" | "Plastic Shelf 2 - Level 3" | "Plastic Shelf 2 - Level 4" | "On Top of Plastic Shelf 2"
  | "Plastic Shelf 3 - Level 1" | "Plastic Shelf 3 - Level 2" | "Plastic Shelf 3 - Level 3" | "Plastic Shelf 3 - Level 4" | "On Top of Plastic Shelf 3"
  | "Wooden Shelf 1" | "Wooden Shelf 2" | "Wooden Shelf 3"
  | "Metal Shelf 1 - Slot 1" | "Metal Shelf 1 - Slot 2" | "Metal Shelf 1 - Slot 3" | "Metal Shelf 1 - Slot 4"
  | "Metal Shelf 2 - Slot 1" | "Metal Shelf 2 - Slot 2" | "Metal Shelf 2 - Slot 3" | "Metal Shelf 2 - Slot 4"
  | "Metal Shelf 3 - Slot 1" | "Metal Shelf 3 - Slot 2" | "Metal Shelf 3 - Slot 3" | "Metal Shelf 3 - Slot 4"
  | "Metal Shelf 4 - Slot 1" | "Metal Shelf 4 - Slot 2" | "Metal Shelf 4 - Slot 3" | "Metal Shelf 4 - Slot 4"
  | "Filing Cabinet - Drawer 1" | "Filing Cabinet - Drawer 2" | "Filing Cabinet - Drawer 3" | "Filing Cabinet - Drawer 4"
  | "Blue Box" | "Red Box" | "Green Box" | "Yellow Box"
  | "Kestrels Box" | "Eagles Box"
  | "Cubby Hole"
  | "Axe/Saw Hanging Space"
  | "On Top of Red Box" | "On Top of Green Box"
  | "Loft Shelf 1" | "Loft Shelf 2" | "Loft Shelf 3" | "Loft Shelf 4"
  | "Gas Storage Box";

export const ITEM_LOCATIONS: { group: string; options: ItemLocation[] }[] = [
  {
    group: "Plastic Shelves",
    options: [
      "Plastic Shelf 1 - Level 1", "Plastic Shelf 1 - Level 2", "Plastic Shelf 1 - Level 3", "Plastic Shelf 1 - Level 4",
      "Plastic Shelf 2 - Level 1", "Plastic Shelf 2 - Level 2", "Plastic Shelf 2 - Level 3", "Plastic Shelf 2 - Level 4", "On Top of Plastic Shelf 2",
      "Plastic Shelf 3 - Level 1", "Plastic Shelf 3 - Level 2", "Plastic Shelf 3 - Level 3", "Plastic Shelf 3 - Level 4", "On Top of Plastic Shelf 3",
    ],
  },
  {
    group: "Wooden Shelves",
    options: ["Wooden Shelf 1", "Wooden Shelf 2", "Wooden Shelf 3"],
  },
  {
    group: "Metal Shelves",
    options: [
      "Metal Shelf 1 - Slot 1", "Metal Shelf 1 - Slot 2", "Metal Shelf 1 - Slot 3", "Metal Shelf 1 - Slot 4",
      "Metal Shelf 2 - Slot 1", "Metal Shelf 2 - Slot 2", "Metal Shelf 2 - Slot 3", "Metal Shelf 2 - Slot 4",
      "Metal Shelf 3 - Slot 1", "Metal Shelf 3 - Slot 2", "Metal Shelf 3 - Slot 3", "Metal Shelf 3 - Slot 4",
      "Metal Shelf 4 - Slot 1", "Metal Shelf 4 - Slot 2", "Metal Shelf 4 - Slot 3", "Metal Shelf 4 - Slot 4",
    ],
  },
  {
    group: "Filing Cabinet",
    options: [
      "Filing Cabinet - Drawer 1", "Filing Cabinet - Drawer 2", "Filing Cabinet - Drawer 3", "Filing Cabinet - Drawer 4",
    ],
  },
  {
    group: "Boxes",
    options: ["Blue Box", "Red Box", "Green Box", "Yellow Box", "Kestrels Box", "Eagles Box"],
  },
  {
    group: "Other",
    options: ["Axe/Saw Hanging Space", "On Top of Red Box", "On Top of Green Box", "Cubby Hole"],
  },
];

export const LOFT_LOCATIONS: { group: string; options: ItemLocation[] }[] = [
  {
    group: "Loft Shelves",
    options: [
      "Loft Shelf 1", "Loft Shelf 2", "Loft Shelf 3", "Loft Shelf 4",
    ],
  },
];

export const GAS_STORAGE_LOCATIONS: { group: string; options: ItemLocation[] }[] = [
  {
    group: "Gas Storage",
    options: ["Gas Storage Box"],
  },
];

export interface BaseInventoryItem {
  id: string;
  name: string;
  category: ItemCategory;
  space?: ItemSpace;
  quantity: number;
  minThreshold: number;
  location: ItemLocation;
  notes?: string;
  addedDate: Date;
  lastUpdated: Date;
  /** True while the item is packed for a camp and has not yet been returned to the store */
  atCamp?: boolean;
  /** How many units of this item are currently at camp (only meaningful when atCamp is true) */
  quantityAtCamp?: number;
  /** How many units of this item currently need repair (for multi-quantity items where only some units are damaged) */
  quantityNeedsRepair?: number;
  /** Last date this item was formally inspected */
  lastInspectedDate?: Date;
  /** Next scheduled inspection date for this item */
  nextInspectionDate?: Date;
  /** Historical inspection and maintenance records */
  maintenanceHistory?: MaintenanceRecord[];
  /**
   * Ordered list of photo UUIDs for this item (first = primary).
   * Replaces the old `hasPhoto` boolean. Items with `hasPhoto: true` but no
   * `photoIds` will have their legacy photo served at the migration shim.
   */
  photoIds?: string[];
  /** @deprecated Use photoIds instead */
  hasPhoto?: boolean;
}

export interface MaintenanceRecord {
  id: string;
  date: Date;
  type: "inspection" | "repair" | "cleaning" | "replacement-part" | "other";
  notes: string;
  performedBy?: string;
  conditionAfter?: "excellent" | "good" | "fair" | "needs-repair";
}

// Tent-specific properties
export interface TentItem extends BaseInventoryItem {
  category: "tent";
  tentType: "dome" | "tunnel" | "patrol" | "ridge" | "bell" | "other";
  capacity: number; // Number of people
  size: string; // e.g., "4-person", "8-person"
  setupInstructions?: string;
  condition: "excellent" | "good" | "fair" | "needs-repair";
  brand?: string;
  yearPurchased?: number;
}

// A single named item tracked inside a box/kit
export interface BoxContentItem {
  name: string;
  quantity: number;
}

// Cooking equipment properties
export interface CookingEquipment extends BaseInventoryItem {
  category: "cooking";
  equipmentType: "stove" | "pots" | "pans" | "utensils" | "cooler" | "water-container" | "box" | "other";
  material?: string;
  fuelType?: string; // For stoves
  capacity?: string; // For pots, coolers, etc.
  condition: "excellent" | "good" | "fair" | "needs-repair";
  /** Individual items tracked inside this box/kit */
  contents?: BoxContentItem[];
}

// Fuel properties (stored in gas storage box)
export interface FuelItem extends BaseInventoryItem {
  category: "fuel";
  fuelType: string; // e.g. butane canister, methylated spirit, propane cylinder
  condition: "excellent" | "good" | "fair" | "needs-repair";
  brand?: string;
  yearPurchased?: number;
}

// Food item properties with expiry tracking
export interface FoodItem extends BaseInventoryItem {
  category: "food";
  foodType: "canned" | "jarred" | "dried" | "packaged" | "fresh" | "frozen";
  expiryDate: Date;
  storageRequirements?: "frozen" | "refrigerated" | "cool-dry" | "room-temp";
  allergens?: string[];
  weight?: string;
  servings?: number;
}

// Camping tools properties
export interface CampingToolItem extends BaseInventoryItem {
  category: "camping-tools";
  toolType: "axe" | "saw" | "knife" | "shovel" | "rope" | "hammer" | "multi-tool" | "other";
  condition: "excellent" | "good" | "fair" | "needs-repair";
  material?: string;
  brand?: string;
  yearPurchased?: number;
}

// Kit / Box properties — a self-contained collection of items stored together
export interface KitItem extends BaseInventoryItem {
  category: "kit";
  kitType: "cooking-kit" | "first-aid" | "tool-kit" | "craft-kit" | "emergency" | "general" | "other";
  condition: "excellent" | "good" | "fair" | "needs-repair";
  contents?: BoxContentItem[];
  brand?: string;
  yearPurchased?: number;
  quantityNeedsRepair?: number;
}

// Games equipment properties
export interface GamesItem extends BaseInventoryItem {
  category: "games";
  gameType: "board-game" | "card-game" | "outdoor-game" | "sports" | "puzzle" | "box" | "other";
  condition: "excellent" | "good" | "fair" | "needs-repair";
  playerCount?: string;
  yearPurchased?: number;
  /** Individual items tracked inside this box (only relevant when gameType === "box") */
  contents?: BoxContentItem[];
}

// Highland dress / kilt outfit properties
export type KiltComponent = "kilt" | "sporran" | "socks" | "flashes";

export interface KiltOutfitItem extends BaseInventoryItem {
  category: "kilt";
  condition: "excellent" | "good" | "fair" | "needs-repair";
  /** Which components are included in this outfit */
  kiltComponents: KiltComponent[];
  size?: string;
  brand?: string;
  yearPurchased?: number;
}

// Union type for all inventory items
export type InventoryItem = TentItem | CookingEquipment | FoodItem | CampingToolItem | GamesItem | KitItem | FuelItem | KiltOutfitItem;

// Helper type guards
export function isTentItem(item: InventoryItem): item is TentItem {
  return item.category === "tent";
}

export function isCookingEquipment(item: InventoryItem): item is CookingEquipment {
  return item.category === "cooking";
}

export function isFoodItem(item: InventoryItem): item is FoodItem {
  return item.category === "food";
}

export function isFuelItem(item: InventoryItem): item is FuelItem {
  return item.category === "fuel";
}

export function isCampingToolItem(item: InventoryItem): item is CampingToolItem {
  return item.category === "camping-tools";
}

export function isGamesItem(item: InventoryItem): item is GamesItem {
  return item.category === "games";
}

export function isKitItem(item: InventoryItem): item is KitItem {
  return item.category === "kit";
}

export function isKiltOutfitItem(item: InventoryItem): item is KiltOutfitItem {
  return item.category === "kilt";
}

// Expiry status for food items
export type ExpiryStatus = "expired" | "expiring-soon" | "expiring-warning" | "fresh";

export function getExpiryStatus(expiryDate: Date): ExpiryStatus {
  const now = new Date();
  const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry <= 7) return "expiring-soon";
  if (daysUntilExpiry <= 30) return "expiring-warning";
  return "fresh";
}

// Check-out tracking
export interface CheckOut {
  id: string;
  itemId: string;
  itemName: string;
  borrower: string;
  quantity: number;
  checkOutDate: Date;
  expectedReturnDate: Date;
  actualReturnDate?: Date;
  status: "checked-out" | "returned" | "overdue";
  notes?: string;
}

// Camp planning types
export interface CampPlanItem {
  itemId: string;
  itemName: string;
  itemCategory: ItemCategory;
  itemLocation: string;
  quantityPlanned: number;
  packedStatus: boolean;
  returnedStatus: boolean;
  notes?: string;
  /** Contents of the box/kit at the time it was added to the plan */
  contents?: BoxContentItem[];
}

export type CampPlanStatus = "planning" | "packing" | "active" | "returning" | "completed";

export interface CampPlan {
  id: string;
  name: string;
  campDate: Date;
  endDate?: Date;
  location?: string;
  notes?: string;
  items: CampPlanItem[];
  status: CampPlanStatus;
  createdBy: string;
  createdAt: Date;
  lastUpdated: Date;
}

// Camp equipment template — a reusable named list of items with no dates/status
export interface CampTemplateItem {
  itemId: string;
  itemName: string;
  itemCategory: ItemCategory;
  itemLocation: string;
  quantityPlanned: number;
  notes?: string;
}

export interface CampTemplate {
  id: string;
  name: string;
  description?: string;
  items: CampTemplateItem[];
  createdBy: string;
  createdAt: Date;
  lastUpdated: Date;
}
