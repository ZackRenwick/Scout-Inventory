// POST /api/logout — destroys the session cookie
import { Handlers } from "$fresh/server.ts";
import { getSessionCookie, getSession, deleteSession, clearSessionCookie } from "../../lib/auth.ts";
import { logActivity } from "../../lib/activityLog.ts";

export const handler: Handlers = {
  async POST(req) {
    const sessionId = getSessionCookie(req);
    if (sessionId) {
      const session = await getSession(sessionId);
      if (session) {
        await logActivity({ username: session.username, action: "user.logout" });
      }
      await deleteSession(sessionId);
    }
    return new Response(null, {
      status: 302,
      headers: {
        location: "/login",
        "set-cookie": clearSessionCookie(),
      },
    });
  },
};
