// Delete button with inline confirmation for the item detail page
import { useSignal } from "@preact/signals";

interface Props {
  itemId: string;
  itemName: string;
  csrfToken: string;
}

export default function ItemDeleteButton(
  { itemId, itemName, csrfToken }: Props,
) {
  const confirming = useSignal(false);
  const deleting = useSignal(false);

  async function handleDelete() {
    deleting.value = true;
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: "DELETE",
        headers: { "X-CSRF-Token": csrfToken },
      });
      if (res.ok) {
        globalThis.location.href = "/inventory";
      } else {
        alert("Failed to delete item");
        deleting.value = false;
      }
    } catch {
      alert("Network error — could not delete item");
      deleting.value = false;
    }
  }

  if (!confirming.value) {
    return (
      <button
        type="button"
        onClick={() => confirming.value = true}
        class="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 font-medium rounded-md hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
      >
        🗑️ Delete
      </button>
    );
  }

  return (
    <div class="w-full sm:w-auto px-4 py-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg">
      <p class="text-xs font-medium text-red-700 dark:text-red-300 mb-2">
        Permanently delete <strong>{itemName}</strong>? This cannot be undone.
      </p>
      <div class="flex items-center gap-2">
        <button
          type="button"
          disabled={deleting.value}
          onClick={handleDelete}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors"
        >
          {deleting.value ? "Deleting…" : "🗑️ Delete permanently"}
        </button>
        <button
          type="button"
          disabled={deleting.value}
          onClick={() => confirming.value = false}
          class="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
