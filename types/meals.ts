// Meal planner types

/** One ingredient line within a meal recipe. */
export interface MealIngredient {
  /** ID of the linked food inventory item, if tracked in inventory. Omit for free-form ingredients. */
  inventoryItemId?: string;
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
}
