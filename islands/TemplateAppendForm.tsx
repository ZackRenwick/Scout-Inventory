import { useComputed, useSignal } from "@preact/signals";
import type { CampTemplateItem, InventoryItem } from "../types/inventory.ts";
import NumberInput from "../components/NumberInput.tsx";

interface TemplateAppendFormProps {
  templateId: string;
  allItems: InventoryItem[];
  templateItems: CampTemplateItem[];
  csrfToken: string;
}

const inputClass =
  "w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500";

export default function TemplateAppendForm({ templateId, allItems, templateItems, csrfToken }: TemplateAppendFormProps) {
  const query = useSignal("");
  const selectedId = useSignal("");
  const qty = useSignal(1);
  const notes = useSignal("");
  const saving = useSignal(false);
  const error = useSignal<string | null>(null);

  const selectedItem = useComputed(() => allItems.find((i) => i.id === selectedId.value));

  const availableToTemplate = (inv: InventoryItem): number => {
    if (inv.category === "food") {
      return inv.quantity;
    }
    const atCampQty = inv.atCamp
      ? Math.max(0, Math.min(inv.quantity, inv.quantityAtCamp ?? inv.quantity))
      : 0;
    return Math.max(0, inv.quantity - atCampQty);
  };

  const selectedExistingQty = useComputed(
    () => templateItems.find((i) => i.itemId === selectedId.value)?.quantityPlanned ?? 0,
  );

  const selectedMaxAppendQty = useComputed(() => {
    if (!selectedItem.value) return 0;
    return Math.max(0, availableToTemplate(selectedItem.value) - selectedExistingQty.value);
  });

  const qtyTooHigh = useComputed(() => qty.value > selectedMaxAppendQty.value);

  const filteredItems = useComputed(() => {
    const q = query.value.trim().toLowerCase();
    if (!q) return [];
    return allItems
      .filter((inv) =>
        inv.name.toLowerCase().includes(q) ||
        inv.category.toLowerCase().includes(q) ||
        inv.location.toLowerCase().includes(q)
      )
      .slice(0, 30);
  });

  function pickItem(item: InventoryItem) {
    selectedId.value = item.id;
    query.value = item.name;
    qty.value = 1;
    error.value = null;
  }

  async function submit() {
    if (!selectedId.value) {
      error.value = "Select an item first.";
      return;
    }
    if (selectedMaxAppendQty.value < 1) {
      error.value = "No additional quantity can be added for this item right now.";
      return;
    }
    if (qtyTooHigh.value) {
      error.value = `Only ${selectedMaxAppendQty.value} more can be added for this item.`;
      return;
    }

    saving.value = true;
    error.value = null;
    try {
      const body = new URLSearchParams({
        action: "append_item",
        templateId,
        itemId: selectedId.value,
        quantity: String(Math.max(1, qty.value)),
        notes: notes.value.trim(),
        _csrf: csrfToken,
      });

      const res = await fetch("/camps/templates", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Server error ${res.status}`);
      }

      globalThis.location.reload();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to add item.";
      saving.value = false;
    }
  }

  return (
    <div class="mt-3 grid sm:grid-cols-[minmax(0,1fr)_90px_minmax(0,1fr)_auto] gap-2 items-end">
      <label class="block text-xs text-gray-500 dark:text-gray-400 sm:col-span-1">
        Item
        <input
          type="text"
          placeholder="Type to filter inventory..."
          value={query.value}
          onInput={(e) => {
            query.value = (e.target as HTMLInputElement).value;
            selectedId.value = "";
          }}
          class={`${inputClass} mt-1`}
        />
        {query.value && filteredItems.value.length > 0 && !selectedItem.value && (
          <div class="mt-1 border border-gray-200 dark:border-gray-700 rounded-md max-h-44 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
            {filteredItems.value.map((inv) => (
              <button
                type="button"
                key={inv.id}
                onClick={() => pickItem(inv)}
                class="w-full text-left px-2 py-1.5 text-xs hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="font-medium text-gray-800 dark:text-gray-100 truncate">{inv.name}</span>
                  {(() => {
                    const available = availableToTemplate(inv);
                    return (
                  <span
                    class={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[11px] font-semibold ${
                      available > 5
                        ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700"
                        : available > 0
                        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700"
                        : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700"
                    }`}
                  >
                    📦 {available}
                  </span>
                    );
                  })()}
                </div>
                <div class="text-gray-500 dark:text-gray-400 mt-0.5">
                  {inv.category} · {inv.location}
                </div>
              </button>
            ))}
          </div>
        )}
        {selectedItem.value && (
          <p class="mt-1 text-xs text-green-700 dark:text-green-300">
            Selected: {selectedItem.value.name}
            <span class="ml-1 text-gray-500 dark:text-gray-400">
              · in template: {selectedExistingQty.value} · can add: {selectedMaxAppendQty.value}
            </span>
          </p>
        )}
      </label>

      <label class="block text-xs text-gray-500 dark:text-gray-400">
        Qty
        <NumberInput
          value={qty.value}
          min={1}
          onChange={(n) => {
            qty.value = Math.max(1, n);
          }}
          class={`${inputClass} mt-1`}
        />
        {qtyTooHigh.value && (
          <p class="mt-1 text-xs text-red-600 dark:text-red-400">Only {selectedMaxAppendQty.value} more can be added.</p>
        )}
      </label>

      <label class="block text-xs text-gray-500 dark:text-gray-400">
        Note (optional)
        <input
          type="text"
          value={notes.value}
          onInput={(e) => {
            notes.value = (e.target as HTMLInputElement).value;
          }}
          placeholder="e.g. spare set"
          class={`${inputClass} mt-1`}
        />
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={saving.value || !selectedId.value || selectedMaxAppendQty.value < 1 || qtyTooHigh.value}
        class="px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-60 transition-colors"
      >
        {saving.value ? "Adding..." : selectedMaxAppendQty.value < 1 ? "Max reached" : qtyTooHigh.value ? "Exceeds available" : "Add item"}
      </button>

      {error.value && (
        <p class="sm:col-span-4 text-xs text-red-600 dark:text-red-400">{error.value}</p>
      )}
    </div>
  );
}
