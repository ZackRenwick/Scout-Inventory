// Meal planner types

/** One ingredient line within a meal recipe. */
export interface MealIngredient {
  /**
   * ID of a specific inventory item batch. Use this when you intentionally
   * want to consume one particular batch (e.g. the batch expiring soonest).
   * Leave unset to match by name instead.
   */
  inventoryItemId?: string;
  /**
   * Canonical ingredient name used for name-based inventory matching.
   * When set (without inventoryItemId), stock is summed across ALL inventory
   * items that share this name — e.g. all "Passata" batches with different
   * expiry dates are treated as one pool.
   */
  inventoryItemName?: string;
  /** Ingredient display name. Auto-filled from inventory when linked, otherwise entered manually. */
  name: string;
  /** How many people one unit of this item feeds for this recipe. */
  servingsPerUnit: number;
}

/** A named meal recipe made up of inventory-backed ingredients. */
export interface Meal {
  id: string;
  name: string;
  description?: string;
  ingredients: MealIngredient[];
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

/** Shape expected by POST /api/meals and PUT /api/meals/:id request bodies. */
export interface MealPayload {
  name: string;
  description?: string;
  ingredients: MealIngredient[];
}

/** Lightweight food item summary passed to client-side islands. */
export interface FoodItemSummary {
  id: string;
  name: string;
  quantity: number;
  /** ISO date string — present only for food items that have an expiry date set. */
  expiryDate?: string;
}
