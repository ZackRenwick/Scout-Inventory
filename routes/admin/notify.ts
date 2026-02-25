// POST /admin/notify — manually trigger notification emails
import type { Handlers } from "$fresh/server.ts";
import type { Session } from "../../lib/auth.ts";
import { csrfOk, csrfFailed } from "../../lib/auth.ts";
import { checkAndNotifyLowStock, checkAndNotifyExpiry, checkAndNotifyOverdueLoans } from "../../lib/notifications.ts";

export const handler: Handlers = {
  async POST(req, ctx) {
    const session = ctx.state.session as Session;
    if (!csrfOk(req, session)) {
      return csrfFailed();
    }

    const url = new URL(req.url);
    const type = url.searchParams.get("type");

    try {
      if (type === "low-stock") {
        await checkAndNotifyLowStock();
        return Response.json({ ok: true, message: "Low stock check complete — email sent if any items are below threshold." });
      }
      if (type === "expiry") {
        await checkAndNotifyExpiry();
        return Response.json({ ok: true, message: "Expiry check complete — email sent if any items expire within 30 days." });
      }
      if (type === "overdue-loans") {
        await checkAndNotifyOverdueLoans();
        return Response.json({ ok: true, message: "Overdue loans check complete — email sent if any loans are overdue." });
      }
      // No type — run all three
      await checkAndNotifyLowStock();
      await checkAndNotifyExpiry();
      await checkAndNotifyOverdueLoans();
      return Response.json({ ok: true, message: "All checks complete — emails sent where thresholds are met." });
    } catch (err) {
      console.error("[admin/notify] Error:", err);
      return Response.json({ ok: false, message: "An error occurred running the checks. See server logs." }, { status: 500 });
    }
  },
};
