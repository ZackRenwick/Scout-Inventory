// Inventory listing page
import { Handlers, PageProps } from "$fresh/server.ts";
import type { InventoryItem } from "../../types/inventory.ts";
import Layout from "../../components/Layout.tsx";
import InventoryTable from "../../islands/InventoryTable.tsx";
import type { Session } from "../../lib/auth.ts";
import { getAllItems } from "../../db/kv.ts";

interface InventoryPageData {
  items: InventoryItem[];
  session?: Session;
  needsRepair: boolean;
}

export const handler: Handlers<InventoryPageData> = {
  async GET(req, ctx) {
    const url = new URL(req.url);
    const needsRepair = url.searchParams.get("needsrepair") === "true";
    try {
      const items = await getAllItems();
      items.sort((a, b) => a.name.localeCompare(b.name));
      return ctx.render({ items, session: ctx.state.session as Session, needsRepair });
    } catch (error) {
      console.error("Failed to fetch items:", error);
      return ctx.render({ items: [], session: ctx.state.session as Session, needsRepair });
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
      
      <InventoryTable items={data.items} canEdit={canEdit} initialNeedsRepair={data.needsRepair} />
    </Layout>
  );
}
