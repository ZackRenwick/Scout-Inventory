// GET    /api/items/:id/photos/:photoId  — serve one photo
// DELETE /api/items/:id/photos/:photoId  — remove one photo
import { Handlers } from "$fresh/server.ts";
import { getItemPhotoById, removeItemPhotoById } from "../../../../../db/kv.ts";
import {
  getPhotoObject,
  isLegacyPhotoRecord,
} from "../../../../../lib/r2Photos.ts";
import {
  csrfFailed,
  csrfOk,
  forbidden,
  type Session,
} from "../../../../../lib/auth.ts";

export const handler: Handlers = {
  async GET(req, ctx) {
    const { photoId } = ctx.params;

    // Photo UUIDs are content-addressed and never change — respond 304 immediately
    // if the client already has the current version.
    const etag = `"${photoId}"`;
    if (req.headers.get("If-None-Match") === etag) {
      return new Response(null, { status: 304 });
    }

    const photo = await getItemPhotoById(photoId);
    if (!photo) {
      return new Response("Not found", { status: 404 });
    }

    if (isLegacyPhotoRecord(photo)) {
      return new Response(photo.data.buffer.slice(0) as ArrayBuffer, {
        headers: {
          "Content-Type": photo.contentType,
          // Legacy photos should eventually be migrated; keep a short cache period.
          "Cache-Control": "public, max-age=3600",
          "ETag": etag,
        },
      });
    }

    const object = await getPhotoObject(photo.objectKey);
    if (!object) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(object.data.buffer.slice(0) as ArrayBuffer, {
      headers: {
        "Content-Type": object.contentType,
        // Immutable: UUID keys never point to different content — cache for 1 year
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": etag,
      },
    });
  },

  async DELETE(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") return forbidden();
    if (!csrfOk(req, session)) return csrfFailed();

    const { id, photoId } = ctx.params;
    await removeItemPhotoById(id, photoId);
    return Response.json({ ok: true });
  },
};
