// Meal planner — list meals and run a camp planning calculation
import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../components/Layout.tsx";
import MealPlannerForm from "../../islands/MealPlannerForm.tsx";
import { getAllMeals, getItemsByCategory } from "../../db/kv.ts";
import { type Session } from "../../lib/auth.ts";
import type { Meal, FoodItemSummary } from "../../types/meals.ts";

interface MealsPageData {
  meals: Meal[];
  foodItems: FoodItemSummary[];
  session: Session;
  csrfToken: string;
}

export const handler: Handlers<MealsPageData> = {
  async GET(_req, ctx) {
    const session = ctx.state.session as Session;
    const [meals, rawFood] = await Promise.all([
      getAllMeals(),
      getItemsByCategory("food"),
    ]);

    const foodItems: FoodItemSummary[] = rawFood
      .map((i) => ({ id: i.id, name: i.name, quantity: i.quantity }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    const csrfToken = session.csrfToken;
    return ctx.render({ meals, foodItems, session, csrfToken });
  },
};

export default function MealsPage({ data }: PageProps<MealsPageData>) {
  const { meals, foodItems, session, csrfToken } = data;
  const isAdmin = session.role === "admin";

  return (
    <Layout title="Meal Planner" username={session.username} role={session.role}>

      {/* Beta notice */}
      <div class="mb-6 flex items-start gap-3 rounded-lg border border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300">
        <span class="text-base" aria-hidden="true">🧪</span>
        <p><span class="font-semibold">Beta feature</span> — Meal Planning is still being developed. Feedback and bug reports are welcome.</p>
      </div>

      {/* Meal list */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 mb-8">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-800 dark:text-purple-100">Meals</h2>
          {isAdmin && (
            <a
              href="/meals/new"
              class="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              ➕ Add meal
            </a>
          )}
        </div>

        {meals.length === 0 ? (
          <div class="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
            <p class="text-3xl mb-2">🍽️</p>
            <p class="text-sm">No meals added yet.{isAdmin ? ' Click "Add meal" to create your first recipe.' : ""}</p>
          </div>
        ) : (
          <ul class="divide-y divide-gray-100 dark:divide-gray-700">
            {meals.map((meal) => (
              <li key={meal.id} class="px-6 py-4">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <p class="font-medium text-gray-800 dark:text-purple-100">{meal.name}</p>
                    {meal.description && (
                      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{meal.description}</p>
                    )}
                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {meal.ingredients.length} ingredient{meal.ingredients.length !== 1 ? "s" : ""}
                      {" · "}
                      {meal.ingredients.map((i) => i.name).join(", ")}
                    </p>
                  </div>
                  {isAdmin && (
                    <a
                      href={`/meals/${meal.id}/edit`}
                      class="shrink-0 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Edit
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Planner */}
      {meals.length > 0 && (
        <MealPlannerForm meals={meals} foodItems={foodItems} csrfToken={csrfToken} />
      )}
    </Layout>
  );
}
