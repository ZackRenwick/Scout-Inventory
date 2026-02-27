// Camp plans listing page
import { Handlers, PageProps } from "$fresh/server.ts";
import type { CampPlan } from "../../types/inventory.ts";
import Layout from "../../components/Layout.tsx";
import CampPlanList from "../../islands/CampPlanList.tsx";
import CampCalendar from "../../islands/CampCalendar.tsx";
import type { Session } from "../../lib/auth.ts";
import { getAllCampPlans } from "../../db/kv.ts";

type ViewMode = "list" | "calendar";

interface CampsPageData {
  plans: CampPlan[];
  session?: Session;
  view: ViewMode;
}

export const handler: Handlers<CampsPageData> = {
  async GET(req, ctx) {
    try {
      const url = new URL(req.url);
      const view: ViewMode = url.searchParams.get("view") === "calendar" ? "calendar" : "list";
      const plans = await getAllCampPlans();
      return ctx.render({ plans, session: ctx.state.session as Session, view });
    } catch (error) {
      console.error("Failed to fetch camp plans:", error);
      return ctx.render({ plans: [], session: ctx.state.session as Session, view: "list" });
    }
  },
};

/** Returns the CSS classes for a view-toggle tab link. */
function viewTabClass(active: boolean, hasBorderLeft = false): string {
  const base = "px-3 py-2 transition-colors";
  const border = hasBorderLeft ? " border-l border-gray-300 dark:border-gray-600" : "";
  const state = active
    ? " bg-purple-600 text-white"
    : " text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700";
  return base + border + state;
}

export default function CampsPage({ data }: PageProps<CampsPageData>) {
  const canEdit    = data.session?.role !== "viewer";
  const isCalendar = data.view === "calendar";

  return (
    <Layout title="Camp Planning" username={data.session?.username} role={data.session?.role}>
      <div class="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-amber-800 dark:text-amber-300 text-sm">
        🚧 <strong>Beta feature</strong> — Camp Planning is still in development. Please report any issues.
      </div>

      <div class="mb-6">
        <div class="flex justify-between items-center gap-4 flex-wrap">
          <p class="text-gray-600 dark:text-gray-400">
            Plan camps, manage packing lists, and track equipment returns
          </p>

          <div class="flex gap-2 flex-wrap items-center">
            {/* List / Calendar toggle */}
            <div class="flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden text-sm font-medium">
              <a href="/camps"              class={viewTabClass(!isCalendar)}>☰ List</a>
              <a href="/camps?view=calendar" class={viewTabClass(isCalendar, true)}>📅 Calendar</a>
            </div>

            {canEdit && (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>

      {isCalendar
        ? <CampCalendar plans={data.plans} />
        : <CampPlanList plans={data.plans} canEdit={canEdit} csrfToken={data.session?.csrfToken} />}
    </Layout>
  );
}
