// Edit an existing meal — admin/manager only
import { page, PageProps } from "fresh";
import Layout from "../../../components/Layout.tsx";
import MealForm from "../../../islands/MealForm.tsx";
import { getMealById } from "../../../db/kv.ts";
import { type Session } from "../../../lib/auth.ts";
import type { Meal } from "../../../types/meals.ts";

interface EditMealPageData {
  meal: Meal;
  session: Session;
  csrfToken: string;
}

export const handler = {
  async GET(ctx) {
    const session = ctx.state.session as Session;
    if (session.role !== "admin" && session.role !== "manager") {
      return new Response(null, {
        status: 302,
        headers: { location: "/meals" },
      });
    }
    const meal = await getMealById(ctx.params.id);
    if (!meal) {
      return new Response(null, {
        status: 302,
        headers: { location: "/meals" },
      });
    }
    return page({ meal, session, csrfToken: session.csrfToken });
  },
};

export default function EditMealPage({ data }: PageProps<EditMealPageData>) {
  return (
    <Layout
      title="Edit Meal"
      username={data.session.username}
      role={data.session.role}
    >
      <div class="max-w-2xl">
        <div class="mb-4">
          <a
            href="/meals"
            class="text-sm text-purple-600 dark:text-purple-400 hover:underline"
          >
            ← Back to meals
          </a>
        </div>
        <MealForm meal={data.meal} csrfToken={data.csrfToken} />
      </div>
    </Layout>
  );
}
