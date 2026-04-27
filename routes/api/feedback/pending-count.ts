import { Handlers } from "$fresh/server.ts";
import { getAllFeedbackRequests } from "../../../db/kv.ts";
import type { Session } from "../../../lib/auth.ts";
import { forbidden } from "../../../lib/auth.ts";

export const handler: Handlers = {
  async GET(_req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role !== "admin") {
      return forbidden();
    }

    const requests = await getAllFeedbackRequests();
    const pendingCount =
      requests.filter((request) => request.status === "pending").length;

    return Response.json({ pendingCount }, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  },
};
