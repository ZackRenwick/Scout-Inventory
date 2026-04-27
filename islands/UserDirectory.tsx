import { useState, useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { USER_ROLE_META, type User } from "../lib/auth.ts";

// Inlined to avoid island-inside-island (Fresh limitation)
function PasswordInput({
  id = "password",
  name = "password",
  autocomplete = "new-password",
  required = true,
  minLength,
  maxLength,
  placeholder,
  inputClass = "w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm",
  buttonClass = "absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200",
}: {
  id?: string;
  name?: string;
  autocomplete?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  inputClass?: string;
  buttonClass?: string;
}) {
  const visible = useSignal(false);
  return (
    <div class="relative">
      <input
        id={id}
        type={visible.value ? "text" : "password"}
        name={name}
        required={required}
        autocomplete={autocomplete}
        minLength={minLength}
        maxLength={maxLength}
        placeholder={placeholder}
        class={inputClass}
      />
      <button
        type="button"
        onClick={() => { visible.value = !visible.value; }}
        class={buttonClass}
        aria-label={visible.value ? "Hide password" : "Show password"}
      >
        {visible.value ? "🙈" : "👁"}
      </button>
    </div>
  );
}

// Inlined to avoid island-inside-island (Fresh limitation)
function ConfirmDeleteForm({ csrfToken, username }: { csrfToken: string; username: string }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        class="text-sm text-red-600 dark:text-red-400 hover:underline"
      >
        Delete
      </button>
    );
  }

  return (
    <div class="mt-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-3 space-y-2">
      <p class="text-xs font-medium text-red-700 dark:text-red-300">
        This will permanently delete{" "}
        <strong class="font-mono">{username}</strong>. Type their username to confirm:
      </p>
      <div class="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={typed}
          onInput={(e) => setTyped((e.target as HTMLInputElement).value)}
          placeholder={username}
          autoComplete="off"
          class="px-2.5 py-1.5 text-sm font-mono border border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 w-44"
        />
        <form method="POST" class="inline">
          <input type="hidden" name="csrf_token" value={csrfToken} />
          <input type="hidden" name="action" value="delete" />
          <input type="hidden" name="username" value={username} />
          <button
            type="submit"
            disabled={typed !== username}
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
          >
            🗑️ Delete user
          </button>
        </form>
        <button
          type="button"
          onClick={() => { setConfirming(false); setTyped(""); }}
          class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface UserDirectoryProps {
  users: Array<Pick<User, "id" | "username" | "role" | "createdAt">>;
  sessionUsername: string;
  sessionRole: User["role"];
  assignableRoles: readonly User["role"][];
  csrfToken: string;
  isAdmin: boolean;
}

export default function UserDirectory({
  users,
  sessionUsername,
  sessionRole,
  assignableRoles,
  csrfToken,
  isAdmin,
}: UserDirectoryProps) {
  const query = useSignal("");
  const isOpen = useSignal(users.length <= 12);

  useEffect(() => {
    if (query.value.trim().length > 0) {
      isOpen.value = true;
    }
  }, [query.value]);

  const normalizedQuery = query.value.trim().toLowerCase();
  const filteredUsers = normalizedQuery.length === 0
    ? users
    : users.filter((user) =>
      user.username.toLowerCase().includes(normalizedQuery) ||
      user.role.toLowerCase().includes(normalizedQuery)
    );

  const totalCount = users.length;
  const visibleCount = filteredUsers.length;
  const collapseUsersByDefault = totalCount > 12;

  return (
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 mb-8">
      <div class="px-6 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        <label for="users-search" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Search users
        </label>
        <div class="flex items-center gap-2">
          <input
            id="users-search"
            type="search"
            value={query.value}
            onInput={(event) => {
              query.value = (event.currentTarget as HTMLInputElement).value;
            }}
            placeholder="Filter by username or role"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {query.value.length > 0 && (
            <button
              type="button"
              onClick={() => {
                query.value = "";
              }}
              class="px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <details
        open={isOpen.value}
        onToggle={(event) => {
          isOpen.value = (event.currentTarget as HTMLDetailsElement).open;
        }}
      >
        <summary class="px-6 py-4 cursor-pointer flex items-center justify-between gap-3 list-none select-none">
          <h2 class="text-lg font-semibold text-gray-800 dark:text-purple-100">Current Users</h2>
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
            {visibleCount}/{totalCount}
          </span>
        </summary>
        {collapseUsersByDefault && (
          <p class="px-6 pb-3 -mt-1 text-xs text-gray-500 dark:text-gray-400">
            Large user list detected. Use search to quickly find users.
          </p>
        )}

        {visibleCount === 0 ? (
          <p class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
            No users match that search.
          </p>
        ) : (
          <div class="max-h-[28rem] overflow-y-auto border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredUsers.map((user) => (
              <div key={user.id} class="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                    {user.username === sessionUsername && (
                      <span class="text-xs text-gray-400 dark:text-gray-500 italic">(you)</span>
                    )}
                  </div>
                  <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Member since {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2 shrink-0">
                  {user.username !== sessionUsername && !(sessionRole === "manager" && user.role === "admin") && (
                    <form method="POST" class="flex items-center gap-1.5">
                      <input type="hidden" name="csrf_token" value={csrfToken} />
                      <input type="hidden" name="action" value="change-role" />
                      <input type="hidden" name="username" value={user.username} />
                      <select
                        name="role"
                        defaultValue={user.role}
                        class="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md focus:ring-1 focus:ring-purple-500 focus:outline-none"
                      >
                        {assignableRoles.map((roleOption) => (
                          <option value={roleOption}>{USER_ROLE_META[roleOption].label}</option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        class="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md font-medium transition-colors"
                      >
                        Save role
                      </button>
                    </form>
                  )}

                  {user.username !== sessionUsername && !(sessionRole === "manager" && user.role === "admin") && (
                    <span class="hidden sm:block text-gray-300 dark:text-gray-600 select-none">|</span>
                  )}

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

                  {isAdmin && user.username !== sessionUsername && (
                    <ConfirmDeleteForm csrfToken={csrfToken} username={user.username} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </details>
    </div>
  );
}
