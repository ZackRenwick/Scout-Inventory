import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../components/Layout.tsx";
import { getAllFeedbackRequests, reviewFeedbackRequest } from "../../db/kv.ts";
import type { FeedbackRequest } from "../../types/feedback.ts";
import type { Session } from "../../lib/auth.ts";
import { forbidden } from "../../lib/auth.ts";
import { logActivity } from "../../lib/activityLog.ts";
import FeedbackScreenshot from "../../islands/FeedbackScreenshot.tsx";

interface AdminFeedbackData {
  session: Session;
  csrfToken: string;
  requests: FeedbackRequest[];
  activeTab: "all" | FeedbackRequest["status"];
  message?: string;
  error?: string;
}

async function renderPage(
  session: Session,
  overrides: Partial<AdminFeedbackData> = {},
): Promise<AdminFeedbackData> {
  const requests = await getAllFeedbackRequests();
  return {
    session,
    csrfToken: session.csrfToken,
    requests,
    activeTab: "pending",
    ...overrides,
  };
}

export const handler: Handlers<AdminFeedbackData> = {
  async GET(req, ctx) {
    const session = ctx.state.session as Session;
    if (session.role !== "admin") return forbidden();
    const url = new URL(req.url);
    const tab = url.searchParams.get("tab");
    const activeTab =
      tab === "all" || tab === "pending" || tab === "accepted" ||
        tab === "completed" || tab === "rejected"
        ? tab
        : "pending";
    const reviewedStatus = url.searchParams.get("reviewed");
    const reviewed =
      reviewedStatus === "accepted" || reviewedStatus === "completed" ||
        reviewedStatus === "rejected"
        ? `Request marked ${reviewedStatus}.`
        : undefined;
    return ctx.render(
      await renderPage(session, { activeTab, message: reviewed }),
    );
  },

  async POST(req, ctx) {
    const session = ctx.state.session as Session;
    if (session.role !== "admin") return forbidden();

    const form = await req.formData();

    // CSRF validation
    const csrfToken = form.get("csrf_token") as string;
    if (!csrfToken || csrfToken !== session.csrfToken) {
      return ctx.render(
        await renderPage(session, {
          error: "Invalid request. Please try again.",
        }),
      );
    }

    const requestId = String(form.get("requestId") ?? "").trim();
    const action = String(form.get("action") ?? "").trim();
    const reason = String(form.get("reason") ?? "").trim();
    const tab = String(form.get("tab") ?? "pending").trim();
    const activeTab =
      tab === "all" || tab === "pending" || tab === "accepted" ||
        tab === "completed" || tab === "rejected"
        ? tab
        : "pending";

    try {
      if (!requestId) throw new Error("Missing request id.");
      if (action !== "accept" && action !== "complete" && action !== "reject") {
        throw new Error("Invalid review action.");
      }
      if (action === "reject" && !reason) {
        throw new Error("A reason is required when rejecting a request.");
      }

      const updated = await reviewFeedbackRequest(
        requestId,
        action === "accept"
          ? "accepted"
          : action === "complete"
          ? "completed"
          : "rejected",
        session.username,
        reason || null,
      );
      if (!updated) throw new Error("Request not found.");

      await logActivity({
        username: session.username,
        action: "feedback.reviewed",
        resource: updated.title,
        resourceId: updated.id,
        details: `${updated.status}${
          updated.reviewReason ? ` · ${updated.reviewReason}` : ""
        }`,
      });

      const params = new URLSearchParams({
        tab: activeTab,
        reviewed: updated.status,
      });
      const headers = new Headers({
        location: `/admin/feedback?${params.toString()}`,
      });
      return new Response(null, { status: 303, headers });
    } catch (err) {
      return ctx.render(
        await renderPage(session, {
          activeTab,
          error: (err as Error).message,
        }),
      );
    }
  },
};

function statusClasses(status: FeedbackRequest["status"]): string {
  if (status === "pending") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200";
  }
  if (status === "accepted") {
    return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200";
  }
  if (status === "completed") {
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200";
  }
  if (status === "rejected") {
    return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200";
  }
  return "bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-200";
}

function statusLabel(status: FeedbackRequest["status"]): string {
  if (status === "pending") return "⏳ pending";
  if (status === "accepted") return "✅ accepted";
  if (status === "completed") return "🎉 completed";
  if (status === "rejected") return "❌ rejected";
  return status;
}

function getFeedbackPhotoUrl(photoId: string): string {
  return `/api/feedback-photos/${encodeURIComponent(photoId)}`;
}

export default function AdminFeedbackPage(
  { data }: PageProps<AdminFeedbackData>,
) {
  const { session, csrfToken, requests, activeTab, message, error } = data;
  const counts = {
    all: requests.length,
    pending: requests.filter((request) => request.status === "pending").length,
    accepted:
      requests.filter((request) => request.status === "accepted").length,
    completed:
      requests.filter((request) => request.status === "completed").length,
    rejected:
      requests.filter((request) => request.status === "rejected").length,
  };
  const filtered = activeTab === "all"
    ? requests
    : requests.filter((request) => request.status === activeTab);

  return (
    <Layout
      title="Feedback Review"
      username={session.username}
      role={session.role}
    >
      <div class="space-y-6">
        <div>
          <p class="text-gray-600 dark:text-gray-400">
            Review feature requests and bug reports submitted by users. You can
            accept, complete, or reject requests.
          </p>
          {counts.pending > 0 && (
            <p class="mt-2 inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-200">
              {counts.pending} pending request{counts.pending === 1 ? "" : "s"}
              {" "}
              to review
            </p>
          )}
        </div>

        <div class="flex flex-wrap gap-2">
          {([
            ["pending", "Pending"],
            ["accepted", "Accepted"],
            ["completed", "Completed"],
            ["rejected", "Rejected"],
            ["all", "All"],
          ] as const).map(([tab, label]) => (
            <a
              href={`/admin/feedback?tab=${tab}`}
              class={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                activeTab === tab
                  ? "bg-purple-600 border-purple-600 text-white"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-purple-400"
              }`}
            >
              <span>{label}</span>
              <span
                class={`text-xs px-2 py-0.5 rounded-full ${
                  tab === "pending" && counts.pending > 0
                    ? activeTab === tab
                      ? "bg-red-500/90 text-white"
                      : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200"
                    : activeTab === tab
                    ? "bg-white/20"
                    : "bg-gray-100 dark:bg-gray-700"
                }`}
              >
                {counts[tab]}
              </span>
            </a>
          ))}
        </div>

        {message && (
          <div class="p-3 bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700 rounded-lg text-green-800 dark:text-green-200 text-sm">
            ✅ {message}
          </div>
        )}
        {error && (
          <div class="p-3 bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200 text-sm">
            ❌ {error}
          </div>
        )}

        <section class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-gray-800 dark:text-purple-100">
              {activeTab === "all"
                ? "All Requests"
                : `${statusLabel(activeTab)} Requests`}
            </h2>
            <span class="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              {filtered.length} shown
            </span>
          </div>

          {filtered.length === 0
            ? (
              <p class="text-sm text-gray-500 dark:text-gray-400">
                No requests in this tab.
              </p>
            )
            : (
              <div class="space-y-3">
                {filtered.map((request) => (
                  <details class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/30">
                    <summary class="list-none cursor-pointer px-4 py-3">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {request.title}
                        </span>
                        <span
                          class={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            statusClasses(request.status)
                          }`}
                        >
                          {statusLabel(request.status)}
                        </span>
                        <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {request.kind}
                        </span>
                        <span class="text-xs text-gray-400 dark:text-gray-500">
                          by {request.createdBy} ·{" "}
                          {new Date(request.createdAt).toLocaleString()}
                        </span>
                        <span class="ml-auto text-xs text-purple-600 dark:text-purple-300">
                          Details
                        </span>
                      </div>
                    </summary>

                    <div class="px-4 pb-4 border-t border-gray-100 dark:border-gray-800">
                      <p class="mt-3 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                        {request.description}
                      </p>

                      {request.photoId && (
                        <div class="mt-4">
                          <FeedbackScreenshot
                            src={getFeedbackPhotoUrl(request.photoId)}
                            alt={`Screenshot for ${request.title}`}
                          />
                        </div>
                      )}

                      {request.reviewedAt && (
                        <div class="mt-3 rounded-md bg-gray-50 dark:bg-gray-900/40 p-3">
                          <p class="text-xs text-gray-500 dark:text-gray-400">
                            Reviewed by {request.reviewedBy} on{" "}
                            {new Date(request.reviewedAt).toLocaleString()}
                          </p>
                          {request.reviewReason && (
                            <p class="mt-1 text-sm text-gray-700 dark:text-gray-200">
                              {request.reviewReason}
                            </p>
                          )}
                        </div>
                      )}

                      {request.status === "pending" && (
                        <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <form
                            method="POST"
                            class="rounded-md border border-green-200 dark:border-green-900 p-3 bg-green-50/60 dark:bg-green-950/20 space-y-2"
                          >
                            <input
                              type="hidden"
                              name="csrf_token"
                              value={csrfToken}
                            />
                            <input
                              type="hidden"
                              name="requestId"
                              value={request.id}
                            />
                            <input type="hidden" name="action" value="accept" />
                            <input type="hidden" name="tab" value={activeTab} />
                            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">
                              Optional note
                            </label>
                            <input
                              name="reason"
                              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md text-sm focus:ring-2 focus:ring-green-500"
                              placeholder="Optional implementation note"
                            />
                            <button
                              type="submit"
                              class="px-3 py-2 bg-green-700 hover:bg-green-800 text-white rounded-md text-sm font-medium transition-colors"
                            >
                              Accept
                            </button>
                          </form>

                          <form
                            method="POST"
                            class="rounded-md border border-red-200 dark:border-red-900 p-3 bg-red-50/60 dark:bg-red-950/20 space-y-2"
                          >
                            <input
                              type="hidden"
                              name="csrf_token"
                              value={csrfToken}
                            />
                            <input
                              type="hidden"
                              name="requestId"
                              value={request.id}
                            />
                            <input type="hidden" name="action" value="reject" />
                            <input type="hidden" name="tab" value={activeTab} />
                            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">
                              Rejection reason
                            </label>
                            <input
                              name="reason"
                              required
                              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md text-sm focus:ring-2 focus:ring-red-500"
                              placeholder="Required reason"
                            />
                            <button
                              type="submit"
                              class="px-3 py-2 bg-red-700 hover:bg-red-800 text-white rounded-md text-sm font-medium transition-colors"
                            >
                              Reject
                            </button>
                          </form>
                        </div>
                      )}

                      {request.status === "accepted" && (
                        <form
                          method="POST"
                          class="mt-4 rounded-md border border-blue-200 dark:border-blue-900 p-3 bg-blue-50/60 dark:bg-blue-950/20 space-y-2"
                        >
                          <input
                            type="hidden"
                            name="csrf_token"
                            value={csrfToken}
                          />
                          <input
                            type="hidden"
                            name="requestId"
                            value={request.id}
                          />
                          <input type="hidden" name="action" value="complete" />
                          <input type="hidden" name="tab" value={activeTab} />
                          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">
                            Completion note (optional)
                          </label>
                          <input
                            name="reason"
                            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                            placeholder="Optional release details"
                          />
                          <button
                            type="submit"
                            class="px-3 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-md text-sm font-medium transition-colors"
                          >
                            Mark as Completed
                          </button>
                        </form>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            )}
        </section>
      </div>
    </Layout>
  );
}
