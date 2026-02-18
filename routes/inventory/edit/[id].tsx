// Edit inventory item page
import { Handlers, PageProps } from "$fresh/server.ts";
import type { InventoryItem } from "../../../types/inventory.ts";
import Layout from "../../../components/Layout.tsx";
import ItemForm from "../../../islands/ItemForm.tsx";
import type { Session } from "../../../lib/auth.ts";

interface EditItemData {
  item: InventoryItem | null;
  session?: Session;
}

export const handler: Handlers<EditItemData> = {
  async GET(_req, ctx) {
    const { id } = ctx.params;
    
    try {
      const response = await fetch(`http://localhost:8000/api/items/${id}`);
      if (!response.ok) {
        return ctx.render({ item: null, session: ctx.state.session as Session });
      }
      
      const session = ctx.state.session as Session;
      // Viewers cannot edit items
      if (session.role === "viewer") {
        return new Response(null, { status: 302, headers: { location: `/inventory/${id}` } });
      }

      const item = await response.json();
      
      // Convert date strings back to Date objects
      item.addedDate = new Date(item.addedDate);
      item.lastUpdated = new Date(item.lastUpdated);
      if (item.expiryDate) {
        item.expiryDate = new Date(item.expiryDate);
      }
      
      return ctx.render({ item, session: ctx.state.session as Session });
    } catch (error) {
      console.error("Failed to fetch item:", error);
      return ctx.render({ item: null, session: ctx.state.session as Session });
    }
  },
};

export default function EditItemPage({ data }: PageProps<EditItemData>) {
  if (!data.item) {
    return (
      <Layout title="Item Not Found" username={data.session?.username} role={data.session?.role}>
        <div class="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg p-8 text-center">
          <p class="text-red-700 dark:text-red-300 text-lg">Item not found</p>
          <a href="/inventory" class="mt-4 inline-block text-red-600 dark:text-red-400 hover:text-red-800 underline">
            ← Back to Inventory
          </a>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout title={`Edit: ${data.item.name}`} username={data.session?.username} role={data.session?.role}>
      <div class="mb-6">
        <a href={`/inventory/${data.item.id}`} class="text-purple-600 dark:text-purple-400 hover:text-purple-800">
          ← Back to Item Details
        </a>
      </div>
      
      <ItemForm initialData={data.item} isEdit />
    </Layout>
  );
}
