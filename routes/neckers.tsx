import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../components/Layout.tsx";
import NeckerDashboard from "../islands/NeckerDashboard.tsx";
import type { Session } from "../lib/auth.ts";

interface NeckersPageData {
  session?: Session;
}

export const handler: Handlers<NeckersPageData> = {
  GET(_req, ctx) {
    const session = ctx.state.session as Session;
    if (!session || (session.role !== "admin" && session.role !== "manager")) {
      return new Response(null, { status: 302, headers: { location: "/" } });
    }
    return ctx.render({ session });
  },
};

export default function NeckersPage({ data }: PageProps<NeckersPageData>) {
  const canEdit = data.session?.role === "admin" || data.session?.role === "manager";

  return (
    <Layout title="" username={data.session?.username} role={data.session?.role}>
      <div class="max-w-5xl mx-auto">
        <div class="mb-6">
          <h2 class="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-purple-100">Necker Tracking</h2>
          <p class="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2">
            Track neckers in stock, created this period, and all-time total made.
          </p>
        </div>

        <NeckerDashboard csrfToken={data.session?.csrfToken ?? ""} canEdit={canEdit} />
      </div>
    </Layout>
  );
}
