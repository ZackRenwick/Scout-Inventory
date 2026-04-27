// Interactive island for bulk-moving inventory items to a new location.
import { useSignal } from "@preact/signals";
import {
  GAS_STORAGE_LOCATIONS,
  type InventoryItem,
  ITEM_LOCATIONS,
  type ItemLocation,
  LOFT_LOCATIONS,
} from "../types/inventory.ts";

interface BulkMoveItemsProps {
  items: InventoryItem[];
  csrfToken: string;
}

type Space = "camp-store" | "scout-post-loft" | "gas-storage-box";

function getLocationsForSpace(space: Space) {
  if (space === "scout-post-loft") return LOFT_LOCATIONS;
  if (space === "gas-storage-box") return GAS_STORAGE_LOCATIONS;
  return ITEM_LOCATIONS;
}

export default function BulkMoveItems(
  { items, csrfToken }: BulkMoveItemsProps,
) {
  const selectedIds = useSignal<Set<string>>(new Set());
  const search = useSignal("");
  const space = useSignal<Space>("camp-store");
  const allLocationGroups = getLocationsForSpace("camp-store");
  const destSpace = useSignal<Space>("camp-store");
  const destLocation = useSignal<ItemLocation>(
    ITEM_LOCATIONS[0].options[0],
  );
  const submitting = useSignal(false);
  const resultMsg = useSignal<{ ok: boolean; text: string } | null>(null);

  function getLocationGroups(sp: Space) {
    return getLocationsForSpace(sp);
  }

  const filteredItems = () => {
    const q = search.value.toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.location.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q),
    );
  };

  function toggleItem(id: string) {
    const next = new Set(selectedIds.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds.value = next;
  }

  function toggleAll() {
    const visible = filteredItems().map((i) => i.id);
    const allSelected = visible.every((id) => selectedIds.value.has(id));
    const next = new Set(selectedIds.value);
    if (allSelected) {
      visible.forEach((id) => next.delete(id));
    } else {
      visible.forEach((id) => next.add(id));
    }
    selectedIds.value = next;
  }

  function onSpaceChange(newSpace: Space) {
    destSpace.value = newSpace;
    const grps = getLocationGroups(newSpace);
    destLocation.value = grps[0]?.options[0] ?? "" as ItemLocation;
  }

  async function handleSubmit() {
    if (selectedIds.value.size === 0) return;
    submitting.value = true;
    resultMsg.value = null;
    try {
      const res = await fetch("/api/items/bulk-location", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          ids: [...selectedIds.value],
          location: destLocation.value,
          space: destSpace.value,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        resultMsg.value = {
          ok: true,
          text: `✅ Moved ${json.succeeded} item${
            json.succeeded !== 1 ? "s" : ""
          } to "${destLocation.value}".`,
        };
        selectedIds.value = new Set();
      } else {
        resultMsg.value = { ok: false, text: `❌ ${json.error ?? "Error"}` };
      }
    } catch {
      resultMsg.value = { ok: false, text: "❌ Network error. Please retry." };
    } finally {
      submitting.value = false;
    }
  }

  const visible = filteredItems();
  const allVisibleSelected = visible.length > 0 &&
    visible.every((i) => selectedIds.value.has(i.id));
  const locationGroups = getLocationGroups(destSpace.value);

  return (
    <div class="space-y-6">
      {/* Destination picker */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-5">
        <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
          Destination location
        </h2>
        <div class="flex flex-wrap gap-4 items-end">
          <div>
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Space
            </p>
            <div class="flex gap-3">
              {(
                [
                  { value: "camp-store", label: "Camp Store" },
                  { value: "scout-post-loft", label: "Scout Post Loft" },
                  { value: "gas-storage-box", label: "Gas Storage" },
                ] as { value: Space; label: string }[]
              ).map(({ value, label }) => (
                <label
                  key={value}
                  class="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700 dark:text-gray-200"
                >
                  <input
                    type="radio"
                    name="dest-space"
                    value={value}
                    checked={destSpace.value === value}
                    onChange={() => onSpaceChange(value)}
                    class="accent-purple-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div class="flex-1 min-w-48">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Location
            </p>
            <select
              value={destLocation.value}
              onInput={(
                e,
              ) => (destLocation.value = (e.target as HTMLSelectElement)
                .value as ItemLocation)}
              class="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {locationGroups.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={submitting.value || selectedIds.value.size === 0}
            onClick={handleSubmit}
            class="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {submitting.value
              ? "Moving…"
              : `Move ${selectedIds.value.size} selected`}
          </button>
        </div>
        {resultMsg.value && (
          <p
            class={`mt-3 text-sm font-medium ${
              resultMsg.value.ok
                ? "text-green-700 dark:text-green-400"
                : "text-red-700 dark:text-red-400"
            }`}
          >
            {resultMsg.value.text}
          </p>
        )}
      </div>

      {/* Item list with checkboxes */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <input
            type="text"
            placeholder="Search name, category, or current location…"
            value={search.value}
            onInput={(
              e,
            ) => (search.value = (e.target as HTMLInputElement).value)}
            class="flex-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <span class="text-xs text-gray-400 whitespace-nowrap">
            {selectedIds.value.size} selected
          </span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <tr>
                <th class="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    title="Select all visible"
                    class="accent-purple-600"
                  />
                </th>
                <th class="px-4 py-3 text-left">Name</th>
                <th class="px-4 py-3 text-left">Category</th>
                <th class="px-4 py-3 text-left">Current location</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              {visible.length === 0 && (
                <tr>
                  <td
                    colspan={4}
                    class="px-4 py-8 text-center text-gray-400 dark:text-gray-500"
                  >
                    No items match your search.
                  </td>
                </tr>
              )}
              {visible.map((item) => (
                <tr
                  key={item.id}
                  class={`transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                    selectedIds.value.has(item.id)
                      ? "bg-purple-50 dark:bg-purple-900/20"
                      : ""
                  }`}
                  onClick={() => toggleItem(item.id)}
                >
                  <td class="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.value.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                      class="accent-purple-600"
                    />
                  </td>
                  <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {item.name}
                  </td>
                  <td class="px-4 py-3 text-gray-500 dark:text-gray-400 capitalize">
                    {item.category}
                  </td>
                  <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {item.location}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
