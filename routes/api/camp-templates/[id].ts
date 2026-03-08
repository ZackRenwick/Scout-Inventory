// DELETE /api/camp-templates/[id] — remove a template (admin only)
import type { Session } from "../../../lib/auth.ts";
import { csrfFailed, csrfOk, forbidden } from "../../../lib/auth.ts";
import { deleteCampTemplate } from "../../../db/kv.ts";

export const handler = {
  async DELETE(ctx) {
    const req = ctx.req;
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role !== "admin") {
      return forbidden();
    }
    if (!csrfOk(req, session)) {
      return csrfFailed();
    }

    const { id } = ctx.params;
    const ok = await deleteCampTemplate(id);
    if (!ok) {
      return Response.json({ error: "Template not found" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  },
};
