// Island — per-category data clear buttons on the admin panel.
import { useState } from "preact/hooks";

interface Props {
  csrfToken: string;
}

type Stage = "idle" | "confirm" | "loading" | "done";

interface CategoryState {
  stage: Stage;
  message: string | null;
  ok: boolean;
  confirmText: string;
}

type CategoryKey = "inventory" | "loans" | "camps" | "meals" | "activityLog";

const CATEGORIES: { key: CategoryKey; label: string; description: string }[] = [
  {
    key: "inventory",
    label: "Inventory",
    description: "All items, indexes, necker count & stats",
  },
  {
    key: "loans",
    label: "Loans",
    description: "All loan / checkout records",
  },
  {
    key: "camps",
    label: "Camp Plans",
    description: "All camp plans and templates",
  },
  {
    key: "meals",
    label: "Meals",
    description: "All meal plans",
  },
  {
    key: "activityLog",
    label: "Activity Log",
    description: "All activity log entries",
  },
];

function initialState(): Record<CategoryKey, CategoryState> {
  return Object.fromEntries(
    CATEGORIES.map(({ key }) => [
      key,
      { stage: "idle", message: null, ok: false, confirmText: "" },
    ]),
  ) as Record<CategoryKey, CategoryState>;
}

export default function DbClear({ csrfToken }: Props) {
  const [states, setStates] = useState<Record<CategoryKey, CategoryState>>(
    initialState,
  );

  function setCategory(key: CategoryKey, patch: Partial<CategoryState>) {
    setStates((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function handleClear(key: CategoryKey) {
    setCategory(key, { stage: "loading", message: null, confirmText: "" });
    try {
      const res = await fetch("/admin/clear-db", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ category: key }),
      });
      const json = await res.json();
      if (res.ok) {
        const count = json.deleted + (json.extra ?? 0);
        setCategory(key, {
          stage: "done",
          ok: true,
          message: `Cleared ${count} record(s).`,
        });
      } else {
        setCategory(key, {
          stage: "done",
          ok: false,
          message: json.error ?? "An error occurred.",
        });
      }
    } catch {
      setCategory(key, {
        stage: "done",
        ok: false,
        message: "Request failed.",
      });
    }
  }

  return (
    <div class="space-y-1">
      {CATEGORIES.map(({ key, label, description }) => {
        const { stage, message, ok, confirmText } = states[key];
        const isConfirm = stage === "confirm";

        return (
          <div
            key={key}
            class="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden"
          >
            {/* Row header — always visible */}
            <div class="flex items-center gap-2 px-3 py-2">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {label}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {description}
                </p>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                {stage === "idle" && (
                  <button
                    type="button"
                    onClick={() =>
                      setCategory(key, { stage: "confirm", confirmText: "" })}
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    🗑️ Clear…
                  </button>
                )}

                {stage === "confirm" && (
                  <span class="text-xs font-semibold text-red-600 dark:text-red-400">
                    Confirm below ↓
                  </span>
                )}

                {stage === "loading" && (
                  <span class="text-xs text-gray-500 dark:text-gray-400 animate-pulse">
                    Clearing…
                  </span>
                )}

                {stage === "done" && (
                  <>
                    <span
                      class={`text-xs ${
                        ok
                          ? "text-green-700 dark:text-green-400"
                          : "text-red-700 dark:text-red-400"
                      }`}
                    >
                      {ok ? "✅" : "❌"} {message}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCategory(key, {
                          stage: "idle",
                          message: null,
                          ok: false,
                          confirmText: "",
                        })}
                      class="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Confirmation panel — expands below the row */}
            {isConfirm && (
              <div class="border-t border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-3 space-y-2">
                <p class="text-xs font-medium text-red-700 dark:text-red-300">
                  This will permanently delete all {label.toLowerCase()}{" "}
                  data and cannot be undone. Type{" "}
                  <strong class="font-mono">CLEAR</strong> to confirm:
                </p>
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    value={confirmText}
                    onInput={(e) =>
                      setCategory(key, {
                        confirmText: (e.target as HTMLInputElement).value,
                      })}
                    placeholder="CLEAR"
                    autoComplete="off"
                    class="px-2.5 py-1.5 text-sm font-mono border border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 w-32"
                  />
                  <button
                    type="button"
                    disabled={confirmText !== "CLEAR"}
                    onClick={() => handleClear(key)}
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    🗑️ Delete {label}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCategory(key, { stage: "idle", confirmText: "" })}
                    class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
