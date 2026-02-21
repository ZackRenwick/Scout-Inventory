// Interactive necker counter — quick +/- widget for the dashboard
import { useSignal } from "@preact/signals";

interface NeckerCounterProps {
  initialCount: number;
  csrfToken: string;
  canEdit?: boolean;
}

export default function NeckerCounter({ initialCount, csrfToken, canEdit = true }: NeckerCounterProps) {
  const count = useSignal(initialCount);
  const saving = useSignal(false);
  const error = useSignal<string | null>(null);

  async function adjust(delta: number) {
    if (saving.value) return;
    // Optimistic update — clamp to 0
    const next = Math.max(0, count.value + delta);
    count.value = next;
    saving.value = true;
    error.value = null;
    try {
      const res = await fetch("/api/neckers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ delta }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      count.value = data.count;
    } catch {
      // Roll back on failure
      count.value = count.value - delta;
      error.value = "Failed to save — try again";
    } finally {
      saving.value = false;
    }
  }

  return (
    <div class={`border-2 rounded-lg p-6 transition-colors ${
      count.value < 10
        ? "border-orange-400 bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-100 dark:border-orange-500"
        : "border-purple-400 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 dark:border-purple-500"
    }`}>
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium">Neckers</p>
          <div class="flex items-center gap-1.5 mt-2">
            {canEdit && (
              <button
                type="button"
                aria-label="Remove one necker"
                disabled={saving.value || count.value === 0}
                onClick={() => adjust(-1)}
                class={`w-7 h-7 flex items-center justify-center rounded text-base font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                  count.value < 10
                    ? "bg-orange-200 dark:bg-orange-800 hover:bg-red-200 dark:hover:bg-red-900/60"
                    : "bg-purple-200 dark:bg-purple-800 hover:bg-red-200 dark:hover:bg-red-900/60"
                }`}
              >−</button>
            )}
            <p class="text-3xl font-bold tabular-nums">{count}</p>
            {canEdit && (
              <button
                type="button"
                aria-label="Add one necker"
                disabled={saving.value}
                onClick={() => adjust(1)}
                class={`w-7 h-7 flex items-center justify-center rounded text-base font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                  count.value < 10
                    ? "bg-orange-200 dark:bg-orange-800 hover:bg-green-200 dark:hover:bg-green-900/60"
                    : "bg-purple-200 dark:bg-purple-800 hover:bg-green-200 dark:hover:bg-green-900/60"
                }`}
              >+</button>
            )}
          </div>
          <p class="text-xs mt-1 opacity-70">in stock</p>
          {count.value < 10 && (
            <p class="text-xs font-semibold mt-1">⚠️ Running low</p>
          )}
          {!saving.value && error.value && (
            <p class="text-xs text-red-500 mt-1">{error.value}</p>
          )}
        </div>
        <div class="text-4xl" aria-hidden="true">🧣</div>
      </div>
    </div>
  );
}
