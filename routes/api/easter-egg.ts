import type { Handlers } from "$fresh/server.ts";
import type { Session } from "../../lib/auth.ts";
import { logActivity } from "../../lib/activityLog.ts";

export const handler: Handlers = {
  async POST(_req, ctx) {
    const session = ctx.state.session as Session | undefined;
    const username = session?.username ?? "Unknown user";
    logActivity({
      username,
      action: "easter_egg.found",
      details: "Found the easter egg and got a joke!",
    });
    return Response.json({ ok: true });
  },
};
