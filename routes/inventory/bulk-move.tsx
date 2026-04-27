// Bulk-move inventory items to a new location
import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../components/Layout.tsx";
import BulkMoveItems from "../../islands/BulkMoveItems.tsx";
import { getAllItems } from "../../db/kv.ts";
import type { InventoryItem } from "../../types/inventory.ts";
import type { Session } from "../../lib/auth.ts";
import { forbidden } from "../../lib/auth.ts";

interface BulkMovePageData {
  items: InventoryItem[];
  session: Session;
  csrfToken: string;
}

export const handler: Handlers<BulkMovePageData> = {
  async GET(_req, ctx) {
    const session = ctx.state.session as Session;
    if (session.role !== "admin" && session.role !== "editor") {
      return forbidden();
    }
    const items = await getAllItems();
    items.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );
    return ctx.render({ items, session, csrfToken: session.csrfToken });
  },
};

export default function BulkMovePage({ data }: PageProps<BulkMovePageData>) {
  const { items, session, csrfToken } = data;
  return (
    <Layout
      title="Bulk Move Items"
      username={session.username}
      role={session.role}
    >
      <div class="max-w-5xl">
        <div class="mb-6 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
              📦 Bulk Move Items
            </h1>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Select items, choose a destination, and move them all at once.
            </p>
          </div>
          <a
            href="/inventory"
            class="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
          >
            ← Back to Inventory
          </a>
        </div>
        <BulkMoveItems items={items} csrfToken={csrfToken} />
      </div>
    </Layout>
  );
}
