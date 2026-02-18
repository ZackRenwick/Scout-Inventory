// Inventory listing page
import { Handlers, PageProps } from "$fresh/server.ts";
import type { InventoryItem } from "../../types/inventory.ts";
import Layout from "../../components/Layout.tsx";
import InventoryTable from "../../islands/InventoryTable.tsx";
import type { Session } from "../../lib/auth.ts";

interface InventoryPageData {
  items: InventoryItem[];
  session?: Session;
}

export const handler: Handlers<InventoryPageData> = {
  async GET(_req, ctx) {
    try {
      const response = await fetch(`http://localhost:8000/api/items`);
      const items = await response.json();
      
      // Convert date strings back to Date objects
      // deno-lint-ignore no-explicit-any
      const processedItems = items.map((item: any) => ({
        ...item,
        addedDate: new Date(item.addedDate),
        lastUpdated: new Date(item.lastUpdated),
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
      }));
      
      return ctx.render({ items: processedItems, session: ctx.state.session as Session });
    } catch (error) {
      console.error("Failed to fetch items:", error);
      return ctx.render({ items: [], session: ctx.state.session as Session });
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
      
      <InventoryTable items={data.items} canEdit={canEdit} />
    </Layout>
  );
}
