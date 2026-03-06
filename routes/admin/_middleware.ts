// Middleware for all routes under /admin — enforces admin role
import { type Context } from "fresh";
import type { Session } from "../../lib/auth.ts";

export async function handler(ctx: Context) {
  const session = ctx.state.session as Session | undefined;
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    return new Response(null, { status: 302, headers: { location: "/" } });
  }
  return ctx.next();
}
