// Camp plan detail / checklist page
import { page, PageProps } from "fresh";
import type {
  CampPlan,
  CampTemplate,
  InventoryItem,
} from "../../types/inventory.ts";
import Layout from "../../components/Layout.tsx";
import CampChecklist from "../../islands/CampChecklist.tsx";
import type { Session } from "../../lib/auth.ts";
import {
  getAllCampTemplates,
  getAllItems,
  getCampPlanById,
} from "../../db/kv.ts";

interface CampDetailPageData {
  plan: CampPlan;
  allItems: InventoryItem[];
  templates: CampTemplate[];
  session?: Session;
}

export const handler = {
  async GET(ctx) {
    const { id } = ctx.params;
    const [plan, allItems, templates] = await Promise.all([
      getCampPlanById(id),
      getAllItems(),
      getAllCampTemplates(),
    ]);

    if (!plan) {
      return new Response(null, {
        status: 302,
        headers: { location: "/camps" },
      });
    }

    allItems.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );
    return page({
      plan,
      allItems,
      templates,
      session: ctx.state.session as Session,
    });
  },
};

export default function CampDetailPage(
  { data }: PageProps<CampDetailPageData>,
) {
  const canEdit = data.session?.role !== "viewer";
  return (
    <Layout
      title={data.plan.name}
      username={data.session?.username}
      role={data.session?.role}
    >
      <div class="mb-4 flex items-center justify-between gap-3">
        <a
          href="/camps"
          class="text-sm text-purple-600 dark:text-purple-400 hover:underline"
        >
          ← Back to Camp Plans
        </a>
        <a
          href={`/camps/${data.plan.id}/print`}
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          🖨️ Print List
        </a>
      </div>
      <CampChecklist
        plan={data.plan}
        allItems={data.allItems}
        templates={data.templates}
        canEdit={canEdit}
        csrfToken={data.session?.csrfToken}
      />
    </Layout>
  );
}
