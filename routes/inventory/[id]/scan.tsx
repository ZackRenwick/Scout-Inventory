// QR scan landing page for fast loan actions (check-out and check-in)
import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../../components/Layout.tsx";
import type { Session } from "../../../lib/auth.ts";
import { csrfFailed, forbidden } from "../../../lib/auth.ts";
import {
  getActiveCheckOutsByItemId,
  getCheckOutById,
  getItemById,
  returnCheckOut,
} from "../../../db/kv.ts";
import type { CheckOut, InventoryItem } from "../../../types/inventory.ts";
import { formatDate } from "../../../lib/date-utils.ts";
import { logActivity } from "../../../lib/activityLog.ts";

interface ScanPageData {
  item: InventoryItem | null;
  activeLoans: CheckOut[];
  session?: Session;
  csrfToken?: string;
}

export const handler: Handlers<ScanPageData> = {
  async GET(_req, ctx) {
    const { id } = ctx.params;
    const session = ctx.state.session as Session | undefined;
    const item = await getItemById(id);
    if (!item) {
      return ctx.render({
        item: null,
        activeLoans: [],
        session,
        csrfToken: session?.csrfToken,
      });
    }

    const activeLoans = await getActiveCheckOutsByItemId(id);
    return ctx.render({
      item,
      activeLoans,
      session,
      csrfToken: session?.csrfToken,
    });
  },

  async POST(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") return forbidden();

    const formData = await req.formData();
    const csrfToken = formData.get("csrf") as string | null;
    if (!csrfToken || csrfToken !== session.csrfToken) return csrfFailed();

    const { id: itemId } = ctx.params;
    const action = String(formData.get("action") ?? "");
    if (action !== "return-loan") {
      return new Response("Invalid action", { status: 400 });
    }

    const loanId = String(formData.get("loanId") ?? "");
    if (!loanId) {
      return new Response("Missing loanId", { status: 400 });
    }

    const loan = await getCheckOutById(loanId);
    if (!loan || loan.itemId !== itemId || loan.status === "returned") {
      return new Response(null, {
        status: 303,
        headers: { Location: `/inventory/${itemId}/scan` },
      });
    }

    const updated = await returnCheckOut(loanId);
    if (updated) {
      await logActivity({
        username: session.username,
        action: "loan.returned",
        resource: updated.itemName,
        resourceId: updated.id,
        details:
          `QR return for ${updated.quantity}x \"${updated.itemName}\" from ${updated.borrower}`,
      });
    }

    return new Response(null, {
      status: 303,
      headers: { Location: `/inventory/${itemId}/scan` },
    });
  },
};

export default function ScanActionPage({ data }: PageProps<ScanPageData>) {
  if (!data.item) {
    return (
      <Layout
        title="Item Not Found"
        username={data.session?.username}
        role={data.session?.role}
      >
        <div class="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <p class="text-red-700 text-lg">Item not found</p>
          <a
            href="/inventory"
            class="mt-4 inline-block text-red-600 hover:text-red-800 underline"
          >
            Back to Inventory
          </a>
        </div>
      </Layout>
    );
  }

  const { item, activeLoans } = data;
  const canEdit = data.session?.role !== "viewer";

  return (
    <Layout
      title={`Scan: ${item.name}`}
      username={data.session?.username}
      role={data.session?.role}
    >
      <div class="max-w-3xl mx-auto space-y-6">
        <div class="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-5 sm:p-6">
          <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            QR Quick Actions
          </p>
          <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            {item.name}
          </h1>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {item.location} · {item.quantity} in stock
          </p>

          <div class="mt-4 flex flex-wrap gap-3">
            {canEdit && (
              <a
                href={`/loans/new?itemId=${item.id}`}
                class="px-4 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 transition-colors"
              >
                Check Out This Item
              </a>
            )}
            <a
              href={`/inventory/${item.id}`}
              class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              View Full Item
            </a>
            {canEdit && (
              <a
                href={`/inventory/${item.id}/maintenance`}
                class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Log Maintenance
              </a>
            )}
          </div>
        </div>

        <div class="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-5 sm:p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Active Loans for This Item
          </h2>
          {activeLoans.length === 0
            ? (
              <p class="text-gray-600 dark:text-gray-400">
                No active loans to return for this item.
              </p>
            )
            : (
              <div class="space-y-3">
                {activeLoans.map((loan) => (
                  <div
                    key={loan.id}
                    class="rounded-md border border-gray-200 dark:border-gray-700 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                  >
                    <div>
                      <p class="font-medium text-gray-900 dark:text-gray-100">
                        {loan.borrower}
                      </p>
                      <p class="text-sm text-gray-600 dark:text-gray-400">
                        Qty {loan.quantity} · Due{" "}
                        {formatDate(loan.expectedReturnDate)}
                      </p>
                    </div>
                    {canEdit && (
                      <form method="POST">
                        <input
                          type="hidden"
                          name="csrf"
                          value={data.csrfToken ?? ""}
                        />
                        <input
                          type="hidden"
                          name="action"
                          value="return-loan"
                        />
                        <input type="hidden" name="loanId" value={loan.id} />
                        <button
                          type="submit"
                          class="px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                        >
                          Mark Returned
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </Layout>
  );
}
