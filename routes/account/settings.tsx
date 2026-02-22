// Account settings — any logged-in user can change their own password
import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../components/Layout.tsx";
import PasswordInput from "../../islands/PasswordInput.tsx";
import {
  verifyPassword,
  updateUserPassword,
  deleteAllSessionsForUser,
  createSession,
  makeSessionCookie,
  validatePassword,
  type Session,
} from "../../lib/auth.ts";

interface AccountData {
  session: Session;
  csrfToken: string;
  message?: string;
  error?: string;
}

export const handler: Handlers<AccountData> = {
  GET(req, ctx) {
    const session = ctx.state.session as Session;
    const changed = new URL(req.url).searchParams.has("changed");
    return ctx.render({
      session,
      csrfToken: session.csrfToken,
      message: changed ? "Password updated successfully." : undefined,
    });
  },

  async POST(req, ctx) {
    const session = ctx.state.session as Session;

    // Dev bypass sessions don't have a real user in KV
    if (session.id === "local-dev") {
      return ctx.render({ session, csrfToken: session.csrfToken, error: "Password changes are not available in local dev mode." });
    }

    const form = await req.formData();

    // CSRF validation
    const csrfToken = form.get("csrf_token") as string;
    if (!csrfToken || csrfToken !== session.csrfToken) {
      return ctx.render({ session, csrfToken: session.csrfToken, error: "Invalid request. Please try again." });
    }

    const currentPassword = form.get("currentPassword") as string ?? "";
    const newPassword = form.get("newPassword") as string ?? "";
    const confirmPassword = form.get("confirmPassword") as string ?? "";

    try {
      if (!currentPassword || !newPassword || !confirmPassword) {
        throw new Error("All fields are required.");
      }
      const pwErr = validatePassword(newPassword);
      if (pwErr) throw new Error(pwErr);
      if (newPassword !== confirmPassword) {
        throw new Error("New passwords do not match.");
      }

      // Verify current password
      const { getUserByUsername } = await import("../../lib/auth.ts");
      const user = await getUserByUsername(session.username);
      const result = user ? await verifyPassword(currentPassword, user.passwordHash) : { valid: false };
      if (!user || !result.valid) {
        throw new Error("Current password is incorrect.");
      }

      await updateUserPassword(session.username, newPassword);
      // Invalidate all existing sessions (security: force re-login everywhere)
      await deleteAllSessionsForUser(user.id);
      // Re-issue a fresh session for this user so they stay logged in
      const newSession = await createSession(user);
      const headers = new Headers({ "set-cookie": makeSessionCookie(newSession.id) });
      return new Response(
        null,
        {
          status: 303,
          headers: Object.assign(headers, { location: "/account/settings?changed=1" }),
        },
      );
    } catch (err) {
      return ctx.render({ session, csrfToken: session.csrfToken, error: (err as Error).message });
    }
  },
};

export default function AccountPage({ data }: PageProps<AccountData>) {
  const { session, csrfToken, message, error } = data;

  return (
    <Layout title="Account Settings" username={session.username} role={session.role}>
      <div class="max-w-lg">
        <div class="mb-6">
          <p class="text-gray-600 dark:text-gray-400">Manage your account credentials</p>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 class="text-base font-semibold text-gray-800 dark:text-purple-100 mb-1">Signed in as</h2>
          <div class="flex items-center gap-2 mt-2">
            <span class="text-gray-700 dark:text-gray-200 font-medium">👤 {session.username}</span>
            <span class={`text-xs px-2 py-0.5 rounded-full font-medium ${
              session.role === "admin"
                ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200"
                : session.role === "editor"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            }`}>
              {session.role}
            </span>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <h2 class="text-base font-semibold text-gray-800 dark:text-purple-100 mb-4">Change Password</h2>

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

          <form method="POST" class="space-y-4">
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="currentPassword">
                Current password
              </label>
              <PasswordInput
                id="currentPassword"
                name="currentPassword"
                autocomplete="current-password"
                required
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="newPassword">
                New password
              </label>
              <PasswordInput
                id="newPassword"
                name="newPassword"
                autocomplete="new-password"
                required
                minLength={12}
                maxLength={128}
                placeholder="Min 12 characters"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="confirmPassword">
                Confirm new password
              </label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                autocomplete="new-password"
                required
                minLength={12}
                maxLength={128}
              />
            </div>
            <button
              type="submit"
              class="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              Update Password
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
