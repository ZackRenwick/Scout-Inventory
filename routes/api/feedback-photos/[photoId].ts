import { Handlers } from "$fresh/server.ts";
import {
  buildFeedbackPhotoObjectKey,
  buildPhotoObjectKey,
  getPhotoObject,
} from "../../../lib/r2Photos.ts";
import type { Session } from "../../../lib/auth.ts";
import { forbidden } from "../../../lib/auth.ts";

export const handler: Handlers = {
  async GET(_req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session) return forbidden();

    const photoId = String(ctx.params.photoId ?? "").trim();
    if (!photoId) {
      return Response.json({ error: "Missing photo id" }, { status: 400 });
    }

    // Primary location for feedback photos.
    let object = await getPhotoObject(buildFeedbackPhotoObjectKey(photoId));

    // Backward-compat fallback for early uploads that were accidentally written
    // to the inventory photo prefix.
    if (!object) {
      object = await getPhotoObject(buildPhotoObjectKey(photoId));
    }

    if (!object) {
      return Response.json({ error: "Photo not found" }, { status: 404 });
    }

    const body = Uint8Array.from(object.data).buffer;

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": object.contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  },
};
