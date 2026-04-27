/**
 * Migration shim for the old single-photo endpoint.
 *
 * GET  — serves the legacy photo (keyed by item id) for items that had
 *        `hasPhoto: true` before the multi-photo migration.
 * PUT  — redirects to POST /api/items/:id/photos so old clients still work.
 * DELETE — removes the legacy photo key.
 */
import { Handlers } from "$fresh/server.ts";
import { deleteItemPhoto, getItemPhoto } from "../../../../db/kv.ts";
import {
  getPhotoObject,
  isLegacyPhotoRecord,
} from "../../../../lib/r2Photos.ts";
import {
  csrfFailed,
  csrfOk,
  forbidden,
  type Session,
} from "../../../../lib/auth.ts";

export const handler: Handlers = {
  async GET(_req, ctx) {
    const { id } = ctx.params;
    const photo = await getItemPhoto(id);
    if (!photo) {
      return new Response("Not found", { status: 404 });
    }

    if (isLegacyPhotoRecord(photo)) {
      return new Response(photo.data.buffer.slice(0) as ArrayBuffer, {
        headers: {
          "Content-Type": photo.contentType,
          "Cache-Control": "public, max-age=3600",
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
        "Cache-Control": "public, max-age=3600",
      },
    });
  },

  async PUT(req, ctx) {
    // Forward to the new multi-photo endpoint
    const { id } = ctx.params;
    const url = new URL(req.url);
    const newUrl = `${url.origin}/api/items/${id}/photos`;
    return Response.redirect(newUrl, 307);
  },

  async DELETE(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") return forbidden();
    if (!csrfOk(req, session)) return csrfFailed();

    const { id } = ctx.params;
    await deleteItemPhoto(id);
    return Response.json({ ok: true });
  },
};
