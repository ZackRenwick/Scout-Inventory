import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../components/Layout.tsx";
import {
  getAllFeedbackRequests,
  reviewFeedbackRequest,
} from "../../db/kv.ts";
import type { FeedbackRequest } from "../../types/feedback.ts";
import type { Session } from "../../lib/auth.ts";
import { forbidden } from "../../lib/auth.ts";
import { logActivity } from "../../lib/activityLog.ts";
import FeedbackScreenshot from "../../islands/FeedbackScreenshot.tsx";

interface AdminFeedbackData {
  session: Session;
  csrfToken: string;
  requests: FeedbackRequest[];
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
    ...overrides,
  };
}

export const handler: Handlers<AdminFeedbackData> = {
  async GET(_req, ctx) {
    const session = ctx.state.session as Session;
    if (session.role !== "admin") return forbidden();
    return ctx.render(await renderPage(session));
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
        action === "accept" ? "accepted" : action === "complete" ? "completed" : "rejected",
        session.username,
        reason || null,
      );
      if (!updated) throw new Error("Request not found.");

      await logActivity({
        username: session.username,
        action: "feedback.reviewed",
        resource: updated.title,
        resourceId: updated.id,
        details: `${updated.status}${updated.reviewReason ? ` · ${updated.reviewReason}` : ""}`,
      });

      return ctx.render(
        await renderPage(session, {
          message: `Request “${updated.title}” marked ${updated.status}.`,
        }),
      );
    } catch (err) {
      return ctx.render(
        await renderPage(session, {
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

export default function AdminFeedbackPage({ data }: PageProps<AdminFeedbackData>) {
  const { session, csrfToken, requests, message, error } = data;
  const pending = requests.filter((request) => request.status === "pending");
  const reviewed = requests.filter((request) => request.status !== "pending");

  return (
    <Layout title="Feedback Review" username={session.username} role={session.role}>
      <div class="space-y-6">
        <div>
          <p class="text-gray-600 dark:text-gray-400">
            Review feature requests and bug reports submitted by users. You can accept, complete, or reject requests.
          </p>
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
          <h2 class="text-base font-semibold text-gray-800 dark:text-purple-100 mb-4">⏳ Pending Review</h2>
          {pending.length === 0
            ? <p class="text-sm text-gray-500 dark:text-gray-400">No pending requests.</p>
            : (
              <div class="space-y-4">
                {pending.map((request) => (
                  <article class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div class="flex flex-wrap items-center gap-2 mb-2">
                      <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">{request.title}</span>
                      <span class={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClasses(request.status)}`}>
                        {statusLabel(request.status)}
                      </span>
                      <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {request.kind}
                      </span>
                      <span class="text-xs text-gray-400 dark:text-gray-500">by {request.createdBy}</span>
                    </div>
                    <p class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{request.description}</p>
                    {request.photoId && (
                      <div class="mt-4">
                        <FeedbackScreenshot
                          src={getFeedbackPhotoUrl(request.photoId)}
                          alt={`Screenshot for ${request.title}`}
                        />
                      </div>
                    )}
                    <p class="mt-3 text-xs text-gray-400 dark:text-gray-500">
                      Submitted {new Date(request.createdAt).toLocaleString()}
                    </p>

                    <div class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <form method="POST" class="rounded-md border border-green-200 dark:border-green-900 p-3 bg-green-50/60 dark:bg-green-950/20">
                        <input type="hidden" name="csrf_token" value={csrfToken} />
                        <input type="hidden" name="requestId" value={request.id} />
                        <input type="hidden" name="action" value="accept" />
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Optional note</label>
                        <textarea
                          name="reason"
                          rows={3}
                          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md text-sm focus:ring-2 focus:ring-green-500"
                          placeholder="Optional implementation note"
                        />
                        <button type="submit" class="mt-3 px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-md text-sm font-medium transition-colors">
                          Accept Request
                        </button>
                      </form>

                      <form method="POST" class="rounded-md border border-red-200 dark:border-red-900 p-3 bg-red-50/60 dark:bg-red-950/20">
                        <input type="hidden" name="csrf_token" value={csrfToken} />
                        <input type="hidden" name="requestId" value={request.id} />
                        <input type="hidden" name="action" value="reject" />
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rejection reason</label>
                        <textarea
                          name="reason"
                          rows={3}
                          required
                          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md text-sm focus:ring-2 focus:ring-red-500"
                          placeholder="Explain why this is being rejected"
                        />
                        <button type="submit" class="mt-3 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-md text-sm font-medium transition-colors">
                          Reject Request
                        </button>
                      </form>
                    </div>
                  </article>
                ))}
              </div>
            )}
        </section>

        <section class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <h2 class="text-base font-semibold text-gray-800 dark:text-purple-100 mb-4">Reviewed Requests</h2>
          {reviewed.length === 0
            ? <p class="text-sm text-gray-500 dark:text-gray-400">No reviewed requests yet.</p>
            : (
              <div class="space-y-4">
                {reviewed.map((request) => (
                  <article class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div class="flex flex-wrap items-center gap-2 mb-2">
                      <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">{request.title}</span>
                      <span class={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClasses(request.status)}`}>
                        {statusLabel(request.status)}
                      </span>
                      <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {request.kind}
                      </span>
                    </div>
                    <p class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{request.description}</p>
                    {request.photoId && (
                      <div class="mt-4">
                        <FeedbackScreenshot
                          src={getFeedbackPhotoUrl(request.photoId)}
                          alt={`Screenshot for ${request.title}`}
                        />
                      </div>
                    )}
                    <p class="mt-3 text-xs text-gray-400 dark:text-gray-500">
                      Submitted by {request.createdBy} on {new Date(request.createdAt).toLocaleString()}
                    </p>
                    <div class="mt-3 rounded-md bg-gray-50 dark:bg-gray-900/40 p-3">
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        Reviewed by {request.reviewedBy} on {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "-"}
                      </p>
                      {request.reviewReason && (
                        <p class="mt-1 text-sm text-gray-700 dark:text-gray-200">{request.reviewReason}</p>
                      )}
                    </div>
                    {request.status === "accepted" && (
                      <form method="POST" class="mt-3 rounded-md border border-blue-200 dark:border-blue-900 p-3 bg-blue-50/60 dark:bg-blue-950/20">
                        <input type="hidden" name="csrf_token" value={csrfToken} />
                        <input type="hidden" name="requestId" value={request.id} />
                        <input type="hidden" name="action" value="complete" />
                        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Completion note (optional)</label>
                        <textarea
                          name="reason"
                          rows={2}
                          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="Optional release details"
                        />
                        <button type="submit" class="mt-3 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-md text-sm font-medium transition-colors">
                          Mark as Completed
                        </button>
                      </form>
                    )}
                  </article>
                ))}
              </div>
            )}
        </section>
      </div>
    </Layout>
  );
}
