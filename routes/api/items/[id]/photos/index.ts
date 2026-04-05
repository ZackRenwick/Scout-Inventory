// POST  /api/items/:id/photos  — upload a new photo
// PATCH /api/items/:id/photos  — reorder photos
import { Handlers } from "$fresh/server.ts";
import {
  addItemPhoto,
  getItemById,
  reorderItemPhotos,
} from "../../../../../db/kv.ts";
import {
  csrfFailed,
  csrfOk,
  forbidden,
  type Session,
} from "../../../../../lib/auth.ts";

const MAX_PHOTO_BYTES = 60 * 1024; // 60 KB — fits within Deno KV 64 KB value limit
const MAX_PHOTOS_PER_ITEM = 5;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const handler: Handlers = {
  // POST /api/items/:id/photos — upload one new photo
  async POST(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") return forbidden();
    if (!csrfOk(req, session)) return csrfFailed();

    const { id } = ctx.params;
    const item = await getItemById(id);
    if (!item) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    if ((item.photoIds ?? []).length >= MAX_PHOTOS_PER_ITEM) {
      return Response.json(
        { error: `Maximum of ${MAX_PHOTOS_PER_ITEM} photos per item` },
        { status: 422 },
      );
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return Response.json({ error: "Invalid form data" }, { status: 400 });
    }

    const file = formData.get("photo");
    if (!(file instanceof File)) {
      return Response.json({ error: "No photo field in request" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return Response.json(
        { error: "Only JPEG, PNG, or WebP images are allowed" },
        { status: 415 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > MAX_PHOTO_BYTES) {
      return Response.json(
        { error: "Image exceeds 60 KB limit — please resize before uploading" },
        { status: 413 },
      );
    }

    const photoId = await addItemPhoto(id, bytes, file.type, item);
    return Response.json({ ok: true, photoId }, { status: 201 });
  },

  // PATCH /api/items/:id/photos — reorder; body: { photoIds: string[] }
  async PATCH(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") return forbidden();
    if (!csrfOk(req, session)) return csrfFailed();

    const { id } = ctx.params;
    let body: { photoIds?: unknown };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (
      !Array.isArray(body.photoIds) ||
      body.photoIds.some((p) => typeof p !== "string")
    ) {
      return Response.json({ error: "photoIds must be a string array" }, { status: 400 });
    }

    await reorderItemPhotos(id, body.photoIds as string[]);
    return Response.json({ ok: true });
  },
};
