// POST /api/loans — create a new loan record
import { Handlers } from "$fresh/server.ts";
import { createCheckOut, getItemById } from "../../../db/kv.ts";
import { type Session, csrfOk, forbidden, csrfFailed } from "../../../lib/auth.ts";
import type { CheckOut } from "../../../types/inventory.ts";
import { logActivity } from "../../../lib/activityLog.ts";

export const handler: Handlers = {
  async POST(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") return forbidden();
    if (!csrfOk(req, session)) return csrfFailed();

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { itemId, borrower, quantity, expectedReturnDate, notes } = body as Record<string, unknown>;

    if (
      typeof itemId !== "string" ||
      typeof borrower !== "string" ||
      !borrower.trim() ||
      !quantity ||
      typeof expectedReturnDate !== "string" ||
      !expectedReturnDate
    ) {
      return Response.json(
        { error: "itemId, borrower, quantity, and expectedReturnDate are required." },
        { status: 400 },
      );
    }

    const item = await getItemById(itemId);
    if (!item) {
      return Response.json({ error: "Item not found." }, { status: 404 });
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > item.quantity) {
      return Response.json(
        { error: `Quantity must be between 1 and ${item.quantity}.` },
        { status: 400 },
      );
    }

    // Enforce length limits to prevent oversized KV records
    const borrowerStr = (borrower as string).trim();
    if (borrowerStr.length > 100) {
      return Response.json(
        { error: "Borrower name must be 100 characters or fewer." },
        { status: 400 },
      );
    }
    if (notes !== undefined && notes !== null) {
      if (typeof notes !== "string" || (notes as string).length > 500) {
        return Response.json(
          { error: "Notes must be 500 characters or fewer." },
          { status: 400 },
        );
      }
    }

    // Reject food items — they are consumable and shouldn't be loaned
    if (item.category === "food") {
      return Response.json(
        { error: "Food items cannot be loaned." },
        { status: 400 },
      );
    }

    const returnDate = new Date(expectedReturnDate);
    if (isNaN(returnDate.getTime()) || returnDate <= new Date()) {
      return Response.json(
        { error: "expectedReturnDate must be a valid date in the future." },
        { status: 400 },
      );
    }

    try {
      const checkout: CheckOut = {
        id: crypto.randomUUID(),
        itemId,
        itemName: item.name,
        borrower: borrowerStr,
        quantity: qty,
        checkOutDate: new Date(),
        expectedReturnDate: returnDate,
        status: "checked-out",
        notes: typeof notes === "string" && notes.trim() ? notes.trim() : undefined,
      };

      await createCheckOut(checkout);

      await logActivity({
        username: session.username,
        action: "loan.created",
        resource: item.name,
        resourceId: checkout.id,
        details: `Loaned ${qty}× "${item.name}" to ${checkout.borrower}, due ${expectedReturnDate}`,
      });

      return Response.json(checkout, { status: 201 });
    } catch (e) {
      console.error("Failed to create loan:", e);
      return Response.json({ error: "Failed to create loan." }, { status: 500 });
    }
  },
};
