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
        {/* Beta notice */}
        <div class="w-full max-w-2xl mb-5 flex items-start gap-3 rounded-lg border border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300">
          <span class="text-base" aria-hidden="true">🧪</span>
          <p><span class="font-semibold">Beta feature</span> — Camp Planning is still being developed. Feedback and bug reports are welcome.</p>
        </div>

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
