// Delete-user form with a prominent confirmation step requiring the username to be typed.
import { useState } from "preact/hooks";

interface Props {
  csrfToken: string;
  username: string;
}

export default function ConfirmDeleteForm({ csrfToken, username }: Props) {
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
        <strong class="font-mono">{username}</strong>. Type their username to
        confirm:
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
          onClick={() => {
            setConfirming(false);
            setTyped("");
          }}
          class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

