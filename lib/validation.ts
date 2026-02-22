// Validation helpers for inventory items
// Used by both the item API routes and the bulk import handler.

import type { ItemCategory, ItemSpace } from "../types/inventory.ts";

const VALID_CATEGORIES = new Set<ItemCategory>(["tent", "cooking", "food", "camping-tools", "games"]);
const VALID_SPACES = new Set<ItemSpace>(["camp-store", "scout-post-loft"]);
const VALID_FOOD_TYPES = new Set(["canned", "jarred", "dried", "packaged", "fresh", "frozen"]);

export function validateQuantity(quantity: number): string | null {
  if (quantity < 0) {
    return "Quantity cannot be negative";
  }
  if (!Number.isInteger(quantity)) {
    return "Quantity must be a whole number";
  }
  return null;
}

export function validateExpiryDate(expiryDate: Date): string | null {
  if (!(expiryDate instanceof Date) || isNaN(expiryDate.getTime())) {
    return "Invalid date format";
  }
  return null;
}

export function validateRequiredField(value: string | undefined, fieldName: string): string | null {
  if (!value || value.trim() === "") {
    return `${fieldName} is required`;
  }
  return null;
}

export function validateMinThreshold(threshold: number, quantity: number): string | null {
  if (threshold < 0) {
    return "Minimum threshold cannot be negative";
  }
  if (threshold > quantity) {
    return "Minimum threshold should not exceed current quantity";
  }
  return null;
}

/**
 * Validates fields shared by all item categories.
 * Returns the first error string found, or null if valid.
 */
// deno-lint-ignore no-explicit-any
export function validateItemBase(body: Record<string, any>): string | null {
  const nameErr = validateRequiredField(body.name, "name");
  if (nameErr) {
    return nameErr;
  }
  if (!VALID_CATEGORIES.has(body.category)) {
    return `Invalid category "${body.category}" — must be one of: ${[...VALID_CATEGORIES].join(", ")}`;
  }
  if (typeof body.quantity !== "number") {
    return "quantity must be a number";
  }
  const qtyErr = validateQuantity(body.quantity);
  if (qtyErr) {
    return qtyErr;
  }
  const locationErr = validateRequiredField(body.location, "location");
  if (locationErr) {
    return locationErr;
  }
  if (body.space !== undefined && !VALID_SPACES.has(body.space)) {
    return `Invalid space "${body.space}" — must be camp-store or scout-post-loft`;
  }
  if (typeof body.minThreshold === "number") {
    const threshErr = validateMinThreshold(body.minThreshold, body.quantity);
    if (threshErr) {
      return threshErr;
    }
  }
  return null;
}

/**
 * Validates food-specific fields.
 * Returns the first error string found, or null if valid.
 */
// deno-lint-ignore no-explicit-any
export function validateFoodItem(body: Record<string, any>): string | null {
  if (!VALID_FOOD_TYPES.has(body.foodType)) {
    return `Invalid foodType "${body.foodType}" — must be one of: ${[...VALID_FOOD_TYPES].join(", ")}`;
  }
  if (!body.expiryDate) {
    return "expiryDate is required for food items";
  }
  const expiry = new Date(body.expiryDate);
  return validateExpiryDate(expiry);
}
