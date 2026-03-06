// Admin activity log page
import { page, PageProps } from "fresh";
import Layout from "../../components/Layout.tsx";
import {
  type ActivityEntry,
  getRecentActivity,
} from "../../lib/activityLog.ts";
import type { Session } from "../../lib/auth.ts";

interface ActivityPageData {
  entries: ActivityEntry[];
  allEntries: ActivityEntry[];
  userFilter: string;
  users: string[];
  session: Session;
}

export const handler = {
  async GET(ctx) {
    const session = ctx.state.session as Session;
    if (session.role !== "admin") {
      return new Response(null, {
        status: 302,
        headers: { location: "/admin/admin-panel" },
      });
    }
    const url = new URL(ctx.req.url);
    const userFilter = url.searchParams.get("user")?.trim() ?? "";
    const allEntries = await getRecentActivity(500);
    const users = [...new Set(allEntries.map((e) => e.username))].sort();
    const entries = userFilter
      ? allEntries.filter((e) => e.username === userFilter)
      : allEntries.slice(0, 200);
    return page({ entries, allEntries, userFilter, users, session });
  },
};

function actionBadge(action: string) {
  if (action.includes("deleted") || action.includes("delete")) {
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  }
  if (action.includes("created") || action.includes("imported")) {
    return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
  }
  if (action.includes("updated") || action.includes("password")) {
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
  }
  if (action.includes("login") || action.includes("logout")) {
    return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  }
  return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function ActivityPage({ data }: PageProps<ActivityPageData>) {
  const { entries, userFilter, users, session } = data;

  return (
    <Layout
      username={session.username}
      role={session.role}
      title="Activity Log"
    >
      <div class="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
              📋 Activity Log
            </h1>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {userFilter
                ? `${entries.length} event${entries.length !== 1 ? "s" : ""} for ${userFilter}`
                : `Last ${entries.length} events (90-day rolling window)`}
            </p>
          </div>
          <a
            href="/admin/admin-panel"
            class="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
          >
            ← Back to Admin
          </a>
        </div>

        {/* User filter */}
        <div class="mb-6 flex items-center gap-3 flex-wrap">
          <form method="get" class="flex items-center gap-2">
            <label
              for="user-filter"
              class="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Filter by user:
            </label>
            <select
              id="user-filter"
              name="user"
              class="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
              onChange={(e) => (e.currentTarget.form as HTMLFormElement).submit()}
            >
              <option value="" selected={!userFilter}>All users</option>
              {users.map((u) => (
                <option key={u} value={u} selected={u === userFilter}>
                  {u}
                </option>
              ))}
            </select>
          </form>
          {userFilter && (
            <a
              href="/admin/activity"
              class="text-sm text-purple-600 dark:text-purple-400 hover:underline"
            >
              ✕ Clear filter
            </a>
          )}
        </div>
        {entries.length === 0
          ? (
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400 dark:text-gray-500">
              {userFilter
                ? `No activity found for "${userFilter}".`
                : "No activity recorded yet."}
            </div>
          )
          : (
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Desktop table */}
              <div class="hidden md:block overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th class="px-4 py-3 text-left">Time</th>
                      <th class="px-4 py-3 text-left">User</th>
                      <th class="px-4 py-3 text-left">Action</th>
                      <th class="px-4 py-3 text-left">Resource</th>
                      <th class="px-4 py-3 text-left">Details</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                    {entries.map((e) => (
                      <tr
                        key={e.id}
                        class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      >
                        <td class="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono text-xs">
                          {formatDate(e.timestamp)}
                        </td>
                        <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {e.username}
                        </td>
                        <td class="px-4 py-3">
                          <span
                            class={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              actionBadge(e.action)
                            }`}
                          >
                            {e.action}
                          </span>
                        </td>
                        <td class="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {e.resource ?? "—"}
                          {e.resourceId && (
                            <span class="ml-1 text-xs text-gray-400 dark:text-gray-500 font-mono">
                              ({e.resourceId.slice(0, 8)}…)
                            </span>
                          )}
                        </td>
                        <td class="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                          {e.details ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <ul class="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
                {entries.map((e) => (
                  <li key={e.id} class="px-4 py-3 space-y-1">
                    <div class="flex items-center justify-between gap-2 flex-wrap">
                      <span
                        class={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          actionBadge(e.action)
                        }`}
                      >
                        {e.action}
                      </span>
                      <span class="text-xs text-gray-400 dark:text-gray-500 font-mono">
                        {formatDate(e.timestamp)}
                      </span>
                    </div>
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      {e.username}
                    </p>
                    {(e.resource ?? e.details) && (
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        {e.resource}
                        {e.resource && e.details ? " — " : ""}
                        {e.details}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
      </div>
    </Layout>
  );
}
