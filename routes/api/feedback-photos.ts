// POST /api/feedback-photos — upload a feedback bug report photo to R2
import { Handlers } from "$fresh/server.ts";
import { uploadFeedbackPhotoObject } from "../../lib/r2Photos.ts";
import type { Session } from "../../lib/auth.ts";
import { forbidden } from "../../lib/auth.ts";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB hard safety cap
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function methodNotAllowed(method: string): Response {
  console.warn(`Method not allowed on /api/feedback-photos: ${method}`);
  return Response.json(
    { error: "Method not allowed" },
    {
      status: 405,
      headers: { "Allow": "POST, PUT, OPTIONS" },
    },
  );
}

async function handleUpload(
  req: Request,
  ctx: { state: { session?: Session } },
): Promise<Response> {
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
    await uploadFeedbackPhotoObject(photoId, bytes, file.type);

    return Response.json({ ok: true, photoId }, { status: 201 });
  } catch (err) {
    console.error("Failed to upload feedback photo:", err);
    return Response.json(
      { error: "Failed to upload photo" },
      { status: 500 },
    );
  }
}

export const handler: Handlers = {
  async POST(req, ctx) {
    return handleUpload(req, ctx);
  },
  async PUT(req, ctx) {
    // Accept PUT as a compatibility fallback for stale clients.
    return handleUpload(req, ctx);
  },
  GET(req) {
    return methodNotAllowed(req.method);
  },
  PATCH(req) {
    return methodNotAllowed(req.method);
  },
  DELETE(req) {
    return methodNotAllowed(req.method);
  },
  OPTIONS() {
    return new Response(null, {
      status: 204,
      headers: { "Allow": "POST, PUT, OPTIONS" },
    });
  },
};
