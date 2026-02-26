// New camp plan page
import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../components/Layout.tsx";
import CampPlanForm from "../../islands/CampPlanForm.tsx";
import type { Session } from "../../lib/auth.ts";

interface NewCampPageData {
  session?: Session;
}

export const handler: Handlers<NewCampPageData> = {
  GET(_req, ctx) {
    const session = ctx.state.session as Session;
    if (session.role === "viewer") {
      return new Response(null, { status: 302, headers: { location: "/camps" } });
    }
    return ctx.render({ session });
  },
};

export default function NewCampPage({ data }: PageProps<NewCampPageData>) {
  return (
    <Layout title="" username={data.session?.username} role={data.session?.role}>
      <div class="flex flex-col items-center">
        <div class="w-full max-w-2xl mb-6 text-center">
          <h2 class="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-purple-100 mb-1">
            New Camp Plan
          </h2>
          <p class="text-gray-600 dark:text-gray-400">
            Create a new camp plan to manage your packing list
          </p>
        </div>
        <div class="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <CampPlanForm csrfToken={data.session?.csrfToken} />
        </div>
      </div>
    </Layout>
  );
}
