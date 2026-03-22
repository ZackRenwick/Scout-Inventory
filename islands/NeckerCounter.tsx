// Interactive necker counter — fetches live data on mount, no SSR prop needed
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { neckerCount } from "../lib/neckerSignal.ts";

interface NeckerCounterProps {
  csrfToken: string;
  canIncrease?: boolean;
  canDecrease?: boolean;
}

export default function NeckerCounter({ csrfToken, canIncrease = true, canDecrease = true }: NeckerCounterProps) {
  // Use the shared signal so NeckerAlert reacts to every change
  const count = neckerCount;
  const saving = useSignal(false);
  const error = useSignal<string | null>(null);

  // Fetch the live count from the API on mount
  useEffect(() => {
    fetch("/api/neckers")
      .then((r) => r.json())
      .then((d) => { count.value = d.count; })
      .catch(() => { error.value = "Failed to load"; });
  }, []);

  async function adjust(delta: number) {
    if (saving.value || count.value === null) {
      return;
    }
    const prev = count.value;
    const next = Math.max(0, prev + delta);
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
      count.value = prev;
      error.value = "Failed to save — try again";
    } finally {
      saving.value = false;
    }
  }

  const isLow = count.value !== null && count.value < 10;

  return (
    <div class={`border-2 rounded-lg p-4 max-[380px]:p-3 sm:p-4 lg:p-3.5 transition-colors ${
      isLow
        ? "border-orange-400 bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-100 dark:border-orange-500"
        : "border-purple-400 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 dark:border-purple-500"
    }`}>
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm max-[380px]:text-xs font-medium">Neckers</p>
          <div class="flex items-center gap-1.5 mt-1.5">
            {canDecrease && (
              <button
                type="button"
                aria-label="Remove one necker"
                disabled={saving.value || count.value === null || count.value === 0}
                onClick={() => adjust(-1)}
                class={`w-7 h-7 max-[380px]:w-6 max-[380px]:h-6 flex items-center justify-center rounded text-base max-[380px]:text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                  isLow
                    ? "bg-orange-200 dark:bg-orange-800 hover:bg-red-200 dark:hover:bg-red-900/60"
                    : "bg-purple-200 dark:bg-purple-800 hover:bg-red-200 dark:hover:bg-red-900/60"
                }`}
              >−</button>
            )}
            <p class="text-3xl max-[380px]:text-2xl sm:text-[1.7rem] lg:text-2xl font-bold tabular-nums">
              {count.value === null ? "…" : count.value}
            </p>
            {canIncrease && (
              <button
                type="button"
                aria-label="Add one necker"
                disabled={saving.value || count.value === null}
                onClick={() => adjust(1)}
                class={`w-7 h-7 max-[380px]:w-6 max-[380px]:h-6 flex items-center justify-center rounded text-base max-[380px]:text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                  isLow
                    ? "bg-orange-200 dark:bg-orange-800 hover:bg-green-200 dark:hover:bg-green-900/60"
                    : "bg-purple-200 dark:bg-purple-800 hover:bg-green-200 dark:hover:bg-green-900/60"
                }`}
              >+</button>
            )}
          </div>
          <p class="text-xs max-[380px]:text-[10px] mt-1 opacity-70">in stock</p>
          {!saving.value && error.value && (
            <p class="text-xs max-[380px]:text-[10px] text-red-500 mt-1">{error.value}</p>
          )}
        </div>
        <div class="text-4xl max-[380px]:text-3xl sm:text-3xl lg:text-[1.9rem]" aria-hidden="true">🧣</div>
      </div>
    </div>
  );
}
