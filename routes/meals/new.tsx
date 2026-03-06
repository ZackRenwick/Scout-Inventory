// Create a new meal — admin/manager only
import { page, PageProps } from "fresh";
import Layout from "../../components/Layout.tsx";
import MealForm from "../../islands/MealForm.tsx";
import { type Session } from "../../lib/auth.ts";

interface NewMealPageData {
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
    return page({ session, csrfToken: session.csrfToken });
  },
};

export default function NewMealPage({ data }: PageProps<NewMealPageData>) {
  return (
    <Layout
      title="Add Meal"
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
        <MealForm csrfToken={data.csrfToken} />
      </div>
    </Layout>
  );
}
