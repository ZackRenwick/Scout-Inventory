// POST /admin/clear-db — clears a specific data category.
// Body: { category: "inventory" | "loans" | "camps" | "meals" | "activityLog" }
// Auth data (users/sessions) is never touched. Admin-only. CSRF-protected.
import { clearCamps, clearInventoryData, clearLoans, clearMeals } from "../../db/kv.ts";
import {
  csrfFailed,
  csrfOk,
  forbidden,
  type Session,
} from "../../lib/auth.ts";
import { clearActivityLog } from "../../lib/activityLog.ts";
import type { Handlers } from "$fresh/server.ts";

type Category = "inventory" | "loans" | "camps" | "meals" | "activityLog";

export const handler: Handlers = {
  async POST(req, ctx) {
    const session = ctx.state.session as Session;
    if (session.role !== "admin") return forbidden();
    if (!csrfOk(req, session)) return csrfFailed();

    let body: { category?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    const category = body.category as Category | undefined;
    const valid: Category[] = ["inventory", "loans", "camps", "meals", "activityLog"];
    if (!category || !valid.includes(category)) {
      return Response.json({ error: "Invalid category." }, { status: 400 });
    }

    try {
      let deleted = 0;
      let extra = 0; // secondary count (e.g. indexes)

      if (category === "inventory") {
        const report = await clearInventoryData();
        deleted = report.items;
        extra = report.indexes;
      } else if (category === "loans") {
        deleted = await clearLoans();
      } else if (category === "camps") {
        deleted = await clearCamps();
      } else if (category === "meals") {
        deleted = await clearMeals();
      } else if (category === "activityLog") {
        deleted = await clearActivityLog();
      }

      return Response.json({ ok: true, category, deleted, extra });
    } catch (err) {
      console.error("[admin/clear-db] failed:", err);
      return Response.json({ error: "Clear failed." }, { status: 500 });
    }
  },
};
