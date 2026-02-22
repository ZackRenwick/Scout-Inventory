// Camp checklist island — full management for a single camp plan
import { useSignal, useComputed } from "@preact/signals";
import type { CampPlan, CampPlanItem, CampPlanStatus, InventoryItem } from "../types/inventory.ts";

interface CampChecklistProps {
  plan: CampPlan;
  allItems: InventoryItem[];
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
  planning: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300 dark:border-blue-600",
  packing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-300 dark:border-yellow-600",
  active: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-300 dark:border-green-600",
  returning: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-300 dark:border-orange-600",
  completed: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600",
};

const STATUS_ORDER: CampPlanStatus[] = ["planning", "packing", "active", "returning", "completed"];

type Tab = "pack" | "return";

function formatDate(d: Date | string | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function CampChecklist({ plan: initialPlan, allItems, canEdit, csrfToken }: CampChecklistProps) {
  const plan = useSignal<CampPlan>(initialPlan);
  const tab = useSignal<Tab>("pack");
  const saving = useSignal(false);
  const error = useSignal<string | null>(null);
  const itemSearch = useSignal("");
  const addingItem = useSignal<string>(""); // item id to add
  const addQty = useSignal(1);
  const addNote = useSignal("");
  const showAddPanel = useSignal(false);

  const planItemIds = useComputed(() => new Set(plan.value.items.map((i) => i.itemId)));

  const filteredInventory = useComputed(() => {
    const q = itemSearch.value.toLowerCase();
    return allItems
      .filter((i) => !planItemIds.value.has(i.id))
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  });

  // Separate food (consumed at camp) from gear (must be returned)
  const gearItems = useComputed(() => plan.value.items.filter((i) => i.itemCategory !== "food"));
  const foodItems = useComputed(() => plan.value.items.filter((i) => i.itemCategory === "food"));
  const packedGearCount = useComputed(() => gearItems.value.filter((i) => i.packedStatus).length);
  const packedFoodCount = useComputed(() => foodItems.value.filter((i) => i.packedStatus).length);
  const returnedGearCount = useComputed(() => gearItems.value.filter((i) => i.returnedStatus).length);
  const totalGear = useComputed(() => gearItems.value.length);
  const totalFood = useComputed(() => foodItems.value.length);
  const totalItems = useComputed(() => plan.value.items.length);

  async function patch(updates: Partial<CampPlan>) {
    saving.value = true;
    error.value = null;
    try {
      const res = await fetch(`/api/camps/${plan.value.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken ?? "",
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated: CampPlan = await res.json();
      plan.value = updated;
    } catch (_e) {
      error.value = "Failed to save changes. Please try again.";
    } finally {
      saving.value = false;
    }
  }

  function setStatus(status: CampPlanStatus) {
    patch({ status });
  }

  function togglePacked(itemId: string) {
    const items = plan.value.items.map((i) =>
      i.itemId === itemId ? { ...i, packedStatus: !i.packedStatus } : i
    );
    patch({ items });
  }

  function toggleReturned(itemId: string) {
    const items = plan.value.items.map((i) =>
      i.itemId === itemId ? { ...i, returnedStatus: !i.returnedStatus } : i
    );
    patch({ items });
  }

  const selectedIsFood = useComputed(() => selectedInv.value?.category === "food");

  function removeItem(itemId: string) {
    const items = plan.value.items.filter((i) => i.itemId !== itemId);
    patch({ items });
  }

  async function addItem() {
    if (!addingItem.value) return;
    const inv = allItems.find((i) => i.id === addingItem.value);
    if (!inv) return;
    const newEntry: CampPlanItem = {
      itemId: inv.id,
      itemName: inv.name,
      itemCategory: inv.category,
      itemLocation: inv.location,
      quantityPlanned: addQty.value,
      packedStatus: false,
      returnedStatus: false,
      notes: addNote.value.trim() || undefined,
    };
    const items = [...plan.value.items, newEntry];
    await patch({ items });
    addingItem.value = "";
    addQty.value = 1;
    addNote.value = "";
    itemSearch.value = "";
    showAddPanel.value = false;
  }

  const inputClass =
    "px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm";

  const selectedInv = useComputed(() => allItems.find((i) => i.id === addingItem.value));

  return (
    <div class="space-y-6">
      {/* ── Header card ── */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-100">{plan.value.name}</h3>
            <p class="text-purple-600 dark:text-purple-400 text-sm font-medium mt-0.5">
              📅 {formatDate(plan.value.campDate)}
              {plan.value.endDate && ` – ${formatDate(plan.value.endDate)}`}
            </p>
            {plan.value.location && (
              <p class="text-gray-500 dark:text-gray-400 text-sm mt-0.5">📍 {plan.value.location}</p>
            )}
            {plan.value.notes && (
              <p class="text-gray-500 dark:text-gray-400 text-sm mt-1 italic">{plan.value.notes}</p>
            )}
          </div>

          {/* Status selector */}
          {canEdit && (
            <div class="flex flex-wrap gap-1.5">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  disabled={saving.value || plan.value.status === s}
                  class={`text-xs font-medium px-3 py-1 rounded-full border transition-all ${
                    plan.value.status === s
                      ? STATUS_COLORS[s] + " font-bold ring-2 ring-offset-1 ring-purple-500"
                      : "bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                  } disabled:opacity-60`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Progress bars */}
        {totalItems.value > 0 && (
          <div class="mt-4 grid sm:grid-cols-2 gap-3">
            <div>
              <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>Gear packed</span>
                <span>
                  {packedGearCount.value}/{totalGear.value}
                  {totalFood.value > 0 && ` · ${packedFoodCount.value}/${totalFood.value} food`}
                </span>
              </div>
              <div class="bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div
                  class="bg-yellow-400 h-2 rounded-full transition-all"
                  style={{ width: `${totalGear.value ? Math.round((packedGearCount.value / totalGear.value) * 100) : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>Gear returned</span>
                <span>{returnedGearCount.value}/{totalGear.value}</span>
              </div>
              <div class="bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div
                  class="bg-green-400 h-2 rounded-full transition-all"
                  style={{ width: `${totalGear.value ? Math.round((returnedGearCount.value / totalGear.value) * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {canEdit && (
          <div class="mt-4 flex gap-2 flex-wrap">
            <a
              href={`/camps/${plan.value.id}/edit`}
              class="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              ✏️ Edit Details
            </a>
          </div>
        )}
      </div>

      {error.value && (
        <div class="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">
          {error.value}
        </div>
      )}

      {/* ── Add items panel ── */}
      {canEdit && (
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => { showAddPanel.value = !showAddPanel.value; }}
            class="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <span class="font-medium text-gray-800 dark:text-gray-100">➕ Add Items to Plan</span>
            <span class="text-gray-400">{showAddPanel.value ? "▲" : "▼"}</span>
          </button>

          {showAddPanel.value && (
            <div class="px-5 pb-5 border-t border-gray-100 dark:border-gray-700 pt-4 space-y-3">
              <input
                type="text"
                placeholder="Search inventory…"
                class={`${inputClass} w-full`}
                value={itemSearch.value}
                onInput={(e) => {
                  itemSearch.value = (e.target as HTMLInputElement).value;
                  addingItem.value = "";
                }}
              />

              {itemSearch.value && filteredInventory.value.length === 0 && (
                <p class="text-sm text-gray-500 dark:text-gray-400 italic">No matching items (already added items are hidden)</p>
              )}

              {filteredInventory.value.length > 0 && (
                <div class="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredInventory.value.slice(0, 50).map((inv) => (
                    <button
                      type="button"
                      key={inv.id}
                      onClick={() => { addingItem.value = inv.id; addQty.value = 1; }}
                      class={`w-full text-left px-3 py-2 text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors ${
                        addingItem.value === inv.id ? "bg-purple-50 dark:bg-purple-900/30" : ""
                      }`}
                    >
                      <span class="font-medium text-gray-800 dark:text-gray-100">{inv.name}</span>
                      <span class="text-gray-500 dark:text-gray-400 ml-2 text-xs">
                        {inv.category} · {inv.location} · qty in stock: {inv.quantity}
                        {inv.category === "food" && <span class="ml-1 text-orange-500 font-medium">🍽️ food</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {selectedInv.value && (
                <div class="space-y-3">
                  {selectedIsFood.value && (
                    <div class="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-md text-sm text-orange-800 dark:text-orange-300">
                      <span class="shrink-0 mt-0.5">⚠️</span>
                      <span>
                        <strong>Food item:</strong> when ticked as packed the quantity will be deducted
                        from inventory stock because it will be consumed at camp. It won't appear in the
                        return list.
                      </span>
                    </div>
                  )}
                  <div class="flex flex-wrap items-end gap-3">
                    <div>
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Quantity {selectedIsFood.value ? "(to take)" : "(to pack)"}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={selectedInv.value.quantity}
                        class={`${inputClass} w-24`}
                        value={addQty.value}
                        onInput={(e) => (addQty.value = parseInt((e.target as HTMLInputElement).value) || 1)}
                      />
                      <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">{selectedInv.value.quantity} in stock</p>
                    </div>
                    <div class="flex-1 min-w-0">
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Note (optional)</label>
                      <input
                        type="text"
                        class={`${inputClass} w-full`}
                        placeholder="e.g. bring spare pegs"
                        value={addNote.value}
                        onInput={(e) => (addNote.value = (e.target as HTMLInputElement).value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addItem}
                      disabled={saving.value}
                      class="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-60 transition-colors shrink-0"
                    >
                      {saving.value ? "…" : "Add"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Checklist tabs ── */}
      {totalItems.value === 0 ? (
        <div class="text-center py-10 text-gray-500 dark:text-gray-400">
          <div class="text-4xl mb-3">📦</div>
          <p>No items added yet. {canEdit ? "Use the panel above to add items from inventory." : ""}</p>
        </div>
      ) : (
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          {/* Tab bar */}
          <div class="flex border-b border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => (tab.value = "pack")}
              class={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab.value === "pack"
                  ? "border-b-2 border-purple-600 text-purple-600 dark:text-purple-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              📦 Packing List
              <span class="ml-2 text-xs">{packedGearCount.value + packedFoodCount.value}/{totalItems.value}</span>
            </button>
            <button
              type="button"
              onClick={() => (tab.value = "return")}
              class={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab.value === "return"
                  ? "border-b-2 border-purple-600 text-purple-600 dark:text-purple-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              🔁 Return List
              <span class="ml-2 text-xs">{returnedGearCount.value}/{totalGear.value} gear</span>
            </button>
          </div>

          {/* Checklist items */}
          {tab.value === "pack" ? (
            <div class="divide-y divide-gray-100 dark:divide-gray-700">
              {gearItems.value.length > 0 && (
                <>
                  {totalFood.value > 0 && (
                    <div class="px-4 py-2 bg-gray-50 dark:bg-gray-800/60 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Gear ({gearItems.value.length})
                    </div>
                  )}
                  {gearItems.value.map((item) => renderRow(item, "pack"))}
                </>
              )}
              {foodItems.value.length > 0 && (
                <>
                  <div class="px-4 py-2 bg-orange-50 dark:bg-orange-900/20 text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                    🍽️ Food — consumed at camp, qty deducted from stock when ticked ({foodItems.value.length})
                  </div>
                  {foodItems.value.map((item) => renderRow(item, "pack"))}
                </>
              )}
            </div>
          ) : (
            <div class="divide-y divide-gray-100 dark:divide-gray-700">
              {gearItems.value.length > 0
                ? gearItems.value.map((item) => renderRow(item, "return"))
                : <p class="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center italic">No gear items in this plan</p>
              }
              {foodItems.value.length > 0 && (
                <>
                  <div class="px-4 py-2 bg-orange-50 dark:bg-orange-900/20 text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                    🍽️ Food — consumed at camp, no return needed ({foodItems.value.length})
                  </div>
                  {foodItems.value.map((item) => renderRow(item, "return"))}
                </>
              )}
            </div>
          )}

          {/* Summary row */}
          <div class="border-t border-gray-100 dark:border-gray-700 px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/50 rounded-b-lg">
            <span>📦 {packedGearCount.value}/{totalGear.value} gear packed</span>
            {totalFood.value > 0 && <span>🍽️ {packedFoodCount.value}/{totalFood.value} food packed</span>}
            <span>🔁 {returnedGearCount.value}/{totalGear.value} gear returned</span>
            {saving.value && <span class="text-purple-500">Saving…</span>}
          </div>
        </div>
      )}
    </div>
  );

  function renderRow(item: CampPlanItem, mode: "pack" | "return") {
    const isFood = item.itemCategory === "food";
    const isConsumed = isFood && mode === "return";
    const checked = mode === "pack" ? item.packedStatus : item.returnedStatus;
    return (
      <div key={item.itemId} class={`flex items-start gap-3 px-4 py-3 transition-colors ${(checked || isConsumed) ? "bg-green-50/50 dark:bg-green-900/10" : ""}`}>
        {isConsumed ? (
          <div class="mt-0.5 shrink-0 w-6 h-6 rounded border-2 border-orange-300 dark:border-orange-600 flex items-center justify-center text-orange-400 text-xs select-none">
            🍽
          </div>
        ) : (
          <button
            type="button"
            onClick={() => mode === "pack" ? togglePacked(item.itemId) : toggleReturned(item.itemId)}
            disabled={saving.value || !canEdit}
            class={`mt-0.5 shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
              checked
                ? "bg-green-500 border-green-500 text-white"
                : "bg-white dark:bg-gray-700 border-gray-400 dark:border-gray-400 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20"
            } ${!canEdit ? "cursor-default" : "cursor-pointer"}`}
            aria-label={checked ? "Mark as not done" : "Mark as done"}
          >
            {checked && <span class="text-xs font-bold">✓</span>}
          </button>
        )}
        <div class="flex-1 min-w-0">
          <p class={`font-medium text-sm ${(checked || isConsumed) ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-800 dark:text-gray-100"}`}>
            {item.itemName}
            <span class="ml-2 font-normal text-gray-500 dark:text-gray-400">×{item.quantityPlanned}</span>
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">{item.itemCategory} · {item.itemLocation}</p>
          {item.notes && <p class="text-xs text-purple-600 dark:text-purple-400 mt-0.5 italic">{item.notes}</p>}
          <div class="flex flex-wrap gap-2 mt-1">
            {isFood ? (
              <span class={`text-xs px-1.5 py-0.5 rounded ${item.packedStatus ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}>
                {item.packedStatus ? "🍽️ Consumed — qty deducted from stock" : "Not yet packed"}
              </span>
            ) : (
              <>
                <span class={`text-xs px-1.5 py-0.5 rounded ${item.packedStatus ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}>
                  {item.packedStatus ? "📦 Packed" : "Not packed"}
                </span>
                <span class={`text-xs px-1.5 py-0.5 rounded ${item.returnedStatus ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : item.packedStatus ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}>
                  {item.returnedStatus ? "✓ Returned to store" : item.packedStatus ? "🏕️ At camp" : "Not returned"}
                </span>
              </>
            )}
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => removeItem(item.itemId)}
            disabled={saving.value}
            class="shrink-0 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors text-lg leading-none"
            title="Remove from plan"
          >×</button>
        )}
      </div>
    );
  }
}
