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
    <Layout title="Add New Item" username={data.session?.username} role={data.session?.role}>
      <div class="mb-6">
        <p class="text-gray-600 dark:text-gray-400">Fill out the form below to add a new item to the inventory</p>
      </div>
      
      <ItemForm />
    </Layout>
  );
}
