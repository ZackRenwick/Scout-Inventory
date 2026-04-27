import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../components/Layout.tsx";
import {
  createFeedbackRequest,
  getFeedbackRequestsByUsername,
} from "../../db/kv.ts";
import type { FeedbackKind, FeedbackRequest } from "../../types/feedback.ts";
import type { Session } from "../../lib/auth.ts";
import { logActivity } from "../../lib/activityLog.ts";
import { isR2Configured } from "../../lib/r2Photos.ts";
import FeedbackFormClient from "../../islands/FeedbackFormClient.tsx";
import FeedbackScreenshot from "../../islands/FeedbackScreenshot.tsx";

interface FeedbackPageData {
  session: Session;
  csrfToken: string;
  requests: FeedbackRequest[];
  r2Configured: boolean;
  message?: string;
  error?: string;
  form?: {
    kind?: FeedbackKind;
    title?: string;
    description?: string;
    photoId?: string;
  };
}

async function renderPage(
  session: Session,
  overrides: Partial<FeedbackPageData> = {},
): Promise<FeedbackPageData> {
  const requests = await getFeedbackRequestsByUsername(session.username);
  return {
    session,
    csrfToken: session.csrfToken,
    requests,
    r2Configured: isR2Configured(),
    ...overrides,
  };
}

export const handler: Handlers<FeedbackPageData> = {
  async GET(req, ctx) {
    const session = ctx.state.session as Session;
    const submitted = new URL(req.url).searchParams.has("submitted");
    return ctx.render(
      await renderPage(session, {
        message: submitted
          ? "Your request has been submitted for admin review."
          : undefined,
      }),
    );
  },

  async POST(req, ctx) {
    const session = ctx.state.session as Session;
    const form = await req.formData();

    const csrfToken = form.get("csrf_token") as string;
    if (!csrfToken || csrfToken !== session.csrfToken) {
      return ctx.render(
        await renderPage(session, {
          error: "Invalid request. Please try again.",
        }),
      );
    }

    const kind = (form.get("kind") as FeedbackKind | null) ?? "feature";
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const photoId = kind === "bug"
      ? (String(form.get("photoId") ?? "").trim() || undefined)
      : undefined;

    try {
      if (!["feature", "bug"].includes(kind)) {
        throw new Error("Please choose feature request or bug report.");
      }
      if (title.length < 5 || title.length > 120) {
        throw new Error("Title must be between 5 and 120 characters.");
      }
      if (description.length < 20 || description.length > 4000) {
        throw new Error("Details must be between 20 and 4000 characters.");
      }

      const created = await createFeedbackRequest(
        { kind, title, description, ...(photoId && { photoId }) },
        session.username,
      );
      await logActivity({
        username: session.username,
        action: "feedback.submitted",
        resource: created.title,
        resourceId: created.id,
        details: created.kind,
      });

      const headers = new Headers({
        location: "/account/feedback?submitted=1",
      });
      return new Response(null, { status: 303, headers });
    } catch (err) {
      return ctx.render(
        await renderPage(session, {
          error: (err as Error).message,
          form: { kind, title, description, photoId },
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

export default function FeedbackPage({ data }: PageProps<FeedbackPageData>) {
  const { session, csrfToken, requests, r2Configured, message, error, form } =
    data;

  return (
    <Layout
      title="Feature Requests & Bug Reports"
      username={session.username}
      role={session.role}
    >
      <div class="max-w-4xl space-y-6">
        <div>
          <p class="text-gray-600 dark:text-gray-400">
            Submit an improvement idea or bug report. Admins can accept,
            complete, or reject it, and reviewed requests include notes.
          </p>
          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Flow: submitted <span class="mx-1">→</span> reviewed{" "}
            <span class="mx-1">→</span> completed or rejected.
          </p>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <h2 class="text-base font-semibold text-gray-800 dark:text-purple-100 mb-4">
            Submit New Request
          </h2>

          {message && (
            <div class="mb-4 p-3 bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700 rounded-lg text-green-800 dark:text-green-200 text-sm">
              ✅ {message}
            </div>
          )}
          {error && (
            <div class="mb-4 p-3 bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200 text-sm">
              ❌ {error}
            </div>
          )}

          <form id="feedback-form" method="POST" class="space-y-4">
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <select
                name="kind"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                defaultValue={form?.kind ?? "feature"}
              >
                <option value="feature">Feature request</option>
                <option value="bug">Bug report</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title
              </label>
              <input
                type="text"
                name="title"
                required
                minLength={5}
                maxLength={120}
                value={form?.title ?? ""}
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Details
              </label>
              <textarea
                name="description"
                required
                minLength={20}
                maxLength={4000}
                rows={6}
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              >
                {form?.description ?? ""}
              </textarea>
            </div>

            {/* Photo upload — bug reports only, if R2 is configured */}
            {r2Configured && (
              <div
                id="photo-section"
                style="display: none;"
                class="border-t pt-4"
              >
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  📸 Screenshot (optional)
                </label>
                <input
                  type="file"
                  id="photo-input"
                  accept="image/*"
                  class="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:px-3 file:py-2 file:bg-purple-100 dark:file:bg-purple-900/40 file:text-purple-700 dark:file:text-purple-300 file:border-0 file:rounded-md file:text-sm file:font-medium cursor-pointer"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  JPEG, PNG, or WebP • max 10MB
                </p>
                <div id="photo-preview" class="mt-3 hidden">
                  <img
                    id="preview-img"
                    alt="Preview"
                    class="max-w-xs rounded-lg border border-purple-300 dark:border-purple-700 shadow-sm object-contain"
                    style="max-height: 240px"
                  />
                  <div class="flex gap-2 mt-2">
                    <span
                      id="upload-status"
                      class="text-xs text-gray-500 dark:text-gray-400"
                    >
                    </span>
                    <button
                      type="button"
                      id="clear-photo-btn"
                      class="px-3 py-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-md transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <input
                  type="hidden"
                  name="photoId"
                  id="photo-id-input"
                  value={form?.photoId ?? ""}
                />
              </div>
            )}

            <button
              type="submit"
              class="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors text-sm"
            >
              Submit for Review
            </button>
          </form>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <h2 class="text-base font-semibold text-gray-800 dark:text-purple-100 mb-4">
            Your Submitted Requests
          </h2>
          {requests.length === 0
            ? (
              <p class="text-sm text-gray-500 dark:text-gray-400">
                You have not submitted any requests yet.
              </p>
            )
            : (
              <div class="space-y-4">
                {requests.map((request) => (
                  <article class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div class="flex flex-wrap items-center gap-2 mb-2">
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
                    </div>
                    <p class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
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
                    <p class="mt-3 text-xs text-gray-400 dark:text-gray-500">
                      Submitted {new Date(request.createdAt).toLocaleString()}
                    </p>
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
                  </article>
                ))}
              </div>
            )}
        </div>
      </div>

      <FeedbackFormClient />
    </Layout>
  );
}
