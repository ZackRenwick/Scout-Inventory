// Camp plan detail / checklist page
import { Handlers, PageProps } from "$fresh/server.ts";
import type { CampPlan, InventoryItem } from "../../types/inventory.ts";
import Layout from "../../components/Layout.tsx";
import CampChecklist from "../../islands/CampChecklist.tsx";
import type { Session } from "../../lib/auth.ts";
import { getCampPlanById, getAllItems } from "../../db/kv.ts";

interface CampDetailPageData {
  plan: CampPlan;
  allItems: InventoryItem[];
  session?: Session;
}

export const handler: Handlers<CampDetailPageData> = {
  async GET(_req, ctx) {
    const { id } = ctx.params;
    const [plan, allItems] = await Promise.all([
      getCampPlanById(id),
      getAllItems(),
    ]);

    if (!plan) {
      return new Response(null, { status: 302, headers: { location: "/camps" } });
    }

    allItems.sort((a, b) => a.name.localeCompare(b.name));
    return ctx.render({ plan, allItems, session: ctx.state.session as Session });
  },
};

export default function CampDetailPage({ data }: PageProps<CampDetailPageData>) {
  const canEdit = data.session?.role !== "viewer";
  return (
    <Layout
      title={data.plan.name}
      username={data.session?.username}
      role={data.session?.role}
    >
      {/* Beta notice */}
      <div class="mb-5 flex items-start gap-3 rounded-lg border border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300">
        <span class="text-base" aria-hidden="true">🧪</span>
        <p><span class="font-semibold">Beta feature</span> — Camp Planning is still being developed. Feedback and bug reports are welcome.</p>
      </div>

      <div class="mb-4">
        <a
          href="/camps"
          class="text-sm text-purple-600 dark:text-purple-400 hover:underline"
        >
          ← Back to Camp Plans
        </a>
      </div>
      <CampChecklist
        plan={data.plan}
        allItems={data.allItems}
        canEdit={canEdit}
        csrfToken={data.session?.csrfToken}
      />
    </Layout>
  );
}
