// New loan page — pick an item, enter borrower details and expected return date
import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../components/Layout.tsx";
import LoanForm, { type LoanableItem } from "../../islands/LoanForm.tsx";
import type { Session } from "../../lib/auth.ts";
import { getAllItems } from "../../db/kv.ts";

interface NewLoanPageData {
  items: LoanableItem[];
  session?: Session;
}

export const handler: Handlers<NewLoanPageData> = {
  async GET(_req, ctx) {
    const session = ctx.state.session as Session;
    if (session.role === "viewer") {
      return new Response(null, { status: 302, headers: { location: "/loans" } });
    }

    // Only non-food items can be loaned (food is consumable).
    // Exclude items already at camp or fully out-of-stock due to active loans.
    const allItems = await getAllItems();
    const loanable: LoanableItem[] = allItems
      .filter((i) => i.category !== "food" && i.quantity > 0 && !i.atCamp)
      .map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        location: i.location,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return ctx.render({ items: loanable, session });
  },
};

export default function NewLoanPage({ data }: PageProps<NewLoanPageData>) {
  return (
    <Layout title="" username={data.session?.username} role={data.session?.role}>
      <div class="flex flex-col items-center">
        <div class="w-full max-w-2xl mb-6 text-center">
          <h2 class="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-purple-100 mb-1">
            Record a Loan
          </h2>
          <p class="text-gray-600 dark:text-gray-400">
            Log equipment being loaned to another group. Stock will be adjusted when the loan is recorded.
          </p>
        </div>
        <div class="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <LoanForm items={data.items} csrfToken={data.session?.csrfToken} />
        </div>
      </div>
    </Layout>
  );
}
