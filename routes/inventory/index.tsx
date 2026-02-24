// Inventory listing page
import { Handlers, PageProps } from "$fresh/server.ts";
import type { InventoryItem } from "../../types/inventory.ts";
import Layout from "../../components/Layout.tsx";
import InventoryTable from "../../islands/InventoryTable.tsx";
import type { Session } from "../../lib/auth.ts";
import { getAllItems, getActiveCheckOuts } from "../../db/kv.ts";

interface InventoryPageData {
  items: InventoryItem[];
  session?: Session;
  needsRepair: boolean;
  lowStock: boolean;
  initialCategory: string;
  loanedItemIds: string[];
  initialOnLoan: boolean;
}

export const handler: Handlers<InventoryPageData> = {
  async GET(req, ctx) {
    const url = new URL(req.url);
    const needsRepair = url.searchParams.get("needsrepair") === "true";
    const lowStock = url.searchParams.get("lowstock") === "true";
    const initialCategory = url.searchParams.get("category") ?? "all";
    const initialOnLoan = url.searchParams.get("onloan") === "true";
    try {
      const [items, activeLoans] = await Promise.all([
        getAllItems(),
        getActiveCheckOuts(),
      ]);
      items.sort((a, b) => a.name.localeCompare(b.name));

      // Lazy load items in chunks
      const chunkSize = 50;
      const paginatedItems = items.slice(0, chunkSize);

      const loanedItemIds = [...new Set(activeLoans.map((l) => l.itemId))];

      return ctx.render({
        items: paginatedItems,
        session: ctx.state.session as Session,
        needsRepair,
        lowStock,
        initialCategory,
        loanedItemIds,
        initialOnLoan,
      });
    } catch (error) {
      console.error("Failed to fetch items:", error);
      return ctx.render({
        items: [],
        session: ctx.state.session as Session,
        needsRepair,
        lowStock,
        initialCategory,
        loanedItemIds: [],
        initialOnLoan,
      });
    }
  },
};

export default function InventoryPage({ data }: PageProps<InventoryPageData>) {
  const canEdit = data.session?.role !== "viewer";
  return (
    <Layout title="Inventory" username={data.session?.username} role={data.session?.role}>
      <div class="mb-6">
        <div class="flex justify-between items-center">
          <p class="text-gray-600 dark:text-gray-400">Manage all inventory items</p>
          {canEdit && (
          <a
            href="/inventory/add"
            class="px-4 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700"
          >
            ➕ Add Item
          </a>
          )}
        </div>
      </div>
      
      <InventoryTable items={data.items} canEdit={canEdit} initialNeedsRepair={data.needsRepair} initialLowStock={data.lowStock} initialCategory={data.initialCategory} csrfToken={data.session?.csrfToken} loanedItemIds={data.loanedItemIds} initialOnLoan={data.initialOnLoan} />
    </Layout>
  );
}
