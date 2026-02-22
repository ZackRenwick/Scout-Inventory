// API route for camp plans list
import { Handlers } from "$fresh/server.ts";
import type { CampPlan } from "../../../types/inventory.ts";
import { getAllCampPlans, createCampPlan } from "../../../db/kv.ts";
import { type Session, csrfOk, forbidden, csrfFailed } from "../../../lib/auth.ts";

export const handler: Handlers = {
  // GET /api/camps - list all camp plans
  async GET(_req, _ctx) {
    try {
      const plans = await getAllCampPlans();
      return new Response(JSON.stringify(plans), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (_error) {
      return new Response(JSON.stringify({ error: "Failed to fetch camp plans" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // POST /api/camps - create a new camp plan
  async POST(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") return forbidden();
    if (!csrfOk(req, session)) return csrfFailed();

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
      return new Response(JSON.stringify(created), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (_error) {
      return new Response(JSON.stringify({ error: "Failed to create camp plan" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
