// Loans listing page
import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../components/Layout.tsx";
import LoanList from "../../islands/LoanList.tsx";
import type { CheckOut } from "../../types/inventory.ts";
import type { Session } from "../../lib/auth.ts";
import { getAllCheckOuts } from "../../db/kv.ts";

interface LoansPageData {
  loans: CheckOut[];
  session?: Session;
}

export const handler: Handlers<LoansPageData> = {
  async GET(_req, ctx) {
    try {
      const loans = await getAllCheckOuts();
      // Newest first
      loans.sort((a, b) => new Date(b.checkOutDate).getTime() - new Date(a.checkOutDate).getTime());
      return ctx.render({ loans, session: ctx.state.session as Session });
    } catch (error) {
      console.error("Failed to fetch loans:", error);
      return ctx.render({ loans: [], session: ctx.state.session as Session });
    }
  },
};

export default function LoansPage({ data }: PageProps<LoansPageData>) {
  const canEdit = data.session?.role !== "viewer";
  const overdueCount = data.loans.filter(
    (l) =>
      l.status === "checked-out" && new Date(l.expectedReturnDate) < new Date(),
  ).length;

  return (
    <Layout title="Loans" username={data.session?.username} role={data.session?.role}>
      <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p class="text-gray-600 dark:text-gray-400">
            Track equipment loaned to other groups and mark items returned.
          </p>
          {overdueCount > 0 && (
            <p class="mt-1 text-sm font-medium text-red-600 dark:text-red-400">
              ⚠️ {overdueCount} loan{overdueCount > 1 ? "s are" : " is"} overdue
            </p>
          )}
        </div>
        {canEdit && (
          <a
            href="/loans/new"
            class="self-start sm:self-auto shrink-0 px-4 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 transition-colors"
          >
            ➕ Record Loan
          </a>
        )}
      </div>

      <LoanList
        loans={data.loans}
        canEdit={canEdit}
        csrfToken={data.session?.csrfToken}
      />
    </Layout>
  );
}
