// Interactive inventory table with search and filtering
import { Signal, computed, useSignal } from "@preact/signals";
import type { InventoryItem } from "../types/inventory.ts";
import { isFoodItem } from "../types/inventory.ts";
import type { ItemCategory } from "../types/inventory.ts";
import ExpiryBadge from "../components/ExpiryBadge.tsx";
import CategoryIcon from "../components/CategoryIcon.tsx";

interface InventoryTableProps {
  items: InventoryItem[];
  canEdit?: boolean;
  initialNeedsRepair?: boolean;
}

export default function InventoryTable({ items, canEdit = true, initialNeedsRepair = false }: InventoryTableProps) {
  const searchQuery = useSignal("");
  const categoryFilter = useSignal<"all" | ItemCategory>("all");
  const showLowStock = useSignal(false);
  const showNeedsRepair = useSignal(initialNeedsRepair);
  const confirmDeleteId = useSignal<string | null>(null);
  const toast = useSignal<{ message: string; type: "success" | "error" } | null>(null);
  
  // Filter items based on search and filters — computed() memoises the result
  // and only re-runs when a signal dependency (searchQuery, categoryFilter, etc.) changes.
  const filteredItems = computed(() => items.filter((item) => {
    // Search filter
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      item.notes?.toLowerCase().includes(searchQuery.value.toLowerCase());
    
    if (!matchesSearch) return false;
    
    // Category filter
    if (categoryFilter.value !== "all" && item.category !== categoryFilter.value) {
      return false;
    }
    
    // Low stock filter
    if (showLowStock.value && item.quantity > item.minThreshold) {
      return false;
    }

    // Needs repair filter
    if (showNeedsRepair.value) {
      const hasCondition = "condition" in item;
      if (!hasCondition || (item as { condition: string }).condition !== "needs-repair") {
        return false;
      }
    }

    return true;
  }));
  
  const showToast = (message: string, type: "success" | "error") => {
    toast.value = { message, type };
    setTimeout(() => { toast.value = null; }, 3500);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/items/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        confirmDeleteId.value = null;
        showToast("Item deleted successfully", "success");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        confirmDeleteId.value = null;
        showToast("Failed to delete item", "error");
      }
    } catch (_err) {
      confirmDeleteId.value = null;
      showToast("Network error — could not delete item", "error");
    }
  };
  
  return (
    <div>
      {/* Toast notification */}
      {toast.value && (
        <div class={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-white font-medium transition-all ${
          toast.value.type === "success" ? "bg-green-600" : "bg-red-600"
        }`}>
          {toast.value.type === "success" ? "✓" : "✕"} {toast.value.message}
        </div>
      )}

      {/* Filters */}
      <div class="bg-white dark:bg-gray-900 rounded-lg shadow p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchQuery.value}
              onInput={(e) => searchQuery.value = (e.target as HTMLInputElement).value}
              placeholder="Search by name, location, or notes..."
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              value={categoryFilter.value}
              onChange={(e) => categoryFilter.value = (e.target as HTMLSelectElement).value as any}
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Categories</option>
              <option value="tent">⛺ Tents</option>
              <option value="cooking">🍳 Cooking Equipment</option>
              <option value="food">🥫 Food</option>
              <option value="camping-tools">🪓 Camping Tools</option>
            </select>
          </div>
          
          <div class="flex items-end gap-6 flex-wrap">
            <label class="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showLowStock.value}
                onChange={(e) => showLowStock.value = (e.target as HTMLInputElement).checked}
                class="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Low Stock Only
              </span>
            </label>
            <label class="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showNeedsRepair.value}
                onChange={(e) => showNeedsRepair.value = (e.target as HTMLInputElement).checked}
                class="w-4 h-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
              />
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Needs Repair Only
              </span>
            </label>
          </div>
        </div>
        
        <div class="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredItems.value.length} of {items.length} items
        </div>
      </div>
      
      {/* Mobile card list — visible only on small screens */}
      <div class="block md:hidden space-y-3">
        {filteredItems.value.length === 0 ? (
          <div class="bg-white dark:bg-gray-900 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">
            No items found
          </div>
        ) : (
          filteredItems.value.map((item) => (
            <div key={item.id} class="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
              <div class="flex items-start justify-between mb-2">
                <div class="flex items-center gap-2 min-w-0 mr-2">
                  <CategoryIcon category={item.category} size="sm" />
                  <span class="font-medium text-gray-900 dark:text-gray-100 truncate">{item.name}</span>
                </div>
                <div class="flex flex-col items-end gap-1 shrink-0">
                  {item.quantity <= item.minThreshold && (
                    <span class="text-red-600 font-semibold text-xs">⚠️ LOW</span>
                  )}
                  {"condition" in item && (item as { condition: string }).condition === "needs-repair" && (
                    <span class="text-yellow-600 font-semibold text-xs">🔧 REPAIR</span>
                  )}
                </div>
              </div>
              {item.notes && (
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">{item.notes}</p>
              )}
              <div class="text-sm mb-2 space-y-1">
                <div>
                  <span class="text-gray-500 dark:text-gray-400">Qty: </span>
                  <span class="text-gray-900 dark:text-gray-100 font-medium">{item.quantity}</span>
                  <span class="text-gray-400 text-xs"> (min {item.minThreshold})</span>
                </div>
                <div class="truncate">
                  <span class="text-gray-500 dark:text-gray-400">📍 </span>
                  <span class="text-gray-900 dark:text-gray-100">{item.location}</span>
                </div>
              </div>
              {isFoodItem(item) && (
                <div class="mb-2">
                  <ExpiryBadge expiryDate={item.expiryDate} />
                </div>
              )}
              <div class="flex gap-4 text-sm border-t border-gray-100 dark:border-gray-700 pt-2 mt-2">
                <a
                  href={`/inventory/${item.id}`}
                  class="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-200 font-medium"
                >
                  View
                </a>
                {canEdit && (
                  confirmDeleteId.value === item.id ? (
                    <span class="flex items-center gap-2">
                      <span class="text-gray-600 dark:text-gray-400 text-xs">Delete?</span>
                      <button
                        onClick={() => handleDelete(item.id)}
                        class="text-red-600 hover:text-red-800 font-semibold text-xs"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => confirmDeleteId.value = null}
                        class="text-gray-500 hover:text-gray-700 text-xs"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => confirmDeleteId.value = item.id}
                      class="text-red-600 hover:text-red-900 font-medium"
                    >
                      Delete
                    </button>
                  )
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table — hidden on small screens */}
      <div class="hidden md:block bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Item
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Category
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Quantity
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Location
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredItems.value.length === 0 ? (
              <tr>
                <td colSpan={6} class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  No items found
                </td>
              </tr>
            ) : (
              filteredItems.value.map((item) => (
                <tr key={item.id} class="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="font-medium text-gray-900 dark:text-gray-100">{item.name}</div>
                    {item.notes && (
                      <div class="text-sm text-gray-500 dark:text-gray-400">{item.notes}</div>
                    )}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <CategoryIcon category={item.category} size="md" />
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900 dark:text-gray-100">
                      {item.quantity}
                      {item.quantity <= item.minThreshold && (
                        <span class="ml-2 text-red-600 font-semibold">⚠️ LOW</span>
                      )}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">Min: {item.minThreshold}</div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="text-sm text-gray-900 dark:text-gray-100">{item.location}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex flex-col items-start gap-1">
                      {isFoodItem(item) && (
                        <ExpiryBadge expiryDate={item.expiryDate} />
                      )}
                      {"condition" in item && (item as { condition: string }).condition === "needs-repair" && (
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
                          🔧 Needs Repair
                        </span>
                      )}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <a
                      href={`/inventory/${item.id}`}
                      class="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-200 mr-3"
                    >
                      View
                    </a>
                    {canEdit && (
                      confirmDeleteId.value === item.id ? (
                        <span class="inline-flex items-center gap-2">
                          <span class="text-gray-500 dark:text-gray-400 text-xs">Delete?</span>
                          <button
                            onClick={() => handleDelete(item.id)}
                            class="text-red-600 hover:text-red-800 font-semibold text-xs"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => confirmDeleteId.value = null}
                            class="text-gray-400 hover:text-gray-600 text-xs"
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => confirmDeleteId.value = item.id}
                          class="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
