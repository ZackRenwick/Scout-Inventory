// Base inventory item interface
export type ItemCategory = "tent" | "cooking" | "food" | "camping-tools" | "games" | "first-aid";

export type ItemSpace = "camp-store" | "scout-post-loft";

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
  | "N/A";

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
    options: ["Axe/Saw Hanging Space", "On Top of Red Box", "On Top of Green Box", "Cubby Hole", "N/A"],
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
}

// Tent-specific properties
export interface TentItem extends BaseInventoryItem {
  category: "tent";
  tentType: "dome" | "tunnel" | "patrol" | "ridge" | "bell" | "other";
  capacity: number; // Number of people
  size: string; // e.g., "4-person", "8-person"
  condition: "excellent" | "good" | "fair" | "needs-repair";
  brand?: string;
  yearPurchased?: number;
}

// Cooking equipment properties
export interface CookingEquipment extends BaseInventoryItem {
  category: "cooking";
  equipmentType: "stove" | "pots" | "pans" | "utensils" | "cooler" | "water-container" | "other";
  material?: string;
  fuelType?: string; // For stoves
  capacity?: string; // For pots, coolers, etc.
  condition: "excellent" | "good" | "fair" | "needs-repair";
}

// Food item properties with expiry tracking
export interface FoodItem extends BaseInventoryItem {
  category: "food";
  foodType: "canned" | "dried" | "packaged" | "fresh" | "frozen";
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

// Games equipment properties
export interface GamesItem extends BaseInventoryItem {
  category: "games";
  gameType: "board-game" | "card-game" | "outdoor-game" | "sports" | "puzzle" | "other";
  condition: "excellent" | "good" | "fair" | "needs-repair";
  playerCount?: string;
  ageRange?: string;
  brand?: string;
  yearPurchased?: number;
}

// First aid item properties
export interface FirstAidItem extends BaseInventoryItem {
  category: "first-aid";
  itemType: "bandages" | "medication" | "equipment" | "kit" | "other";
  expiryDate?: Date;
}

// Union type for all inventory items
export type InventoryItem = TentItem | CookingEquipment | FoodItem | CampingToolItem | GamesItem | FirstAidItem;

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

export function isCampingToolItem(item: InventoryItem): item is CampingToolItem {
  return item.category === "camping-tools";
}

export function isGamesItem(item: InventoryItem): item is GamesItem {
  return item.category === "games";
}

export function isFirstAidItem(item: InventoryItem): item is FirstAidItem {
  return item.category === "first-aid";
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
