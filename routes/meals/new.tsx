// Create a new meal — admin/manager only
import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../components/Layout.tsx";
import MealForm from "../../islands/MealForm.tsx";
import { getItemsByCategory } from "../../db/kv.ts";
import { type Session } from "../../lib/auth.ts";
import type { FoodItem } from "../../types/inventory.ts";
import type { FoodItemSummary } from "../../types/meals.ts";

interface NewMealPageData {
  foodItems: FoodItemSummary[];
  session: Session;
  csrfToken: string;
}

export const handler: Handlers<NewMealPageData> = {
  async GET(_req, ctx) {
    const session = ctx.state.session as Session;
    if (session.role !== "admin" && session.role !== "manager") {
      return new Response(null, { status: 302, headers: { location: "/meals" } });
    }
    const rawFood = await getItemsByCategory("food");
    const foodItems: FoodItemSummary[] = rawFood
      .map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        expiryDate: (i as FoodItem).expiryDate?.toISOString(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    return ctx.render({ foodItems, session, csrfToken: session.csrfToken });
  },
};

export default function NewMealPage({ data }: PageProps<NewMealPageData>) {
  return (
    <Layout title="Add Meal" username={data.session.username} role={data.session.role}>
      <div class="max-w-2xl">
        <div class="mb-4">
          <a href="/meals" class="text-sm text-purple-600 dark:text-purple-400 hover:underline">
            ← Back to meals
          </a>
        </div>
        <MealForm foodItems={data.foodItems} csrfToken={data.csrfToken} />
      </div>
    </Layout>
  );
}
