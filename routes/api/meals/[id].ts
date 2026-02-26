// GET    /api/meals/:id  — fetch a single meal (any authenticated user)
// PUT    /api/meals/:id  — update a meal (admin/manager only)
// DELETE /api/meals/:id  — delete a meal (admin/manager only)
import { Handlers } from "$fresh/server.ts";
import { getMealById, updateMeal, deleteMeal } from "../../../db/kv.ts";
import { type Session, csrfOk, forbidden, csrfFailed } from "../../../lib/auth.ts";
import type { MealPayload } from "../../../types/meals.ts";
import { logActivity } from "../../../lib/activityLog.ts";

export const handler: Handlers = {
  async GET(req, ctx) {
    if (!ctx.state.session) return forbidden();
    const meal = await getMealById(ctx.params.id);
    if (!meal) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(meal);
  },

  async PUT(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || (session.role !== "admin" && session.role !== "manager")) return forbidden();
    if (!csrfOk(req, session)) return csrfFailed();

    try {
      const body = await req.json() as Partial<MealPayload>;
      const name = (body.name ?? "").trim();
      if (!name) {
        return Response.json({ error: "Name is required" }, { status: 400 });
      }
      if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) {
        return Response.json({ error: "At least one ingredient is required" }, { status: 400 });
      }
      const badIngredient = body.ingredients.some(
        (ing: Partial<{ name: string }>) => !ing.name?.trim(),
      );
      if (badIngredient) {
        return Response.json({ error: "Each ingredient must have a name" }, { status: 400 });
      }

      const updated = await updateMeal(ctx.params.id, {
        name,
        description: body.description?.trim() || undefined,
        ingredients: body.ingredients,
      });
      if (!updated) return Response.json({ error: "Not found" }, { status: 404 });

      await logActivity({
        username: session.username,
        action: "meal.updated",
        resource: "meal",
        resourceId: updated.id,
        details: updated.name,
      });

      return Response.json(updated);
    } catch {
      return Response.json({ error: "Failed to update meal" }, { status: 500 });
    }
  },

  async DELETE(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || (session.role !== "admin" && session.role !== "manager")) return forbidden();
    if (!csrfOk(req, session)) return csrfFailed();

    const meal = await getMealById(ctx.params.id);
    if (!meal) return Response.json({ error: "Not found" }, { status: 404 });

    await deleteMeal(ctx.params.id);

    await logActivity({
      username: session.username,
      action: "meal.deleted",
      resource: "meal",
      resourceId: ctx.params.id,
      details: meal.name,
    });

    return Response.json({ ok: true });
  },
};
