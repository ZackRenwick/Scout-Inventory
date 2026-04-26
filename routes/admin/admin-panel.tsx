// Admin — manage users (admin role only)
import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../components/Layout.tsx";
import BackupButtons from "../../islands/BackupButtons.tsx";
import NotificationButtons from "../../islands/NotificationButtons.tsx";
import RestoreBackupForm from "../../islands/RestoreBackupForm.tsx";
import BulkImport from "../../islands/BulkImport.tsx";
import TemplateBulkImport from "../../islands/TemplateBulkImport.tsx";
import RebuildIndexes from "../../islands/RebuildIndexes.tsx";
import DbCleanup from "../../islands/DbCleanup.tsx";
import DbClear from "../../islands/DbClear.tsx";
import PasswordInput from "../../islands/PasswordInput.tsx";
import ConfirmDeleteForm from "../../islands/ConfirmDeleteForm.tsx";
import { getLatestInventoryBackup } from "../../lib/inventoryBackups.ts";
import {
  getAllUsers,
  createUser,
  deleteUser,
  updateUserPassword,
  updateUserRole,
  deleteAllSessionsForUser,
  getUserByUsername,
  validatePassword,
  type User,
  type Session,
} from "../../lib/auth.ts";
import { logActivity } from "../../lib/activityLog.ts";

interface UsersPageData {
  users: Omit<User, "passwordHash">[];
  session: Session;
  csrfToken: string;
  latestBackup: Awaited<ReturnType<typeof getLatestInventoryBackup>>;
  message?: string;
  error?: string;
}

export const handler: Handlers<UsersPageData> = {
  async GET(_req, ctx) {
    const session = ctx.state.session as Session;
    const [users, latestBackup] = await Promise.all([
      getAllUsers(),
      getLatestInventoryBackup(),
    ]);
    return ctx.render({
      users: users.map(({ passwordHash: _ph, ...u }) => u),
      session,
      csrfToken: session.csrfToken,
      latestBackup,
    });
  },

  async POST(req, ctx) {
    const session = ctx.state.session as Session;

    const form = await req.formData();

    // CSRF validation
    const csrfToken = form.get("csrf_token") as string;
    if (!csrfToken || csrfToken !== session.csrfToken) {
      const [users, latestBackup] = await Promise.all([getAllUsers(), getLatestInventoryBackup()]);
      return ctx.render({ users: users.map(({ passwordHash: _ph, ...u }) => u), session, csrfToken: session.csrfToken, latestBackup, error: "Invalid request. Please try again." });
    }

    const action = form.get("action") as string;

    try {
      if (action === "create") {
        const username = (form.get("username") as string ?? "").trim().toLowerCase();
        const password = form.get("password") as string ?? "";
        const role = (form.get("role") as User["role"]) ?? "viewer";

        if (!username || !password) throw new Error("Username and password are required.");
        const createErr = validatePassword(password);
        if (createErr) throw new Error(createErr);

        const allowedRoles: User["role"][] = session.role === "admin"
          ? ["admin", "manager", "editor", "viewer"]
          : ["manager", "editor", "viewer"];
        if (!allowedRoles.includes(role)) throw new Error("You cannot create a user with that role.");

        const existing = await getAllUsers();
        if (existing.some((u) => u.username === username)) throw new Error(`User "${username}" already exists.`);

        await createUser(username, password, role);
        const [users, latestBackup] = await Promise.all([getAllUsers(), getLatestInventoryBackup()]);
        return ctx.render({ users: users.map(({ passwordHash: _ph, ...u }) => u), session, csrfToken: session.csrfToken, latestBackup, message: `User "${username}" created successfully.` });
      }

      if (action === "delete") {
        if (session.role !== "admin") throw new Error("Only admins can delete users.");
        const username = form.get("username") as string;
        if (username === session.username) throw new Error("You cannot delete your own account.");
        const target = await getUserByUsername(username);
        if (target) await deleteAllSessionsForUser(target.id);
        await deleteUser(username);
        const [users, latestBackup] = await Promise.all([getAllUsers(), getLatestInventoryBackup()]);
        return ctx.render({ users: users.map(({ passwordHash: _ph, ...u }) => u), session, csrfToken: session.csrfToken, latestBackup, message: `User "${username}" deleted.` });
      }

      if (action === "change-password") {
        if (session.role !== "admin") throw new Error("Only admins can change other users' passwords.");
        const username = form.get("username") as string;
        const newPassword = form.get("newPassword") as string ?? "";
        const pwErr = validatePassword(newPassword);
        if (pwErr) throw new Error(pwErr);
        await updateUserPassword(username, newPassword);
        // Invalidate all active sessions for this user
        const target = await getUserByUsername(username);
        if (target) await deleteAllSessionsForUser(target.id);
        await logActivity({ username: session.username, action: "user.password_changed", resource: username });
        const [users, latestBackup] = await Promise.all([getAllUsers(), getLatestInventoryBackup()]);
        return ctx.render({ users: users.map(({ passwordHash: _ph, ...u }) => u), session, csrfToken: session.csrfToken, latestBackup, message: `Password updated for "${username}". Their active sessions have been invalidated.` });
      }

      if (action === "change-role") {
        const username = form.get("username") as string;
        const role = form.get("role") as User["role"];
        if (username === session.username) throw new Error("You cannot change your own role.");
        if (!["admin", "manager", "editor", "viewer"].includes(role)) throw new Error("Invalid role.");
        // Managers cannot assign admin role or modify admin users
        if (session.role === "manager") {
          if (role === "admin") throw new Error("Managers cannot assign the admin role.");
          const target = await getUserByUsername(username);
          if (target?.role === "admin") throw new Error("Managers cannot modify admin users.");
        }
        await updateUserRole(username, role);
        // Invalidate sessions so the new role takes effect immediately
        const target = await getUserByUsername(username);
        if (target) await deleteAllSessionsForUser(target.id);
        await logActivity({ username: session.username, action: "user.role_changed", resource: username, details: role });
        const [users, latestBackup] = await Promise.all([getAllUsers(), getLatestInventoryBackup()]);
        return ctx.render({ users: users.map(({ passwordHash: _ph, ...u }) => u), session, csrfToken: session.csrfToken, latestBackup, message: `Role for "${username}" changed to ${role}.` });
      }
    } catch (err) {
      const [users, latestBackup] = await Promise.all([getAllUsers(), getLatestInventoryBackup()]);
      return ctx.render({ users: users.map(({ passwordHash: _ph, ...u }) => u), session, csrfToken: session.csrfToken, latestBackup, error: (err as Error).message });
    }

    const [users, latestBackup] = await Promise.all([getAllUsers(), getLatestInventoryBackup()]);
    return ctx.render({ users: users.map(({ passwordHash: _ph, ...u }) => u), session, csrfToken: session.csrfToken, latestBackup });
  },
};

export default function UsersPage({ data }: PageProps<UsersPageData>) {
  const { users, session, csrfToken, latestBackup, message, error } = data;
  const isAdmin = session.role === "admin";

  return (
    <Layout title="User Management" username={session.username} role={session.role}>
      <div class="mb-6">
        <p class="text-gray-600 dark:text-gray-400">Manage who can access the inventory system</p>
      </div>

      {/* Notifications — admin only */}
      {isAdmin && (
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <h2 class="text-base font-semibold text-gray-800 dark:text-purple-100 mb-1">🔔 Notifications</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Manually trigger alert emails. Requires <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">RESEND_API_KEY</code> and <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">NOTIFY_EMAIL</code> to be configured.
        </p>
        <div class="flex flex-wrap gap-3 mb-3">
          <NotificationButtons csrfToken={csrfToken} />
        </div>
      </div>
      )}

      {isAdmin && (
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <h2 class="text-base font-semibold text-gray-800 dark:text-purple-100 mb-1">🗄️ Backups</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Create an on-demand JSON snapshot of inventory data in R2. Weekly backups can also run automatically when
          <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs ml-1">ENABLE_INVENTORY_BACKUP_CRON</code>
          is enabled.
        </p>
        <BackupButtons csrfToken={csrfToken} latestBackup={latestBackup} />
        <RestoreBackupForm csrfToken={csrfToken} />
      </div>
      )}

      {/* Stock-take */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <h2 class="text-base font-semibold text-gray-800 dark:text-purple-100 mb-1">📋 Stock-take</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Walk the store, physically count each item, and apply corrections. Items are ordered by location
          so you can move through the store systematically. A discrepancy report is shown before any changes are applied.
        </p>
        <a
          href="/admin/stocktake"
          class="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          📋 Start Stock-take
        </a>
      </div>

      {/* Exports */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <h2 class="text-base font-semibold text-gray-800 dark:text-purple-100 mb-1">📊 Reports &amp; Exports</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Export the full inventory as a CSV file. Opens directly in Excel, LibreOffice, or Google Sheets. All categories and fields are included.</p>
        <div class="flex flex-wrap gap-3">
          <a
            href="/admin/export"
            class="inline-flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            📥 Download Inventory CSV
          </a>
          {isAdmin && (
          <a
            href="/admin/export-json"
            class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            📦 Download Inventory JSON
          </a>
          )}
          {isAdmin && (
          <a
            href="/admin/export-templates-json"
            class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg border border-indigo-500 shadow-sm transition-colors"
          >
            📋 Download Camp Templates JSON
          </a>
          )}
          {isAdmin && (
          <a
            href="/admin/activity"
            class="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            📋 Activity Log
          </a>
          )}
        </div>
        {isAdmin && (
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">Inventory JSON and camp templates JSON can both be re-uploaded from the import section below.</p>
        )}
      </div>

      {/* Bulk Import — admin only */}
      {isAdmin && (
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <h2 class="text-base font-semibold text-gray-800 dark:text-purple-100 mb-1">📤 Bulk Import</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">
          Import multiple inventory items at once by uploading a <strong>.json</strong> file.
          All items are validated before any are saved — if any row has an error, the whole import is rejected.
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Maximum 500 items per upload. Remove the <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">"_comment"</code> fields before uploading.
        </p>
        <a
          href="/inventory-import-template.json"
          download
          class="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors mb-4"
        >
          📄 Download JSON Template
        </a>
        <a
          href="/first-aid"
          class="ml-2 inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-200 text-sm font-medium rounded-lg transition-colors mb-4"
        >
          🩹 Manage First Aid Kits
        </a>
        <a
          href="/first-aid/print"
          target="_blank"
          rel="noopener noreferrer"
          class="ml-2 inline-flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors mb-4"
        >
          Print First Aid Bag Inserts
        </a>

        <BulkImport csrfToken={csrfToken} />

        <div class="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Camp Templates Import</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Upload templates exported from <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">Download Camp Templates JSON</code>.
            All templates are validated before anything is saved.
          </p>
          <a
            href="/camp-templates-import-template.json"
            download
            class="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors mb-3"
          >
            📄 Download Camp Templates Import Sample
          </a>
          <TemplateBulkImport csrfToken={csrfToken} />
        </div>
      </div>
      )}

      {/* Database Maintenance — admin only */}
      {isAdmin && (
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <h2 class="text-base font-semibold text-gray-800 dark:text-purple-100 mb-1">🛠️ Database Maintenance</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Rebuilds all KV secondary indexes and precomputed stats from the primary item data.
          Only needed after a manual data migration or if stats appear incorrect.
        </p>
        <RebuildIndexes csrfToken={csrfToken} />
      </div>
      )}

      {/* Clear All Data — admin only */}
      {isAdmin && (
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-red-200 dark:border-red-900 p-6 mb-8">
          <h2 class="text-base font-semibold text-red-700 dark:text-red-400 mb-1">
            🗑️ Clear All Data
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Permanently deletes all inventory items and resets the necker count
            and computed stats to zero. Loans, camp plans, meals, user accounts,
            and the activity log are not affected.
          </p>
          <DbClear csrfToken={csrfToken} />
        </div>
      )}

      {/* Database Cleanup — admin only */}
      {isAdmin && (
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <h2 class="text-base font-semibold text-gray-800 dark:text-purple-100 mb-1">🧹 Database Cleanup</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">
          Removes stale data that accumulates over time:
        </p>
        <ul class="text-sm text-gray-500 dark:text-gray-400 list-disc list-inside mb-4 space-y-1">
          <li>Orphaned secondary index entries (pointing to deleted items)</li>
          <li>Returned loan records older than 6 months</li>
          <li>Orphaned session index entries (TTL-expired sessions)</li>
        </ul>
        <DbCleanup csrfToken={csrfToken} />
      </div>
      )}

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
              {/* Left: identity */}
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-medium text-gray-800 dark:text-gray-100">👤 {user.username}</span>
                  <span class={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    user.role === "admin"
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200"
                      : user.role === "manager"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200"
                      : user.role === "editor"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  }`}>
                    {user.role}
                  </span>
                  {user.username === session.username && (
                    <span class="text-xs text-gray-400 dark:text-gray-500 italic">(you)</span>
                  )}
                </div>
                <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Member since {new Date(user.createdAt).toLocaleDateString()}
                </div>
              </div>

              {/* Right: actions */}
              <div class="flex flex-wrap items-center gap-2 shrink-0">
                {/* Role change */}
                {user.username !== session.username && !(session.role === "manager" && user.role === "admin") && (
                  <form method="POST" class="flex items-center gap-1.5">
                    <input type="hidden" name="csrf_token" value={csrfToken} />
                    <input type="hidden" name="action" value="change-role" />
                    <input type="hidden" name="username" value={user.username} />
                    <select
                      name="role"
                      defaultValue={user.role}
                      class="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    >
                      <option value="viewer">viewer</option>
                      <option value="explorer">explorer</option>
                      <option value="editor">editor</option>
                      <option value="manager">manager</option>
                      {isAdmin && <option value="admin">admin</option>}
                    </select>
                    <button
                      type="submit"
                      class="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md font-medium transition-colors"
                    >
                      Save role
                    </button>
                  </form>
                )}

                {/* Divider */}
                {user.username !== session.username && !(session.role === "manager" && user.role === "admin") && (
                  <span class="hidden sm:block text-gray-300 dark:text-gray-600 select-none">|</span>
                )}

                {/* Change password — admin only */}
                {isAdmin && (
                <details class="relative">
                  <summary class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer list-none select-none transition-colors">
                    Change password
                  </summary>
                  <form method="POST" class="absolute right-0 mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-xl z-10 w-64">
                    <p class="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-3">Change password for <span class="text-purple-600 dark:text-purple-300">{user.username}</span></p>
                    <input type="hidden" name="csrf_token" value={csrfToken} />
                    <input type="hidden" name="action" value="change-password" />
                    <input type="hidden" name="username" value={user.username} />
                    <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">New password</label>
                    <div class="mb-3">
                      <PasswordInput
                        id={`npw-${user.id}`}
                        name="newPassword"
                        autocomplete="new-password"
                        required
                        minLength={12}
                        maxLength={128}
                        placeholder="Min 12 characters"
                        inputClass="w-full px-2 py-1.5 pr-8 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-md focus:ring-1 focus:ring-purple-500"
                        buttonClass="absolute inset-y-0 right-0 px-2 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      />
                    </div>
                    <button type="submit" class="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors">
                      Update password
                    </button>
                  </form>
                </details>
                )}

                {isAdmin && user.username !== session.username && (
                  <ConfirmDeleteForm csrfToken={csrfToken} username={user.username} />
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
              <PasswordInput
                id="createPw"
                name="password"
                autocomplete="new-password"
                required
                minLength={12}
                maxLength={128}
                placeholder="Min 12 characters"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
              <select
                name="role"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              >
                <option value="viewer">Viewer — read only</option>
                <option value="explorer">Explorer — inventory only (no first aid / risk)</option>
                <option value="editor">Editor — manage inventory</option>
                <option value="manager">Manager — stock-take, exports &amp; users</option>
                {isAdmin && <option value="admin">Admin — full access</option>}
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
