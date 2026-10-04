// Core badges page — track stock of each core badge type (World Membership,
// Scotland, Forth Region, West Lothian, 7th Whitburn).
import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../components/Layout.tsx";
import CoreBadgesDashboard from "../islands/CoreBadgesDashboard.tsx";
import type { Session } from "../lib/auth.ts";

interface BadgesPageData {
  session?: Session;
}

export const handler: Handlers<BadgesPageData> = {
  GET(_req, ctx) {
    return ctx.render({ session: ctx.state.session as Session });
  },
};

export default function BadgesPage({ data }: PageProps<BadgesPageData>) {
  const canEdit = data.session?.role !== "viewer";

  return (
    <Layout
      title=""
      username={data.session?.username}
      role={data.session?.role}
    >
      <div class="max-w-4xl mx-auto">
        <div class="mb-6">
          <h2 class="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-purple-100">
            Core Badges
          </h2>
          <p class="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2">
            Track stock of each core badge — usually bought together as a set,
            but adjustable individually too.
          </p>
        </div>

        <CoreBadgesDashboard
          csrfToken={data.session?.csrfToken ?? ""}
          canEdit={canEdit}
        />
      </div>
    </Layout>
  );
}
