// Delete-user form with an inline confirmation step
import { useState } from "preact/hooks";

interface Props {
  csrfToken: string;
  username: string;
}

export default function ConfirmDeleteForm({ csrfToken, username }: Props) {
  const [confirming, setConfirming] = useState(false);

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
    <div class="flex items-center gap-2">
      <span class="text-xs text-gray-600 dark:text-gray-400">Sure?</span>
      <form method="POST" class="inline">
        <input type="hidden" name="csrf_token" value={csrfToken} />
        <input type="hidden" name="action" value="delete" />
        <input type="hidden" name="username" value={username} />
        <button type="submit" class="text-xs text-red-600 dark:text-red-400 font-semibold hover:underline">
          Yes
        </button>
      </form>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        class="text-xs text-gray-500 dark:text-gray-400 hover:underline"
      >
        No
      </button>
    </div>
  );
}

