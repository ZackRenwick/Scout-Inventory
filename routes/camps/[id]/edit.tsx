// Edit camp plan page
import { Handlers, PageProps } from "$fresh/server.ts";
import type { CampPlan } from "../../../types/inventory.ts";
import Layout from "../../../components/Layout.tsx";
import CampPlanForm from "../../../islands/CampPlanForm.tsx";
import type { Session } from "../../../lib/auth.ts";
import { getCampPlanById } from "../../../db/kv.ts";

interface EditCampPageData {
  plan: CampPlan;
  session?: Session;
}

export const handler: Handlers<EditCampPageData> = {
  async GET(_req, ctx) {
    const session = ctx.state.session as Session;
    if (session.role === "viewer") {
      return new Response(null, { status: 302, headers: { location: "/camps" } });
    }

    const plan = await getCampPlanById(ctx.params.id);
    if (!plan) {
      return new Response(null, { status: 302, headers: { location: "/camps" } });
    }

    return ctx.render({ plan, session });
  },
};

export default function EditCampPage({ data }: PageProps<EditCampPageData>) {
  return (
    <Layout title="" username={data.session?.username} role={data.session?.role}>
      <div class="flex flex-col items-center">
        <div class="w-full max-w-2xl mb-4">
          <a
            href={`/camps/${data.plan.id}`}
            class="text-sm text-purple-600 dark:text-purple-400 hover:underline"
          >
            ← Back to {data.plan.name}
          </a>
        </div>
        <div class="w-full max-w-2xl mb-6 text-center">
          <h2 class="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-purple-100 mb-1">
            Edit Camp Plan
          </h2>
          <p class="text-gray-600 dark:text-gray-400">Update the details for this camp</p>
        </div>
        <div class="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <CampPlanForm csrfToken={data.session?.csrfToken} existing={data.plan} />
        </div>
      </div>
    </Layout>
  );
}
