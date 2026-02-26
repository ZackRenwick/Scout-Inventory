// Camp plans listing page
import { Handlers, PageProps } from "$fresh/server.ts";
import type { CampPlan } from "../../types/inventory.ts";
import Layout from "../../components/Layout.tsx";
import CampPlanList from "../../islands/CampPlanList.tsx";
import type { Session } from "../../lib/auth.ts";
import { getAllCampPlans } from "../../db/kv.ts";

interface CampsPageData {
  plans: CampPlan[];
  session?: Session;
}

export const handler: Handlers<CampsPageData> = {
  async GET(_req, ctx) {
    try {
      const plans = await getAllCampPlans();
      return ctx.render({ plans, session: ctx.state.session as Session });
    } catch (error) {
      console.error("Failed to fetch camp plans:", error);
      return ctx.render({ plans: [], session: ctx.state.session as Session });
    }
  },
};

export default function CampsPage({ data }: PageProps<CampsPageData>) {
  const canEdit = data.session?.role !== "viewer";
  return (
    <Layout title="Camp Planning" username={data.session?.username} role={data.session?.role}>
      <div class="mb-6">
        <div class="flex justify-between items-center">
          <p class="text-gray-600 dark:text-gray-400">
            Plan camps, manage packing lists, and track equipment returns
          </p>
          {canEdit && (
            <div class="flex gap-2 flex-wrap">
              <a
                href="/camps/templates"
                class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                📋 Templates
              </a>
              <a
                href="/camps/new"
                class="px-4 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 transition-colors"
              >
                ➕ New Camp Plan
              </a>
            </div>
          )}
        </div>
      </div>
      <CampPlanList plans={data.plans} canEdit={canEdit} csrfToken={data.session?.csrfToken} />
    </Layout>
  );
}
