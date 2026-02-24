// PATCH /api/loans/[id] — mark a loan as returned
// DELETE /api/loans/[id] — cancel/remove a loan record
import { Handlers } from "$fresh/server.ts";
import { getCheckOutById, returnCheckOut, deleteCheckOut } from "../../../db/kv.ts";
import { type Session, csrfOk, forbidden, csrfFailed } from "../../../lib/auth.ts";
import { logActivity } from "../../../lib/activityLog.ts";

export const handler: Handlers = {
  async PATCH(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") return forbidden();
    if (!csrfOk(req, session)) return csrfFailed();

    const { id } = ctx.params;

    try {
      const existing = await getCheckOutById(id);
      if (!existing) {
        return new Response(JSON.stringify({ error: "Loan not found." }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (existing.status === "returned") {
        return new Response(JSON.stringify({ error: "Loan has already been returned." }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }

      const updated = await returnCheckOut(id);
      if (!updated) {
        throw new Error("returnCheckOut returned null");
      }

      await logActivity({
        username: session.username,
        action: "loan.returned",
        resource: updated.itemName,
        resourceId: id,
        details: `Returned ${updated.quantity}× "${updated.itemName}" from ${updated.borrower}`,
      });

      return new Response(JSON.stringify(updated), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error("Failed to return loan:", e);
      return new Response(JSON.stringify({ error: "Failed to mark loan as returned." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  async DELETE(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") return forbidden();
    if (!csrfOk(req, session)) return csrfFailed();

    const { id } = ctx.params;

    try {
      const existing = await getCheckOutById(id);
      if (!existing) {
        return new Response(JSON.stringify({ error: "Loan not found." }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      await deleteCheckOut(id);

      await logActivity({
        username: session.username,
        action: "loan.cancelled",
        resource: existing.itemName,
        resourceId: id,
        details: `Cancelled loan of ${existing.quantity}× "${existing.itemName}" to ${existing.borrower}`,
      });

      return new Response(null, { status: 204 });
    } catch (e) {
      console.error("Failed to cancel loan:", e);
      return new Response(JSON.stringify({ error: "Failed to cancel loan." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
