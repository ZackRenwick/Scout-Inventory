// Meal planner types

/** One ingredient line within a meal recipe. */
export interface MealIngredient {
  /** Freeform ingredient name as written in the recipe (e.g. "Passata"). */
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
