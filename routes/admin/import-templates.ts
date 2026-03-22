// POST /admin/import-templates — bulk-import camp templates from a JSON file upload.
// Protected by routes/admin/_middleware.ts (admin-only).
//
// Expects multipart/form-data with:
//   csrf_token  — CSRF token string
//   file        — a .json file whose content is an array of template objects
//
// Returns JSON: { imported: number; errors: { row: number; name?: string; error: string }[] }
import type { Handlers } from "$fresh/server.ts";
import { createCampTemplate } from "../../db/kv.ts";
import type { Session } from "../../lib/auth.ts";
import { logActivity } from "../../lib/activityLog.ts";
import type { CampTemplateItem } from "../../types/inventory.ts";
import type { ItemCategory } from "../../types/inventory.ts";

const VALID_CATEGORIES = new Set<ItemCategory>(["tent", "cooking", "food", "camping-tools", "games", "kit"]);

interface RawTemplate {
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
}

interface ValidationResult {
  ok: true;
  name: string;
  description?: string;
  items: CampTemplateItem[];
}

interface ValidationError {
  ok: false;
  error: string;
}

function validateTemplate(raw: RawTemplate, index: number): ValidationResult | ValidationError {
  const err = (msg: string): ValidationError => ({ ok: false, error: msg });

  if (!raw.name || typeof raw.name !== "string" || !raw.name.trim()) {
    return err(`Row ${index + 1}: "name" is required`);
  }

  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    return err(`Row ${index + 1} ("${raw.name}"): "items" must be a non-empty array`);
  }

  const items: CampTemplateItem[] = [];
  for (let i = 0; i < raw.items.length; i++) {
    const item = raw.items[i];
    if (typeof item !== "object" || item === null) {
      return err(`Row ${index + 1} ("${raw.name}"): items[${i}] must be an object`);
    }
    if (!item.itemId || typeof item.itemId !== "string") {
      return err(`Row ${index + 1} ("${raw.name}"): items[${i}].itemId is required`);
    }
    if (!item.itemName || typeof item.itemName !== "string") {
      return err(`Row ${index + 1} ("${raw.name}"): items[${i}].itemName is required`);
    }
    if (!item.itemCategory || typeof item.itemCategory !== "string") {
      return err(`Row ${index + 1} ("${raw.name}"): items[${i}].itemCategory is required`);
    }
    if (!VALID_CATEGORIES.has(item.itemCategory as ItemCategory)) {
      return err(`Row ${index + 1} ("${raw.name}"): items[${i}].itemCategory is invalid`);
    }
    if (!item.itemLocation || typeof item.itemLocation !== "string") {
      return err(`Row ${index + 1} ("${raw.name}"): items[${i}].itemLocation is required`);
    }
    if (typeof item.quantityPlanned !== "number" || !Number.isInteger(item.quantityPlanned) || item.quantityPlanned <= 0) {
      return err(`Row ${index + 1} ("${raw.name}"): items[${i}].quantityPlanned must be a positive integer`);
    }

    items.push({
      itemId: item.itemId,
      itemName: item.itemName,
      itemCategory: item.itemCategory as ItemCategory,
      itemLocation: item.itemLocation,
      quantityPlanned: item.quantityPlanned,
      notes: typeof item.notes === "string" ? item.notes : undefined,
    });
  }

  return {
    ok: true,
    name: raw.name.trim(),
    description: typeof raw.description === "string" ? raw.description : undefined,
    items,
  };
}

export const handler: Handlers = {
  async POST(req, ctx) {
    const session = ctx.state.session as Session;

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return Response.json({ error: "Invalid form data" }, { status: 400 });
    }

    const csrfToken = form.get("csrf_token") as string | null;
    if (!csrfToken || csrfToken !== session.csrfToken) {
      return Response.json({ error: "Invalid CSRF token" }, { status: 403 });
    }
    if (session.role !== "admin") {
      return Response.json({ error: "Admin only" }, { status: 403 });
    }

    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return Response.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (!file.name.endsWith(".json")) {
      return Response.json({ error: "File must be a .json file" }, { status: 400 });
    }

    const MAX_BYTES = 1 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "File too large. Maximum upload size is 1 MB." }, { status: 413 });
    }

    let rows: RawTemplate[];
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        return Response.json({ error: "JSON must be an array of template objects" }, { status: 400 });
      }
      rows = parsed;
    } catch {
      return Response.json({ error: "Could not parse JSON — check the file is valid JSON" }, { status: 400 });
    }

    if (rows.length === 0) {
      return Response.json({ error: "File contains no templates" }, { status: 400 });
    }
    if (rows.length > 300) {
      return Response.json({ error: "Maximum 300 templates per import" }, { status: 400 });
    }

    const validTemplates: ValidationResult[] = [];
    const errors: { row: number; name?: string; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const result = validateTemplate(rows[i], i);
      if (result.ok) {
        validTemplates.push(result);
      } else {
        errors.push({ row: i + 1, name: rows[i]?.name, error: result.error });
      }
    }

    if (errors.length > 0) {
      return Response.json(
        { error: "Import rejected due to validation errors — no templates were saved", errors },
        { status: 422 },
      );
    }

    let imported = 0;
    const writeErrors: { row: number; name?: string; error: string }[] = [];
    const CONCURRENCY = 20;

    for (let i = 0; i < validTemplates.length; i += CONCURRENCY) {
      const batch = validTemplates.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((template) =>
          createCampTemplate(template.name, template.items, session.username, template.description)
        ),
      );
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === "fulfilled") {
          imported++;
        } else {
          const template = batch[j];
          writeErrors.push({ row: i + j + 1, name: template.name, error: "Failed to save template to database" });
        }
      }
    }

    if (imported > 0) {
      await logActivity({
        username: session.username,
        action: "camp_templates.imported",
        details: `${imported} template${imported !== 1 ? "s" : ""} imported`,
      });
    }

    return Response.json(
      { imported, errors: writeErrors },
      { status: writeErrors.length > 0 ? 207 : 201 },
    );
  },
};
