// Add new inventory item page
import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../components/Layout.tsx";
import ItemForm from "../../islands/ItemForm.tsx";
import type { Session } from "../../lib/auth.ts";

interface AddItemData {
  session?: Session;
}

export const handler: Handlers<AddItemData> = {
  GET(_req, ctx) {
    const session = ctx.state.session as Session;
    // Viewers cannot add items
    if (session.role === "viewer") {
      return new Response(null, { status: 302, headers: { location: "/inventory" } });
    }
    return ctx.render({ session });
  },
};

export default function AddItemPage({ data }: PageProps<AddItemData>) {
  return (
    <Layout title="" username={data.session?.username} role={data.session?.role}>
      <div class="flex flex-col items-center">
        <div class="w-full max-w-2xl mb-6 text-center">
          <h2 class="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-purple-100 mb-1">Add New Item</h2>
          <p class="text-gray-600 dark:text-gray-400">Fill out the form below to add a new item to the inventory</p>
        </div>
        <ItemForm csrfToken={data.session?.csrfToken} />
      </div>
    </Layout>
  );
}
