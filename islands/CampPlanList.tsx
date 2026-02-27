// Camp plan list island — interactive list with delete and status badges
import { useSignal } from "@preact/signals";
import type { CampPlan, CampPlanStatus } from "../types/inventory.ts";
import { formatDate } from "../lib/date-utils.ts";

interface CampPlanListProps {
  plans: CampPlan[];
  canEdit: boolean;
  csrfToken?: string;
}

const STATUS_LABELS: Record<CampPlanStatus, string> = {
  planning: "Planning",
  packing: "Packing",
  active: "Active",
  returning: "Returning",
  completed: "Completed",
};

const STATUS_COLORS: Record<CampPlanStatus, string> = {
  planning: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  packing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  active: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  returning: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  completed: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

export default function CampPlanList({ plans: initialPlans, canEdit, csrfToken }: CampPlanListProps) {
  const plans = useSignal<CampPlan[]>(initialPlans);
  const deleting = useSignal<string | null>(null);
  const error = useSignal<string | null>(null);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete camp plan "${name}"? This cannot be undone.`)) {
      return;
    }
    deleting.value = id;
    error.value = null;
    try {
      const res = await fetch(`/api/camps/${id}`, {
        method: "DELETE",
        headers: { "X-CSRF-Token": csrfToken ?? "" },
      });
      if (!res.ok) throw new Error("Failed to delete");
      plans.value = plans.value.filter((p) => p.id !== id);
    } catch (_e) {
      error.value = "Failed to delete camp plan. Please try again.";
    } finally {
      deleting.value = null;
    }
  }

  if (plans.value.length === 0) {
    return (
      <div class="text-center py-16">
        <div class="text-5xl mb-4">🏕️</div>
        <p class="text-gray-500 dark:text-gray-400 text-lg mb-4">No camp plans yet</p>
        {canEdit && (
          <a
            href="/camps/new"
            class="inline-block px-5 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 transition-colors"
          >
            ➕ Create First Camp Plan
          </a>
        )}
      </div>
    );
  }

  return (
    <div>
      {error.value && (
        <div class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">
          {error.value}
        </div>
      )}
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.value.map((plan) => {
          const packed = plan.items.filter((i) => i.packedStatus).length;
          const returned = plan.items.filter((i) => i.returnedStatus).length;
          const total = plan.items.length;
          return (
            <div
              key={plan.id}
              class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 flex flex-col"
            >
              <div class="p-4 flex-1">
                <div class="flex items-start justify-between gap-2 mb-2">
                  <h3 class="font-semibold text-gray-800 dark:text-gray-100 text-lg leading-tight">
                    {plan.name}
                  </h3>
                  <span class={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[plan.status as CampPlanStatus]}`}>
                    {STATUS_LABELS[plan.status as CampPlanStatus]}
                  </span>
                </div>
                <p class="text-sm text-purple-600 dark:text-purple-400 font-medium mb-1">
                  📅 {formatDate(plan.campDate)}
                  {plan.endDate && ` – ${formatDate(plan.endDate)}`}
                </p>
                {plan.location && (
                  <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">📍 {plan.location}</p>
                )}
                {total > 0 && (
                  <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1 mt-2">
                    <div class="flex items-center gap-2">
                      <div class="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                        <div
                          class="bg-yellow-400 h-1.5 rounded-full transition-all"
                          style={{ width: `${total ? Math.round((packed / total) * 100) : 0}%` }}
                        />
                      </div>
                      <span>{packed}/{total} packed</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <div class="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                        <div
                          class="bg-green-400 h-1.5 rounded-full transition-all"
                          style={{ width: `${total ? Math.round((returned / total) * 100) : 0}%` }}
                        />
                      </div>
                      <span>{returned}/{total} returned</span>
                    </div>
                  </div>
                )}
                {total === 0 && (
                  <p class="text-xs text-gray-400 dark:text-gray-500 mt-2 italic">No items added yet</p>
                )}
              </div>
              <div class="border-t border-gray-100 dark:border-gray-700 px-4 py-3 flex gap-2">
                <a
                  href={`/camps/${plan.id}`}
                  class="flex-1 text-center text-sm font-medium px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                >
                  Open
                </a>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleDelete(plan.id, plan.name)}
                    disabled={deleting.value === plan.id}
                    class="text-sm px-3 py-1.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  >
                    {deleting.value === plan.id ? "…" : "Delete"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
