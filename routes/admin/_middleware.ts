// Middleware for all routes under /admin — enforces admin role
import { FreshContext } from "$fresh/server.ts";
import type { Session } from "../../lib/auth.ts";

export async function handler(_req: Request, ctx: FreshContext) {
  const session = ctx.state.session as Session | undefined;
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    return new Response(null, { status: 302, headers: { location: "/" } });
  }
  return ctx.next();
}
