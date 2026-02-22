// Interactive inventory table with search and filtering
import { Signal, useComputed, useSignal } from "@preact/signals";
import type { InventoryItem } from "../types/inventory.ts";
import { isFoodItem, isTentItem, ITEM_LOCATIONS, LOFT_LOCATIONS } from "../types/inventory.ts";
import type { ItemCategory } from "../types/inventory.ts";
import ExpiryBadge from "../components/ExpiryBadge.tsx";
import CategoryIcon from "../components/CategoryIcon.tsx";
import { getDaysUntil } from "../lib/date-utils.ts";

interface InventoryTableProps {
  items: InventoryItem[];
  canEdit?: boolean;
  initialNeedsRepair?: boolean;
  initialLowStock?: boolean;
  initialCategory?: string;
  csrfToken?: string;
}

export default function InventoryTable({ items, canEdit = true, initialNeedsRepair = false, initialLowStock = false, initialCategory = "all", csrfToken = "" }: InventoryTableProps) {
  const searchQuery = useSignal("");
  const categoryFilter = useSignal<"all" | ItemCategory>(initialCategory as "all" | ItemCategory);
  const spaceFilter = useSignal<"all" | "camp-store" | "scout-post-loft">("all");
  const locationFilter = useSignal<string>("all");
  const showLowStock = useSignal(initialLowStock);
  const showNeedsRepair = useSignal(initialNeedsRepair);
  const showAtCamp = useSignal(false);
  const cookingTypeFilter = useSignal<string>("all");
  const showExpiredFood = useSignal(false);
  const showExpiringSoon = useSignal(false);
  const showExpiring30 = useSignal(false);

  const uniqueLocations = [...new Set(items.map((i) => i.location))] as string[];
  const allDefinedLocations = new Set([...ITEM_LOCATIONS, ...LOFT_LOCATIONS].flatMap((g) => g.options as string[]));
  const knownGroups = [...ITEM_LOCATIONS, ...LOFT_LOCATIONS]
    .map((group) => ({ ...group, options: group.options.filter((o) => uniqueLocations.includes(o as string)) }))
    .filter((group) => group.options.length > 0);
  const ungroupedLocations = uniqueLocations.filter((l) => !allDefinedLocations.has(l)).sort();
  const locationGroups = ungroupedLocations.length > 0
    ? [...knownGroups, { group: "Other", options: ungroupedLocations }]
    : knownGroups;
  const confirmDeleteId = useSignal<string | null>(null);
  const toast = useSignal<{ message: string; type: "success" | "error" } | null>(null);
  const atCampCount = useComputed(() => items.filter((i) => (i as { atCamp?: boolean }).atCamp).length);
  
  // Human-readable labels for category slugs so "camping tools" or "first aid" match
  const categoryLabels: Record<string, string> = {
    "tent": "tents",
    "cooking": "cooking",
    "food": "food",
    "camping-tools": "camping tools",
    "games": "games",

  };

  // Filter items based on search and filters — useComputed() memoises the result
  // and only re-runs when a signal dependency (searchQuery, categoryFilter, etc.) changes.
  const filteredItems = useComputed(() => items.filter((item) => {
    // Search filter
    const q = searchQuery.value.toLowerCase();
    const categoryLabel = categoryLabels[item.category] ?? item.category;
    const matchesSearch = item.name.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      categoryLabel.includes(q) ||
      item.notes?.toLowerCase().includes(q);
    
    if (!matchesSearch) {
      return false;
    }
    
    // Category filter
    if (categoryFilter.value !== "all" && item.category !== categoryFilter.value) {
      return false;
    }

    // Space filter (items without a space field default to camp-store)
    if (spaceFilter.value !== "all") {
      const itemSpace = (item as { space?: string }).space ?? "camp-store";
      if (itemSpace !== spaceFilter.value) {
        return false;
      }
    }
    
    // Location filter
    if (locationFilter.value !== "all" && item.location !== locationFilter.value) {
      return false;
    }

    // At camp filter
    if (showAtCamp.value && !(item as { atCamp?: boolean }).atCamp) {
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

    // Cooking equipment type filter
    if (cookingTypeFilter.value !== "all") {
      if (item.category !== "cooking") {
        return false;
      }
      if ((item as { equipmentType?: string }).equipmentType !== cookingTypeFilter.value) {
        return false;
      }
    }

    // Food expiry filters — when any are active, item must be food matching at least one selected status
    const anyFoodExpiry = showExpiredFood.value || showExpiringSoon.value || showExpiring30.value;
    if (anyFoodExpiry) {
      if (!isFoodItem(item)) {
        return false;
      }
      const expiryDate = item.expiryDate instanceof Date ? item.expiryDate : new Date(item.expiryDate as string);
      const days = getDaysUntil(expiryDate);
      const matchesExpired = showExpiredFood.value && days <= 0;
      const matchesSoon = showExpiringSoon.value && days > 0 && days <= 7;
      const matches30 = showExpiring30.value && days > 7 && days <= 30;
      if (!matchesExpired && !matchesSoon && !matches30) {
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
        headers: { "X-CSRF-Token": csrfToken },
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
      <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm mb-6">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <span class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Filters</span>
          <div class="flex items-center gap-2">
            {atCampCount.value > 0 && (
              <button
                type="button"
                onClick={() => { showAtCamp.value = !showAtCamp.value; }}
                class={`text-xs font-medium px-2 py-0.5 rounded-full border transition-colors ${
                  showAtCamp.value
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-600 hover:bg-amber-200 dark:hover:bg-amber-900/60"
                }`}
              >
                🏕️ {atCampCount.value} at camp
              </button>
            )}
            <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
              {filteredItems.value.length} / {items.length} items
            </span>
          </div>
        </div>
        {/* Space toggle */}
        <div class="flex items-center gap-2 px-4 pt-3">
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Space</span>
          <div class="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600 text-xs font-medium">
            {(["all", "camp-store", "scout-post-loft"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { spaceFilter.value = s; categoryFilter.value = "all"; }}
                class={`px-3 py-1.5 transition-colors ${
                  spaceFilter.value === s
                    ? "bg-purple-600 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                {s === "all" ? "All" : s === "camp-store" ? "🏪 Camp Store" : "🏠 Scout Post Loft"}
              </button>
            ))}
          </div>
        </div>
        {/* Inputs */}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 pb-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Search</label>
            <input
              type="text"
              value={searchQuery.value}
              onInput={(e) => searchQuery.value = (e.target as HTMLInputElement).value}
              placeholder="Name, location, or notes…"
              class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label htmlFor="category-filter" class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Category</label>
            <select
              id="category-filter"
              value={categoryFilter.value}
              onChange={(e) => categoryFilter.value = (e.target as HTMLSelectElement).value as any}
              class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Categories</option>
              <optgroup label="🏪 Camp Store">
                <option value="tent">⛺ Tents</option>
                <option value="cooking">🍳 Cooking Equipment</option>
                <option value="food">🥫 Food</option>
                <option value="camping-tools">🪓 Camping Tools</option>
              </optgroup>
              <optgroup label="🏠 Scout Post Loft">
                <option value="games">🎮 Games</option>
              </optgroup>
            </select>
          </div>
          {(categoryFilter.value === "all" || categoryFilter.value === "cooking") && (
            <div>
              <label htmlFor="cooking-type-filter" class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Equipment Type</label>
              <select
                id="cooking-type-filter"
                value={cookingTypeFilter.value}
                onChange={(e) => cookingTypeFilter.value = (e.target as HTMLSelectElement).value}
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Equipment Types</option>
                <option value="stove">Stove</option>
                <option value="pots">Pots</option>
                <option value="pans">Pans</option>
                <option value="utensils">Utensils</option>
                <option value="cooler">Cooler</option>
                <option value="water-container">Water Container</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}
          <div class={(categoryFilter.value === "all" || categoryFilter.value === "cooking") ? "" : "sm:col-span-2"}>
            <label htmlFor="location-filter" class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Location</label>
            <select
              id="location-filter"
              value={locationFilter.value}
              onChange={(e) => locationFilter.value = (e.target as HTMLSelectElement).value}
              class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Locations</option>
              {locationGroups.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.options.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
        {/* Toggles */}
        <div class="flex flex-col gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
          {/* Row 1 — condition filters */}
          <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-8 gap-y-2">
            <span class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide px-3 sm:border-r border-gray-300 dark:border-gray-600 shrink-0">Stock</span>
            <label class="flex items-center gap-2 cursor-pointer select-none w-full sm:w-auto">
              <input
                type="checkbox"
                checked={showLowStock.value}
                onChange={(e) => showLowStock.value = (e.target as HTMLInputElement).checked}
                class="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">⚠️ Low Stock Only</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer select-none w-full sm:w-auto">
              <input
                type="checkbox"
                checked={showNeedsRepair.value}
                onChange={(e) => showNeedsRepair.value = (e.target as HTMLInputElement).checked}
                class="w-4 h-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
              />
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">🔧 Needs Repair Only</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer select-none w-full sm:w-auto">
              <input
                type="checkbox"
                checked={showAtCamp.value}
                onChange={(e) => showAtCamp.value = (e.target as HTMLInputElement).checked}
                class="w-4 h-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
              />
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">🏕️ At Camp Only</span>
              {atCampCount.value > 0 && (
                <span class="text-xs font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{atCampCount.value}</span>
              )}
            </label>
          </div>
          {/* Divider */}
          <div class="border-t border-gray-200 dark:border-gray-700" />
          {/* Row 2 — food expiry filters */}
          <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-8 gap-y-2">
            <span class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide px-3 sm:border-r border-gray-300 dark:border-gray-600 shrink-0">Food</span>
            <label class="flex items-center gap-2 cursor-pointer select-none w-full sm:w-auto">
              <input
                type="checkbox"
                checked={showExpiredFood.value}
                onChange={(e) => showExpiredFood.value = (e.target as HTMLInputElement).checked}
                class="w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">❌ Expired</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer select-none w-full sm:w-auto">
              <input
                type="checkbox"
                checked={showExpiringSoon.value}
                onChange={(e) => showExpiringSoon.value = (e.target as HTMLInputElement).checked}
                class="w-4 h-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
              />
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">🔴 Expiring Soon (≤7 days)</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer select-none w-full sm:w-auto">
              <input
                type="checkbox"
                checked={showExpiring30.value}
                onChange={(e) => showExpiring30.value = (e.target as HTMLInputElement).checked}
                class="w-4 h-4 text-yellow-500 focus:ring-yellow-500 border-gray-300 rounded"
              />
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">🟡 Within 30 Days</span>
            </label>
          </div>
        </div>
      </div>
      
      {/* Card list — visible only on small/tablet screens */}
      <div class="block lg:hidden space-y-3">
        {filteredItems.value.length === 0 ? (
          <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
            No items found
          </div>
        ) : (
          filteredItems.value.map((item) => {
            const isLowStock = item.quantity <= item.minThreshold;
            const needsRepair = "condition" in item && (item as { condition: string }).condition === "needs-repair";
            const accentColor = isLowStock
              ? "border-l-red-500"
              : needsRepair
              ? "border-l-yellow-500"
              : "border-l-purple-400";
            return (
              <div key={item.id} class={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 border-l-4 ${accentColor} shadow-sm`}>
                {/* Card header */}
                <div class="flex items-start justify-between px-4 pt-4 pb-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <CategoryIcon category={item.category} size="sm" />
                    <span class="font-semibold text-gray-900 dark:text-gray-100 truncate">{item.name}</span>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0 ml-2">
                    {(item as { atCamp?: boolean }).atCamp && (
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-600">🏕️ At Camp</span>
                    )}
                    {isLowStock && (
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700">⚠️ Low</span>
                    )}
                    {needsRepair && (
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700">🔧 Repair</span>
                    )}
                    {"condition" in item && !needsRepair && (() => {
                      const cond = (item as { condition: string }).condition;
                      const condLabel = cond === "excellent" ? "✅ Excellent" : cond === "good" ? "✅ Good" : "⚠️ Fair";
                      const condColor = cond === "fair"
                        ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700"
                        : "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700";
                      return <span class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${condColor}`}>{condLabel}</span>;
                    })()}
                  </div>
                </div>
                {/* Meta grid */}
                <div class="grid grid-cols-2 gap-x-4 gap-y-1 px-4 pb-3 text-sm">
                  <div>
                    <span class="text-xs text-gray-500 dark:text-gray-400 block">Quantity</span>
                    <span class="font-medium text-gray-900 dark:text-gray-100">{item.quantity}</span>
                    <span class="text-gray-300 dark:text-gray-400 text-xs"> / {item.minThreshold} min</span>
                    {!!(item as { quantityAtCamp?: number }).quantityAtCamp && (
                      <span class="block text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                        🏕️ {(item as { quantityAtCamp?: number }).quantityAtCamp} at camp
                      </span>
                    )}
                  </div>
                  <div>
                    <span class="text-xs text-gray-500 dark:text-gray-400 block">Location</span>
                    <span class="text-gray-900 dark:text-gray-100 truncate block">{item.location}</span>
                  </div>
                  {isTentItem(item) && (
                    <div class="col-span-2 pt-1 flex items-center gap-3">
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                        👤 {item.capacity} per tent
                      </span>
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                        🏕️ {item.capacity * item.quantity} total
                      </span>
                    </div>
                  )}
                  {isFoodItem(item) && (
                    <div class="col-span-2 pt-1">
                      <ExpiryBadge expiryDate={item.expiryDate} />
                    </div>
                  )}
                  {item.notes && (
                    <div class="col-span-2 pt-1">
                      <span class="text-xs text-gray-500 dark:text-gray-400 italic">{item.notes}</span>
                    </div>
                  )}
                </div>
                {/* Footer actions */}
                <div class="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg text-sm">
                  <a
                    href={`/inventory/${item.id}`}
                    class="font-medium text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200"
                  >
                    View
                  </a>
                  {canEdit && (
                    <a
                      href={`/inventory/edit/${item.id}`}
                      class="font-medium text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200"
                    >
                      Edit
                    </a>
                  )}
                  {canEdit && (
                    confirmDeleteId.value === item.id ? (
                      <span class="flex items-center gap-2 ml-auto">
                        <span class="text-gray-500 dark:text-gray-400 text-xs">Delete?</span>
                        <button onClick={() => handleDelete(item.id)} class="text-red-600 hover:text-red-800 font-semibold text-xs">Yes</button>
                        <button onClick={() => confirmDeleteId.value = null} class="text-gray-400 hover:text-gray-600 text-xs">No</button>
                      </span>
                    ) : (
                      <button
                        onClick={() => confirmDeleteId.value = item.id}
                        class="ml-auto text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                      >
                        Delete
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop table — hidden on small/tablet screens */}
      <div class="hidden lg:block bg-white dark:bg-gray-900 rounded-lg shadow overflow-x-auto">
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
                <tr
                  key={item.id}
                  class="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => { globalThis.location.href = `/inventory/${item.id}`; }}
                >
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
                    {!!(item as { quantityAtCamp?: number }).quantityAtCamp && (
                      <div class="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                        🏕️ {(item as { quantityAtCamp?: number }).quantityAtCamp} at camp
                      </div>
                    )}
                  </td>
                  <td class="px-6 py-4">
                    <div class="text-sm text-gray-900 dark:text-gray-100">{item.location}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex flex-col items-start gap-1">
                      {(item as { atCamp?: boolean }).atCamp && (
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-600">
                          🏕️ At Camp
                        </span>
                      )}
                      {isTentItem(item) && (
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700">
                          👤 {item.capacity}/tent · 🏕️ {item.capacity * item.quantity} total
                        </span>
                      )}
                      {isFoodItem(item) && (
                        <ExpiryBadge expiryDate={item.expiryDate} />
                      )}
                      {"condition" in item && (item as { condition: string }).condition === "needs-repair" && (
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700">
                          🔧 Needs Repair
                        </span>
                      )}
                      {"condition" in item && (item as { condition: string }).condition !== "needs-repair" && (() => {
                        const cond = (item as { condition: string }).condition;
                        const condLabel = cond === "excellent" ? "✅ Excellent" : cond === "good" ? "✅ Good" : "⚠️ Fair";
                        const condColor = cond === "fair"
                          ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700"
                          : "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700";
                        return (
                          <span class={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${condColor}`}>
                            {condLabel}
                          </span>
                        );
                      })()}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                    <div class="flex items-center gap-3">
                    {canEdit && (
                      <a
                        href={`/inventory/edit/${item.id}`}
                        class="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-200"
                      >
                        Edit
                      </a>
                    )}
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
                    </div>
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
