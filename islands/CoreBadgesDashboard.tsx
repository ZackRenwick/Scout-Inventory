// Core badge stock dashboard — tracks each core badge type (World Membership,
// Scotland, Forth Region, West Lothian, 7th Whitburn), which are usually bought
// together as a set.
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import {
  CORE_BADGE_META,
  CORE_BADGE_TYPES,
  type CoreBadgeStock,
  type CoreBadgeType,
} from "../types/badges.ts";

interface CoreBadgesDashboardProps {
  csrfToken: string;
  canEdit?: boolean;
}

const LOW_STOCK_THRESHOLD = 5;

export default function CoreBadgesDashboard(
  { csrfToken, canEdit = true }: CoreBadgesDashboardProps,
) {
  const stock = useSignal<CoreBadgeStock | null>(null);
  const saving = useSignal(false);
  const error = useSignal<string | null>(null);
  const message = useSignal<string | null>(null);
  const setQty = useSignal("1");

  async function load() {
    try {
      const res = await fetch("/api/badges");
      if (!res.ok) throw new Error("Failed to load badge stock");
      stock.value = await res.json();
    } catch {
      error.value = "Could not load badge stock.";
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function post(body: Record<string, unknown>, okMessage?: string) {
    if (saving.value) return;
    saving.value = true;
    error.value = null;
    message.value = null;
    try {
      const res = await fetch("/api/badges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to update badge stock");
      }
      stock.value = data;
      message.value = okMessage ?? "Updated.";
    } catch (e) {
      error.value = e instanceof Error
        ? e.message
        : "Failed to update badge stock.";
    } finally {
      saving.value = false;
    }
  }

  function adjust(type: CoreBadgeType, delta: number) {
    post({ type, delta });
  }

  function addSet() {
    const qty = Number.parseInt(setQty.value, 10);
    if (!Number.isInteger(qty) || qty <= 0) {
      error.value = "Set quantity must be a positive integer.";
      return;
    }
    post(
      { setDelta: qty },
      `Added ${qty} full set${qty === 1 ? "" : "s"} (+${qty} to each badge).`,
    );
  }

  return (
    <div class="space-y-6">
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {CORE_BADGE_TYPES.map((type) => {
          const meta = CORE_BADGE_META[type];
          const count = stock.value?.[type];
          const isLow = count !== undefined && count < LOW_STOCK_THRESHOLD;
          return (
            <div
              key={type}
              class={`rounded-xl border p-4 ${
                isLow
                  ? "border-orange-400 bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-100 dark:border-orange-500"
                  : "border-purple-400 bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100 dark:border-purple-700"
              }`}
            >
              <div class="flex items-center justify-between">
                <p class="font-semibold text-sm">{meta.label}</p>
                <span class="text-2xl" aria-hidden="true">{meta.icon}</span>
              </div>
              <div class="flex items-center gap-2 mt-2">
                {canEdit && (
                  <button
                    type="button"
                    aria-label={`Remove one ${meta.label} badge`}
                    disabled={saving.value || count === undefined ||
                      count === 0}
                    onClick={() => adjust(type, -1)}
                    class="w-7 h-7 flex items-center justify-center rounded bg-white/60 dark:bg-black/20 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-200 dark:hover:bg-red-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                  >
                    −
                  </button>
                )}
                <p class="text-3xl font-bold tabular-nums">{count ?? "…"}</p>
                {canEdit && (
                  <button
                    type="button"
                    aria-label={`Add one ${meta.label} badge`}
                    disabled={saving.value || count === undefined}
                    onClick={() => adjust(type, 1)}
                    class="w-7 h-7 flex items-center justify-center rounded bg-white/60 dark:bg-black/20 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-200 dark:hover:bg-green-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                  >
                    +
                  </button>
                )}
              </div>
              <p class="text-xs mt-1 opacity-70">in stock</p>
            </div>
          );
        })}
      </div>

      {canEdit && (
        <section class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            Add a Full Set
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Badges are usually bought together as a set — this adds the same
            quantity to every badge type ({CORE_BADGE_TYPES.map((type) =>
              CORE_BADGE_META[type].label
            ).join(", ")}) in one go.
          </p>
          <div class="flex gap-2 mt-3 flex-wrap items-center">
            <input
              type="number"
              min="1"
              step="1"
              value={setQty.value}
              onInput={(e) => {
                const target = e.currentTarget as HTMLInputElement;
                setQty.value = target.value;
              }}
              class="w-24 px-2 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            <button
              type="button"
              disabled={saving.value}
              onClick={addSet}
              class="px-3 py-2 rounded bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-50"
            >
              Add Set to All Badges
            </button>
          </div>
        </section>
      )}

      {!saving.value && error.value && (
        <p class="text-sm text-red-600 dark:text-red-400">{error.value}</p>
      )}
      {!saving.value && message.value && (
        <p class="text-sm text-green-700 dark:text-green-400">
          {message.value}
        </p>
      )}
    </div>
  );
}
