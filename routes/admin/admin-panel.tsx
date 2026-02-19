// Admin — manage users (admin role only)
import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../components/Layout.tsx";
import {
  getAllUsers,
  createUser,
  deleteUser,
  updateUserPassword,
  deleteAllSessionsForUser,
  getUserByUsername,
  validatePassword,
  type User,
  type Session,
} from "../../lib/auth.ts";

interface UsersPageData {
  users: Omit<User, "passwordHash">[];
  session: Session;
  csrfToken: string;
  message?: string;
  error?: string;
}

export const handler: Handlers<UsersPageData> = {
  async GET(_req, ctx) {
    const session = ctx.state.session as Session;
    const users = (await getAllUsers()).map(({ passwordHash: _ph, ...u }) => u);
    return ctx.render({ users, session, csrfToken: session.csrfToken });
  },

  async POST(req, ctx) {
    const session = ctx.state.session as Session;

    const form = await req.formData();

    // CSRF validation
    const csrfToken = form.get("csrf_token") as string;
    if (!csrfToken || csrfToken !== session.csrfToken) {
      const users = (await getAllUsers()).map(({ passwordHash: _ph, ...u }) => u);
      return ctx.render({ users, session, csrfToken: session.csrfToken, error: "Invalid request. Please try again." });
    }

    const action = form.get("action") as string;

    try {
      if (action === "create") {
        const username = (form.get("username") as string ?? "").trim().toLowerCase();
        const password = form.get("password") as string ?? "";
        const role = (form.get("role") as "admin" | "viewer") ?? "viewer";

        if (!username || !password) throw new Error("Username and password are required.");
        const createErr = validatePassword(password);
        if (createErr) throw new Error(createErr);

        const existing = await getAllUsers();
        if (existing.some((u) => u.username === username)) throw new Error(`User "${username}" already exists.`);

        await createUser(username, password, role);
        const users = (await getAllUsers()).map(({ passwordHash: _ph, ...u }) => u);
        return ctx.render({ users, session, csrfToken: session.csrfToken, message: `User "${username}" created successfully.` });
      }

      if (action === "delete") {
        const username = form.get("username") as string;
        if (username === session.username) throw new Error("You cannot delete your own account.");
        const target = await getUserByUsername(username);
        if (target) await deleteAllSessionsForUser(target.id);
        await deleteUser(username);
        const users = (await getAllUsers()).map(({ passwordHash: _ph, ...u }) => u);
        return ctx.render({ users, session, csrfToken: session.csrfToken, message: `User "${username}" deleted.` });
      }

      if (action === "change-password") {
        const username = form.get("username") as string;
        const newPassword = form.get("newPassword") as string ?? "";
        const pwErr = validatePassword(newPassword);
        if (pwErr) throw new Error(pwErr);
        await updateUserPassword(username, newPassword);
        // Invalidate all active sessions for this user
        const target = await getUserByUsername(username);
        if (target) await deleteAllSessionsForUser(target.id);
        const users = (await getAllUsers()).map(({ passwordHash: _ph, ...u }) => u);
        return ctx.render({ users, session, csrfToken: session.csrfToken, message: `Password updated for "${username}". Their active sessions have been invalidated.` });
      }
    } catch (err) {
      const users = (await getAllUsers()).map(({ passwordHash: _ph, ...u }) => u);
      return ctx.render({ users, session, csrfToken: session.csrfToken, error: (err as Error).message });
    }

    const users = (await getAllUsers()).map(({ passwordHash: _ph, ...u }) => u);
    return ctx.render({ users, session, csrfToken: session.csrfToken });
  },
};

export default function UsersPage({ data }: PageProps<UsersPageData>) {
  const { users, session, csrfToken, message, error } = data;

  return (
    <Layout title="User Management" username={session.username} role={session.role}>
      <div class="mb-6">
        <p class="text-gray-600 dark:text-gray-400">Manage who can access the inventory system</p>
      </div>

      {/* Exports */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <h2 class="text-base font-semibold text-gray-800 dark:text-purple-100 mb-1">📊 Reports &amp; Exports</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Export the full inventory as a CSV file. Opens directly in Excel, LibreOffice, or Google Sheets. All categories and fields are included.</p>
        <a
          href="/admin/export"
          class="inline-flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-lg transition-colors"
        >
          📥 Download Inventory CSV
        </a>
      </div>

      {message && (
        <div class="mb-6 p-4 bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700 rounded-lg text-green-800 dark:text-green-200 text-sm">
          ✅ {message}
        </div>
      )}
      {error && (
        <div class="mb-6 p-4 bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200 text-sm">
          ❌ {error}
        </div>
      )}

      {/* Existing Users */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 mb-8">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-lg font-semibold text-gray-800 dark:text-purple-100">Current Users</h2>
        </div>
        <div class="divide-y divide-gray-200 dark:divide-gray-700">
          {users.map((user) => (
            <div key={user.id} class="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-800 dark:text-gray-100">👤 {user.username}</span>
                  <span class={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    user.role === "admin"
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200"
                      : user.role === "editor"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  }`}>
                    {user.role}
                  </span>
                  {user.username === session.username && (
                    <span class="text-xs text-gray-400 dark:text-gray-500">(you)</span>
                  )}
                </div>
                <div class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Created {new Date(user.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div class="flex items-center gap-3">
                {/* Change password inline form */}
                <details class="relative">
                  <summary class="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer list-none">
                    Change password
                  </summary>
                  <form method="POST" class="absolute right-0 mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-lg z-10 w-64">
                    <input type="hidden" name="csrf_token" value={csrfToken} />
                    <input type="hidden" name="action" value="change-password" />
                    <input type="hidden" name="username" value={user.username} />
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">New password</label>
                    <div class="relative mb-2">
                      <input
                        type="password"
                        id={`npw-${user.id}`}
                        name="newPassword"
                        required
                        minLength={12}
                        maxLength={128}
                        placeholder="Min 12 characters"
                        class="w-full px-2 py-1.5 pr-8 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded focus:ring-1 focus:ring-purple-500"
                      />
                      <button type="button" {...{"onclick": `togglePw('npw-${user.id}','ntog-${user.id}')`}} class="absolute inset-y-0 right-0 px-2 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Toggle password visibility">
                        <span id={`ntog-${user.id}`}>👁</span>
                      </button>
                    </div>
                    <button type="submit" class="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors">
                      Update
                    </button>
                  </form>
                </details>
                {user.username !== session.username && (
                  <form method="POST" {...{"onsubmit": "return confirm('Delete ' + this.username.value + '?')"}}>
                    <input type="hidden" name="csrf_token" value={csrfToken} />
                    <input type="hidden" name="action" value="delete" />
                    <input type="hidden" name="username" value={user.username} />
                    <button type="submit" class="text-sm text-red-600 dark:text-red-400 hover:underline">
                      Delete
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create New User */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-lg font-semibold text-gray-800 dark:text-purple-100">Add New User</h2>
        </div>
        <form method="POST" class="px-6 py-4">
          <input type="hidden" name="csrf_token" value={csrfToken} />
          <input type="hidden" name="action" value="create" />
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
              <input
                type="text"
                name="username"
                required
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
              <div class="relative">
                <input
                  type="password"
                  id="createPw"
                  name="password"
                  required
                  minLength={12}
                  maxLength={128}
                  placeholder="Min 12 characters"
                  class="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                />
                <button type="button" {...{"onclick": "togglePw('createPw','createPwTog')"}} class="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Toggle password visibility">
                  <span id="createPwTog">👁</span>
                </button>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
              <select
                name="role"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              >
                <option value="viewer">Viewer — read only</option>
                <option value="editor">Editor — manage inventory</option>
                <option value="admin">Admin — full access</option>
              </select>
            </div>
          </div>
          <div class="mt-4">
            <button
              type="submit"
              class="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors text-sm"
            >
              ➕ Create User
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
