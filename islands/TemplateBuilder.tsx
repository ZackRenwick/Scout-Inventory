import { useSignal, useComputed } from "@preact/signals";
import type { CampTemplateItem, InventoryItem } from "../types/inventory.ts";

interface TemplateBuilderProps {
  allItems: InventoryItem[];
  csrfToken: string;
}

const inputClass =
  "px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500";

export default function TemplateBuilder({ allItems, csrfToken }: TemplateBuilderProps) {
  const open = useSignal(false);
  const name = useSignal("");
  const description = useSignal("");
  const search = useSignal("");
  const selectedItems = useSignal<Array<CampTemplateItem & { _key: string }>>([]);
  const saving = useSignal(false);
  const error = useSignal<string | null>(null);

  const selectedIds = useComputed(() => new Set(selectedItems.value.map((i) => i.itemId)));

  const filteredItems = useComputed(() => {
    const q = search.value.trim().toLowerCase();
    if (!q) return [];
    return allItems
      .filter((inv) => !selectedIds.value.has(inv.id) && inv.name.toLowerCase().includes(q))
      .slice(0, 30);
  });

  function addItem(inv: InventoryItem) {
    selectedItems.value = [
      ...selectedItems.value,
      {
        _key: inv.id,
        itemId: inv.id,
        itemName: inv.name,
        itemCategory: inv.category,
        itemLocation: inv.location,
        quantityPlanned: 1,
      },
    ];
    search.value = "";
  }

  function removeItem(itemId: string) {
    selectedItems.value = selectedItems.value.filter((i) => i.itemId !== itemId);
  }

  function setQty(itemId: string, qty: number) {
    selectedItems.value = selectedItems.value.map((i) =>
      i.itemId === itemId ? { ...i, quantityPlanned: Math.max(1, qty) } : i
    );
  }

  function setNotes(itemId: string, notes: string) {
    selectedItems.value = selectedItems.value.map((i) =>
      i.itemId === itemId ? { ...i, notes: notes || undefined } : i
    );
  }

  function reset() {
    name.value = "";
    description.value = "";
    search.value = "";
    selectedItems.value = [];
    error.value = null;
    open.value = false;
  }

  async function save() {
    const trimmedName = name.value.trim();
    if (!trimmedName) { error.value = "A template name is required."; return; }
    if (selectedItems.value.length === 0) { error.value = "Add at least one item."; return; }
    saving.value = true;
    error.value = null;
    try {
      const res = await fetch("/api/camp-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          name: trimmedName,
          description: description.value.trim() || undefined,
          items: selectedItems.value.map(({ itemId, itemName, itemCategory, itemLocation, quantityPlanned, notes }) => ({
            itemId, itemName, itemCategory, itemLocation, quantityPlanned, notes,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Server error ${res.status}`);
      }
      globalThis.location.reload();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to save template.";
      saving.value = false;
    }
  }

  return (
    <div class="mb-6">
      {!open.value ? (
        <button
          type="button"
          onClick={() => { open.value = true; }}
          class="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition-colors"
        >
          ➕ New Template
        </button>
      ) : (
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">Create New Template</h2>
            <button
              type="button"
              onClick={reset}
              class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              ✕ Cancel
            </button>
          </div>

          {error.value && (
            <div class="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">
              {error.value}
            </div>
          )}

          {/* Name & description */}
          <div class="space-y-2">
            <input
              type="text"
              placeholder="Template name (e.g. Weekend camp kit) *"
              maxLength={80}
              value={name.value}
              onInput={(e) => { name.value = (e.target as HTMLInputElement).value; }}
              class={`${inputClass} w-full`}
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={description.value}
              onInput={(e) => { description.value = (e.target as HTMLInputElement).value; }}
              class={`${inputClass} w-full`}
            />
          </div>

          {/* Search for items */}
          <div class="space-y-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Add items</label>
            <input
              type="text"
              placeholder="Search inventory…"
              value={search.value}
              onInput={(e) => { search.value = (e.target as HTMLInputElement).value; }}
              class={`${inputClass} w-full`}
            />
            {search.value && filteredItems.value.length === 0 && (
              <p class="text-xs text-gray-500 dark:text-gray-400 italic">No matching items found.</p>
            )}
            {filteredItems.value.length > 0 && (
              <div class="border border-gray-200 dark:border-gray-600 rounded-md divide-y divide-gray-100 dark:divide-gray-700 max-h-48 overflow-y-auto">
                {filteredItems.value.map((inv) => (
                  <button
                    type="button"
                    key={inv.id}
                    onClick={() => addItem(inv)}
                    class="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                  >
                    <span class="font-medium text-gray-800 dark:text-gray-100">{inv.name}</span>
                    <span class="text-gray-500 dark:text-gray-400 ml-2 text-xs">
                      {inv.category} · {inv.location} · stock: {inv.quantity}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected items */}
          {selectedItems.value.length > 0 && (
            <div class="space-y-2">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Items in template ({selectedItems.value.length})
              </label>
              <div class="border border-gray-200 dark:border-gray-600 rounded-md divide-y divide-gray-100 dark:divide-gray-700">
                {selectedItems.value.map((item) => (
                  <div key={item._key} class="px-3 py-2 space-y-1.5">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-sm font-medium text-gray-800 dark:text-gray-100 min-w-0 truncate">
                        {item.itemName}
                      </span>
                      <div class="flex items-center gap-2 shrink-0">
                        <label class="text-xs text-gray-500 dark:text-gray-400">Qty:</label>
                        <input
                          type="number"
                          min={1}
                          value={item.quantityPlanned}
                          onInput={(e) => setQty(item.itemId, parseInt((e.target as HTMLInputElement).value) || 1)}
                          class="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(item.itemId)}
                          class="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="Notes (optional)"
                      value={item.notes ?? ""}
                      onInput={(e) => setNotes(item.itemId, (e.target as HTMLInputElement).value)}
                      class="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div class="flex gap-2 pt-1">
            <button
              type="button"
              onClick={save}
              disabled={saving.value || !name.value.trim() || selectedItems.value.length === 0}
              class="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-60 transition-colors"
            >
              {saving.value ? "Saving…" : "Save Template"}
            </button>
            <button
              type="button"
              onClick={reset}
              class="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
