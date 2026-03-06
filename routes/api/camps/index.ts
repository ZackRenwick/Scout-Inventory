// API route for camp plans list
import type { CampPlan } from "../../../types/inventory.ts";
import { createCampPlan, getAllCampPlans } from "../../../db/kv.ts";
import {
  csrfFailed,
  csrfOk,
  forbidden,
  type Session,
} from "../../../lib/auth.ts";

export const handler = {
  // GET /api/camps - list all camp plans
  async GET(_ctx) {
    try {
      const plans = await getAllCampPlans();
      return Response.json(plans);
    } catch (_error) {
      return Response.json({ error: "Failed to fetch camp plans" }, {
        status: 500,
      });
    }
  },

  // POST /api/camps - create a new camp plan
  async POST(ctx) {
    const req = ctx.req;
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") {
      return forbidden();
    }
    if (!csrfOk(req, session)) {
      return csrfFailed();
    }

    try {
      const body = await req.json();

      if (!body.name || !body.campDate) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: name, campDate" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const newPlan: CampPlan = {
        id: crypto.randomUUID(),
        name: body.name,
        campDate: new Date(body.campDate),
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        location: body.location ?? "",
        notes: body.notes ?? "",
        items: [],
        status: "planning",
        createdBy: session.username,
        createdAt: new Date(),
        lastUpdated: new Date(),
      };

      const created = await createCampPlan(newPlan);
      return Response.json(created, { status: 201 });
    } catch (_error) {
      return Response.json({ error: "Failed to create camp plan" }, {
        status: 500,
      });
    }
  },
};
