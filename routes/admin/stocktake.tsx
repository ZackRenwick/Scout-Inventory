// Admin — stock-take wizard page
import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../components/Layout.tsx";
import StocktakeWizard, { type StocktakeItem } from "../../islands/StocktakeWizard.tsx";
import type { Session } from "../../lib/auth.ts";
import { getAllItems } from "../../db/kv.ts";

interface StocktakePageData {
  items: StocktakeItem[];
  session: Session;
  total: number;
}

export const handler: Handlers<StocktakePageData> = {
  async GET(_req, ctx) {
    const session = ctx.state.session as Session;
    if (session.role === "viewer") {
      return new Response(null, { status: 302, headers: { location: "/admin/admin-panel" } });
    }

    const allItems = await getAllItems();

    // Sort by location so the user can physically walk the store in order
    allItems.sort((a, b) => a.location.localeCompare(b.location, undefined, { numeric: true }) || a.name.localeCompare(b.name, undefined, { numeric: true }));

    const stocktakeItems: StocktakeItem[] = allItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      location: item.location,
      recordedQty: item.quantity,
      hasCondition: "condition" in item,
      recordedCondition: ("condition" in item ? (item as { condition: string }).condition : undefined),
    }));

    return ctx.render({ items: stocktakeItems, session, total: stocktakeItems.length });
  },
};

export default function StocktakePage({ data }: PageProps<StocktakePageData>) {
  return (
    <Layout title="Stock-take" username={data.session.username} role={data.session.role}>
      <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p class="text-gray-600 dark:text-gray-400">
            Walk the store, count each item, and apply corrections to the inventory.
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-500 mt-1">
            Items are ordered by location so you can move through the store systematically.
            <strong class="text-gray-600 dark:text-gray-400"> {data.total} items</strong> to check.
          </p>
        </div>
        <a
          href="/admin/admin-panel"
          class="self-start shrink-0 text-sm text-purple-600 dark:text-purple-400 hover:underline"
        >
          ← Admin Panel
        </a>
      </div>

      {data.items.length === 0 ? (
        <div class="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <div class="text-4xl mb-3">📦</div>
          <p class="text-gray-500 dark:text-gray-400">No inventory items found.</p>
          <a
            href="/inventory/add"
            class="mt-3 inline-block text-purple-600 dark:text-purple-400 hover:underline text-sm"
          >
            Add items first →
          </a>
        </div>
      ) : (
        <StocktakeWizard items={data.items} csrfToken={data.session.csrfToken} />
      )}
    </Layout>
  );
}
