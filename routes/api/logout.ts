// POST /api/logout — destroys the session cookie
import { Handlers } from "$fresh/server.ts";
import { getSessionCookie, deleteSession, clearSessionCookie } from "../../lib/auth.ts";

export const handler: Handlers = {
  async POST(req) {
    const sessionId = getSessionCookie(req);
    if (sessionId) await deleteSession(sessionId);
    return new Response(null, {
      status: 302,
      headers: {
        location: "/login",
        "set-cookie": clearSessionCookie(),
      },
    });
  },
};
