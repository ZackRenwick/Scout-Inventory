// Edit an existing meal — admin only
import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../../components/Layout.tsx";
import MealForm from "../../../islands/MealForm.tsx";
import { getMealById, getItemsByCategory } from "../../../db/kv.ts";
import { type Session } from "../../../lib/auth.ts";
import type { FoodItem } from "../../../types/inventory.ts";
import type { Meal, FoodItemSummary } from "../../../types/meals.ts";

interface EditMealPageData {
  meal: Meal;
  foodItems: FoodItemSummary[];
  session: Session;
  csrfToken: string;
}

export const handler: Handlers<EditMealPageData> = {
  async GET(_req, ctx) {
    const session = ctx.state.session as Session;
    if (session.role !== "admin") {
      return new Response(null, { status: 302, headers: { location: "/meals" } });
    }
    const [meal, rawFood] = await Promise.all([
      getMealById(ctx.params.id),
      getItemsByCategory("food"),
    ]);
    if (!meal) {
      return new Response(null, { status: 302, headers: { location: "/meals" } });
    }
    const foodItems: FoodItemSummary[] = rawFood
      .map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        expiryDate: (i as FoodItem).expiryDate?.toISOString(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return ctx.render({ meal, foodItems, session, csrfToken: session.csrfToken });
  },
};

export default function EditMealPage({ data }: PageProps<EditMealPageData>) {
  return (
    <Layout title="Edit Meal" username={data.session.username} role={data.session.role}>
      <div class="max-w-2xl">
        <div class="mb-4">
          <a href="/meals" class="text-sm text-purple-600 dark:text-purple-400 hover:underline">
            ← Back to meals
          </a>
        </div>
        <MealForm meal={data.meal} foodItems={data.foodItems} csrfToken={data.csrfToken} />
      </div>
    </Layout>
  );
}
