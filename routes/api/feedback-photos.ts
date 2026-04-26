// POST /api/feedback-photos — upload a feedback bug report photo to R2
import { Handlers } from "$fresh/server.ts";
import { uploadPhotoObject } from "../../lib/r2Photos.ts";
import type { Session } from "../../lib/auth.ts";
import { forbidden } from "../../lib/auth.ts";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB hard safety cap
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const handler: Handlers = {
  async POST(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session) return forbidden();

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
        { error: "Image exceeds 10 MB limit — please upload a smaller image" },
        { status: 413 },
      );
    }

    try {
      const photoId = crypto.randomUUID();
      await uploadPhotoObject(photoId, bytes, file.type);
      
      return Response.json({ ok: true, photoId }, { status: 201 });
    } catch (err) {
      console.error("Failed to upload feedback photo:", err);
      return Response.json(
        { error: "Failed to upload photo" },
        { status: 500 },
      );
    }
  },
};
