// Camp checklist island — full management for a single camp plan
import { useSignal, useComputed } from "@preact/signals";
import type { CampPlan, CampPlanItem, CampPlanStatus, CampTemplate, InventoryItem } from "../types/inventory.ts";
import { ITEM_LOCATIONS } from "../types/inventory.ts";
import { formatDate } from "../lib/date-utils.ts";

interface CampChecklistProps {
  plan: CampPlan;
  allItems: InventoryItem[];
  templates: CampTemplate[];
  canEdit: boolean;
  csrfToken?: string;
}

const BOX_LOCATIONS = ITEM_LOCATIONS.find((g) => g.group === "Boxes")?.options ?? [];

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

export default function CampChecklist({ plan: initialPlan, allItems, templates: initialTemplates, canEdit, csrfToken }: CampChecklistProps) {
  const plan = useSignal<CampPlan>(initialPlan);
  const tab = useSignal<Tab>("pack");
  const saving = useSignal(false);
  const error = useSignal<string | null>(null);
  const itemSearch = useSignal("");
  const addingItem = useSignal<string>(""); // item id to add
  const addQty = useSignal(1);
  const addNote = useSignal("");
  const showAddPanel = useSignal(false);
  const addMode = useSignal<"item" | "box" | "template">("item");
  const selectedBox = useSignal("");
  // Template signals
  const templates = useSignal<CampTemplate[]>(initialTemplates);
  const selectedTemplateId = useSignal("");
  const showSaveTemplate = useSignal(false);
  const templateName = useSignal("");
  const templateDesc = useSignal("");
  const savingTemplate = useSignal(false);
  const templateSaved = useSignal(false);

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

  function returnAll() {
    const items = plan.value.items.map((i) =>
      i.itemCategory !== "food" ? { ...i, returnedStatus: true } : i
    );
    patch({ items });
  }

  const selectedIsFood = useComputed(() => selectedInv.value?.category === "food");

  function removeItem(itemId: string) {
    const items = plan.value.items.filter((i) => i.itemId !== itemId);
    patch({ items });
  }

  async function addItem() {
    if (!addingItem.value) {
      return;
    }
    const inv = allItems.find((i) => i.id === addingItem.value);
    if (!inv) {
      return;
    }
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

  const boxItems = useComputed(() => {
    if (!selectedBox.value) return [];
    return allItems.filter(
      (i) => i.location === selectedBox.value && !planItemIds.value.has(i.id)
    );
  });

  const availableBoxes = useComputed(() =>
    BOX_LOCATIONS.filter((box) =>
      allItems.some((i) => i.location === box && !planItemIds.value.has(i.id))
    )
  );

  async function addWholeBox() {
    if (!selectedBox.value || boxItems.value.length === 0) return;
    const newEntries: CampPlanItem[] = boxItems.value.map((inv) => ({
      itemId: inv.id,
      itemName: inv.name,
      itemCategory: inv.category,
      itemLocation: inv.location,
      quantityPlanned: inv.quantity,
      packedStatus: false,
      returnedStatus: false,
    }));
    const items = [...plan.value.items, ...newEntries];
    await patch({ items });
    selectedBox.value = "";
    showAddPanel.value = false;
  }

  const selectedTemplate = useComputed(() =>
    templates.value.find((t) => t.id === selectedTemplateId.value)
  );

  const templateNewItems = useComputed(() => {
    if (!selectedTemplate.value) return [];
    return selectedTemplate.value.items.filter((ti) => !planItemIds.value.has(ti.itemId));
  });

  async function importTemplate() {
    if (!selectedTemplate.value || templateNewItems.value.length === 0) return;
    const newEntries: CampPlanItem[] = templateNewItems.value.map((ti) => ({
      itemId: ti.itemId,
      itemName: ti.itemName,
      itemCategory: ti.itemCategory,
      itemLocation: ti.itemLocation,
      quantityPlanned: ti.quantityPlanned,
      packedStatus: false,
      returnedStatus: false,
      notes: ti.notes,
    }));
    const items = [...plan.value.items, ...newEntries];
    await patch({ items });
    selectedTemplateId.value = "";
    showAddPanel.value = false;
  }

  async function saveAsTemplate() {
    const name = templateName.value.trim();
    if (!name) return;
    savingTemplate.value = true;
    error.value = null;
    try {
      const res = await fetch("/api/camp-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken ?? "",
        },
        body: JSON.stringify({
          name,
          description: templateDesc.value.trim() || undefined,
          items: plan.value.items
            .filter((i) => i.itemCategory !== "food")
            .map((i) => ({
              itemId: i.itemId,
              itemName: i.itemName,
              itemCategory: i.itemCategory,
              itemLocation: i.itemLocation,
              quantityPlanned: i.quantityPlanned,
              notes: i.notes,
            })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save template");
      }
      const saved: CampTemplate = await res.json();
      templates.value = [...templates.value, saved].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      templateName.value = "";
      templateDesc.value = "";
      showSaveTemplate.value = false;
      templateSaved.value = true;
      setTimeout(() => { templateSaved.value = false; }, 3000);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to save template.";
    } finally {
      savingTemplate.value = false;
    }
  }

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
          <div class="mt-4 flex gap-2 flex-wrap items-start">
            <a
              href={`/camps/${plan.value.id}/edit`}
              class="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              ✏️ Edit Details
            </a>
            {plan.value.items.filter((i) => i.itemCategory !== "food").length > 0 && (
              <div class="flex flex-col gap-2">
                {!showSaveTemplate.value ? (
                  <button
                    type="button"
                    onClick={() => { showSaveTemplate.value = true; }}
                    class="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    📋 Save as template
                  </button>
                ) : (
                  <div class="flex flex-col gap-2 p-3 border border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 rounded-md">
                    <p class="text-xs font-medium text-purple-700 dark:text-purple-300">Save equipment list as a reusable template (food items excluded):</p>
                    <input
                      type="text"
                      placeholder="Template name (e.g. Weekend camp kit)"
                      maxLength={80}
                      value={templateName.value}
                      onInput={(e) => { templateName.value = (e.target as HTMLInputElement).value; }}
                      class="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="text"
                      placeholder="Description (optional)"
                      value={templateDesc.value}
                      onInput={(e) => { templateDesc.value = (e.target as HTMLInputElement).value; }}
                      class="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <div class="flex gap-2">
                      <button
                        type="button"
                        onClick={saveAsTemplate}
                        disabled={savingTemplate.value || !templateName.value.trim()}
                        class="text-sm px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-60 transition-colors"
                      >
                        {savingTemplate.value ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { showSaveTemplate.value = false; templateName.value = ""; templateDesc.value = ""; }}
                        class="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {templateSaved.value && (
                  <p class="text-xs text-green-600 dark:text-green-400">✓ Template saved!</p>
                )}
              </div>
            )}
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
              {/* Mode tabs */}
              <div class="flex gap-2">
                <button
                  type="button"
                  onClick={() => { addMode.value = "item"; selectedBox.value = ""; }}
                  class={`flex-1 text-sm px-2 py-2 rounded-md border transition-colors text-center leading-tight ${
                    addMode.value === "item"
                      ? "bg-purple-600 text-white border-purple-600"
                      : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  🔍 Individual item
                </button>
                <button
                  type="button"
                  onClick={() => { addMode.value = "box"; addingItem.value = ""; itemSearch.value = ""; selectedTemplateId.value = ""; }}
                  class={`flex-1 text-sm px-2 py-2 rounded-md border transition-colors text-center leading-tight ${
                    addMode.value === "box"
                      ? "bg-purple-600 text-white border-purple-600"
                      : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  📦 Add whole box
                </button>
                {templates.value.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { addMode.value = "template"; addingItem.value = ""; itemSearch.value = ""; selectedBox.value = ""; }}
                    class={`flex-1 text-sm px-2 py-2 rounded-md border transition-colors text-center leading-tight ${
                      addMode.value === "template"
                        ? "bg-purple-600 text-white border-purple-600"
                        : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    📋 From template
                  </button>
                )}
              </div>

              {addMode.value === "box" ? (
                <div class="space-y-3">
                  <p class="text-xs text-gray-500 dark:text-gray-400">Select a box to add all its contents to the plan at once.</p>
                  {availableBoxes.value.length === 0 ? (
                    <p class="text-sm text-gray-500 dark:text-gray-400 italic">All box items are already in this plan.</p>
                  ) : (
                    <div class="flex flex-wrap gap-2">
                      {availableBoxes.value.map((box) => (
                        <button
                          type="button"
                          key={box}
                          onClick={() => { selectedBox.value = selectedBox.value === box ? "" : box; }}
                          class={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
                            selectedBox.value === box
                              ? "bg-purple-100 dark:bg-purple-900/40 border-purple-500 text-purple-800 dark:text-purple-200 font-medium"
                              : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          }`}
                        >
                          📦 {box}
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedBox.value && boxItems.value.length > 0 && (
                    <div class="space-y-2">
                      <p class="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {boxItems.value.length} item{boxItems.value.length !== 1 ? "s" : ""} will be added from <strong>{selectedBox.value}</strong>:
                      </p>
                      <div class="border border-gray-200 dark:border-gray-600 rounded-md divide-y divide-gray-100 dark:divide-gray-700 max-h-40 overflow-y-auto">
                        {boxItems.value.map((inv) => (
                          <div key={inv.id} class="px-3 py-2 text-sm">
                            <span class="font-medium text-gray-800 dark:text-gray-100">{inv.name}</span>
                            <span class="text-gray-500 dark:text-gray-400 ml-2 text-xs">
                              {inv.category} · qty: {inv.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={addWholeBox}
                        disabled={saving.value}
                        class="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-60 transition-colors"
                      >
                        {saving.value ? "…" : `Add all ${boxItems.value.length} item${boxItems.value.length !== 1 ? "s" : ""} from ${selectedBox.value}`}
                      </button>
                    </div>
                  )}
                </div>
              ) : addMode.value === "template" ? (
                <div class="space-y-3">
                  <p class="text-xs text-gray-500 dark:text-gray-400">Select a template to import its equipment items (already-added items are skipped).</p>
                  {templates.value.length === 0 ? (
                    <p class="text-sm text-gray-500 dark:text-gray-400 italic">No templates saved yet. Add items and use "Save as template" to create one.</p>
                  ) : (
                    <div class="flex flex-wrap gap-2">
                      {templates.value.map((t) => (
                        <button
                          type="button"
                          key={t.id}
                          onClick={() => { selectedTemplateId.value = selectedTemplateId.value === t.id ? "" : t.id; }}
                          class={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
                            selectedTemplateId.value === t.id
                              ? "bg-purple-100 dark:bg-purple-900/40 border-purple-500 text-purple-800 dark:text-purple-200 font-medium"
                              : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          }`}
                        >
                          📋 {t.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedTemplate.value && (
                    <div class="space-y-2">
                      {selectedTemplate.value.description && (
                        <p class="text-xs text-gray-500 dark:text-gray-400 italic">{selectedTemplate.value.description}</p>
                      )}
                      {templateNewItems.value.length === 0 ? (
                        <p class="text-sm text-gray-500 dark:text-gray-400 italic">All items from this template are already in the plan.</p>
                      ) : (
                        <>
                          <p class="text-xs font-medium text-gray-600 dark:text-gray-400">
                            {templateNewItems.value.length} item{templateNewItems.value.length !== 1 ? "s" : ""} will be added from <strong>{selectedTemplate.value.name}</strong>:
                          </p>
                          <div class="border border-gray-200 dark:border-gray-600 rounded-md divide-y divide-gray-100 dark:divide-gray-700 max-h-40 overflow-y-auto">
                            {templateNewItems.value.map((ti) => (
                              <div key={ti.itemId} class="px-3 py-2 text-sm">
                                <span class="font-medium text-gray-800 dark:text-gray-100">{ti.itemName}</span>
                                <span class="text-gray-500 dark:text-gray-400 ml-2 text-xs">
                                  {ti.itemCategory} · qty: {ti.quantityPlanned}
                                </span>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={importTemplate}
                            disabled={saving.value}
                            class="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-60 transition-colors"
                          >
                            {saving.value ? "…" : `Add ${templateNewItems.value.length} item${templateNewItems.value.length !== 1 ? "s" : ""} from ${selectedTemplate.value.name}`}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
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
                      <div class="flex items-baseline justify-between gap-2">
                        <span class="font-medium text-gray-800 dark:text-gray-100 truncate">{inv.name}</span>
                        <span class="text-gray-500 dark:text-gray-400 text-xs shrink-0">
                          qty: {inv.quantity}{inv.category === "food" && <span class="ml-1 text-orange-500">🍽️</span>}
                        </span>
                      </div>
                      <div class="text-gray-400 dark:text-gray-500 text-xs truncate mt-0.5">
                        {inv.category} · {inv.location}
                      </div>
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
                  <div class="flex items-end gap-2">
                    <div class="shrink-0 w-24">
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        {selectedIsFood.value ? "Qty (to take)" : "Qty (to pack)"}
                        <span class="font-normal text-gray-400 dark:text-gray-500 ml-1">· {selectedInv.value.quantity} in stock</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={selectedInv.value.quantity}
                        class={`${inputClass} w-full`}
                        value={addQty.value}
                        onInput={(e) => (addQty.value = parseInt((e.target as HTMLInputElement).value) || 1)}
                      />
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
                      class="shrink-0 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-60 transition-colors"
                    >
                      {saving.value ? "…" : "Add"}
                    </button>
                  </div>
                </div>
              )}
              </>
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
              {gearItems.value.length > 0 && returnedGearCount.value < totalGear.value && canEdit && (
                <div class="px-4 py-2 flex justify-end bg-gray-50 dark:bg-gray-800/60">
                  <button
                    type="button"
                    onClick={returnAll}
                    disabled={saving.value}
                    class="text-xs font-medium px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60 transition-colors"
                  >
                    ✓ Mark all returned
                  </button>
                </div>
              )}
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
