// POST /admin/import — bulk-import inventory items from a JSON file upload.
// Protected by routes/admin/_middleware.ts (admin-only).
//
// Expects multipart/form-data with:
//   csrf_token  — CSRF token string
//   file        — a .json file whose content is an array of item objects
//
// Returns JSON: { imported: number; errors: { row: number; name?: string; error: string }[] }
import type { Handlers } from "$fresh/server.ts";
import { createItem } from "../../db/kv.ts";
import type { InventoryItem, ItemCategory, ItemLocation, ItemSpace } from "../../types/inventory.ts";
import type { Session } from "../../lib/auth.ts";

// ===== CONSTANTS =====

const VALID_CATEGORIES = new Set<ItemCategory>(["tent", "cooking", "food", "camping-tools", "games"]);
const VALID_SPACES = new Set<ItemSpace>(["camp-store", "scout-post-loft"]);

// Required extra fields per category (beyond the base fields)
const CATEGORY_REQUIRED: Record<ItemCategory, string[]> = {
  tent:            ["tentType", "capacity", "size", "condition"],
  cooking:         ["equipmentType", "condition"],
  food:            ["foodType", "expiryDate"],
  "camping-tools": ["toolType", "condition"],
  games:           ["gameType", "condition"],
};

// ===== VALIDATION =====

interface RawItem {
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
}

interface ValidationResult {
  ok: true;
  item: InventoryItem;
}
interface ValidationError {
  ok: false;
  error: string;
}

function validateItem(raw: RawItem, index: number): ValidationResult | ValidationError {
  const err = (msg: string): ValidationError => ({ ok: false, error: msg });

  // Base required fields
  if (!raw.name || typeof raw.name !== "string" || !raw.name.trim()) {
    return err(`Row ${index + 1}: "name" is required`);
  }
  if (!VALID_CATEGORIES.has(raw.category)) {
    return err(`Row ${index + 1} ("${raw.name}"): invalid category "${raw.category}" — must be one of ${[...VALID_CATEGORIES].join(", ")}`);
  }
  if (typeof raw.quantity !== "number" || !Number.isInteger(raw.quantity) || raw.quantity < 0) {
    return err(`Row ${index + 1} ("${raw.name}"): "quantity" must be a non-negative integer`);
  }
  if (!raw.location || typeof raw.location !== "string") {
    return err(`Row ${index + 1} ("${raw.name}"): "location" is required`);
  }
  if (raw.space !== undefined && !VALID_SPACES.has(raw.space)) {
    return err(`Row ${index + 1} ("${raw.name}"): invalid space "${raw.space}" — must be camp-store or scout-post-loft`);
  }

  const category = raw.category as ItemCategory;

  // Category-specific required fields
  for (const field of CATEGORY_REQUIRED[category]) {
    if (raw[field] === undefined || raw[field] === null || raw[field] === "") {
      return err(`Row ${index + 1} ("${raw.name}"): "${field}" is required for category "${category}"`);
    }
  }

  // Build the item — dates are set server-side; id is generated here
  const base = {
    id:           crypto.randomUUID(),
    name:         raw.name.trim(),
    category,
    space:        (raw.space as ItemSpace) ?? "camp-store",
    quantity:     raw.quantity,
    minThreshold: typeof raw.minThreshold === "number" ? raw.minThreshold : 1,
    location:     raw.location as ItemLocation,
    notes:        raw.notes ?? undefined,
    addedDate:    new Date(),
    lastUpdated:  new Date(),
  };

  if (category === "tent") {
    return { ok: true, item: { ...base, category: "tent", tentType: raw.tentType, capacity: raw.capacity, size: raw.size, condition: raw.condition, brand: raw.brand, yearPurchased: raw.yearPurchased } };
  }
  if (category === "cooking") {
    return { ok: true, item: { ...base, category: "cooking", equipmentType: raw.equipmentType, condition: raw.condition, material: raw.material, fuelType: raw.fuelType, capacity: raw.capacity } };
  }
  if (category === "food") {
    const expiryDate = new Date(raw.expiryDate);
    if (isNaN(expiryDate.getTime())) {
      return err(`Row ${index + 1} ("${raw.name}"): "expiryDate" must be a valid ISO date string (YYYY-MM-DD)`);
    }
    return { ok: true, item: { ...base, category: "food", foodType: raw.foodType, expiryDate, storageRequirements: raw.storageRequirements, allergens: raw.allergens, weight: raw.weight, servings: raw.servings } };
  }
  if (category === "camping-tools") {
    return { ok: true, item: { ...base, category: "camping-tools", toolType: raw.toolType, condition: raw.condition, material: raw.material, brand: raw.brand, yearPurchased: raw.yearPurchased } };
  }
  // games
  return { ok: true, item: { ...base, category: "games", gameType: raw.gameType, condition: raw.condition, playerCount: raw.playerCount, ageRange: raw.ageRange, brand: raw.brand, yearPurchased: raw.yearPurchased } };
}

// ===== HANDLER =====

export const handler: Handlers = {
  async POST(req, ctx) {
    const session = ctx.state.session as Session;

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return Response.json({ error: "Invalid form data" }, { status: 400 });
    }

    // CSRF check
    const csrfToken = form.get("csrf_token") as string | null;
    if (!csrfToken || csrfToken !== session.csrfToken) {
      return Response.json({ error: "Invalid CSRF token" }, { status: 403 });
    }

    // File field
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return Response.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (!file.name.endsWith(".json")) {
      return Response.json({ error: "File must be a .json file" }, { status: 400 });
    }

    // Parse JSON
    let rows: RawItem[];
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        return Response.json({ error: "JSON must be an array of item objects" }, { status: 400 });
      }
      rows = parsed;
    } catch {
      return Response.json({ error: "Could not parse JSON — check the file is valid JSON" }, { status: 400 });
    }

    if (rows.length === 0) {
      return Response.json({ error: "File contains no items" }, { status: 400 });
    }
    if (rows.length > 500) {
      return Response.json({ error: "Maximum 500 items per import" }, { status: 400 });
    }

    // Validate all rows first so we can report all errors before writing anything
    const validItems: InventoryItem[] = [];
    const errors: { row: number; name?: string; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const result = validateItem(rows[i], i);
      if (result.ok) {
        validItems.push(result.item);
      } else {
        errors.push({ row: i + 1, name: rows[i]?.name, error: result.error });
      }
    }

    // If there are any validation errors, reject the entire import without writing
    if (errors.length > 0) {
      return Response.json(
        { error: "Import rejected due to validation errors — no items were saved", errors },
        { status: 422 },
      );
    }

    // Write all valid items, collecting any write-time failures
    const writeErrors: { row: number; name?: string; error: string }[] = [];
    let imported = 0;

    // Write in parallel, but cap concurrency at 20 to avoid flooding KV
    const CONCURRENCY = 20;
    for (let i = 0; i < validItems.length; i += CONCURRENCY) {
      const batch = validItems.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(batch.map((item) => createItem(item)));
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === "fulfilled") {
          imported++;
        } else {
          const item = batch[j];
          writeErrors.push({ row: i + j + 1, name: item.name, error: "Failed to save item to database" });
        }
      }
    }

    return Response.json(
      { imported, errors: writeErrors },
      { status: writeErrors.length > 0 ? 207 : 201 },
    );
  },
};
