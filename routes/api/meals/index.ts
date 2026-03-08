// GET /api/meals        — list all meals (any authenticated user)
// POST /api/meals       — create a meal (admin/manager only)
import { createMeal, getAllMeals } from "../../../db/kv.ts";
import {
  csrfFailed,
  csrfOk,
  forbidden,
  type Session,
} from "../../../lib/auth.ts";
import type { MealPayload } from "../../../types/meals.ts";
import { logActivity } from "../../../lib/activityLog.ts";

export const handler = {
  async GET(ctx) {
    if (!ctx.state.session) return forbidden();
    try {
      const meals = await getAllMeals();
      return Response.json(meals);
    } catch {
      return Response.json({ error: "Failed to fetch meals" }, { status: 500 });
    }
  },

  async POST(ctx) {
    const req = ctx.req;
    const session = ctx.state.session as Session | undefined;
    if (!session || (session.role !== "admin" && session.role !== "manager")) {
      return forbidden();
    }
    if (!csrfOk(req, session)) return csrfFailed();

    try {
      const body = await req.json() as Partial<MealPayload>;
      const name = (body.name ?? "").trim();
      if (!name) {
        return Response.json({ error: "Name is required" }, { status: 400 });
      }
      if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) {
        return Response.json({ error: "At least one ingredient is required" }, {
          status: 400,
        });
      }
      const badIngredient = body.ingredients.some(
        (ing: Partial<{ name: string }>) => !ing.name?.trim(),
      );
      if (badIngredient) {
        return Response.json({ error: "Each ingredient must have a name" }, {
          status: 400,
        });
      }

      const meal = await createMeal({
        name,
        description: body.description?.trim() || undefined,
        ingredients: body.ingredients,
      });

      await logActivity({
        username: session.username,
        action: "meal.created",
        resource: "meal",
        resourceId: meal.id,
        details: meal.name,
      });

      return Response.json(meal, { status: 201 });
    } catch {
      return Response.json({ error: "Failed to create meal" }, { status: 500 });
    }
  },
};
