import { useComputed, useSignal } from "@preact/signals";
import {
  buildEntriesFromProfile,
  FIRST_AID_PROFILES,
  getCatalogItemName,
} from "../lib/firstAidCatalog.ts";
import type { FirstAidCatalogItem, FirstAidKitEntry } from "../types/firstAid.ts";

interface FirstAidKitEditorProps {
  kitId: string;
  initialName: string;
  initialProfileId?: string;
  initialEntries: FirstAidKitEntry[];
  catalog: FirstAidCatalogItem[];
  csrfToken: string;
}

export default function FirstAidKitEditor({
  kitId,
  initialName,
  initialProfileId,
  initialEntries,
  catalog,
  csrfToken,
}: FirstAidKitEditorProps) {
  const kitName = useSignal(initialName);
  const profileId = useSignal(initialProfileId ?? "custom");
  const entries = useSignal<FirstAidKitEntry[]>([...initialEntries]);
  const renameValue = useSignal(initialName);
  const selectedProfileId = useSignal(
    initialProfileId && FIRST_AID_PROFILES.some((p) => p.id === initialProfileId)
      ? initialProfileId
      : FIRST_AID_PROFILES[0]?.id ?? "",
  );
  const addItemId = useSignal(catalog[0]?.id ?? "");
  const addQty = useSignal(1);
  const qtyByItem = useSignal<Record<string, number>>(
    Object.fromEntries(initialEntries.map((entry) => [entry.itemId, entry.quantityTarget])),
  );
  const pending = useSignal(false);
  const toast = useSignal<{ message: string; type: "success" | "error" } | null>(null);

  const sortedEntries = useComputed(() =>
    [...entries.value].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  );

  function showToast(message: string, type: "success" | "error") {
    toast.value = { message, type };
    setTimeout(() => {
      toast.value = null;
    }, 2500);
  }

  async function postAction(action: string, fields: Record<string, string>): Promise<boolean> {
    const formData = new FormData();
    formData.set("_csrf", csrfToken);
    formData.set("action", action);
    formData.set("kitId", kitId);
    for (const [key, value] of Object.entries(fields)) {
      formData.set(key, value);
    }

    pending.value = true;
    try {
      const res = await fetch("/first-aid", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      if (!res.ok) {
        showToast("Save failed. Please try again.", "error");
        return false;
      }
      return true;
    } catch {
      showToast("Network error. Could not save changes.", "error");
      return false;
    } finally {
      pending.value = false;
    }
  }

  async function onRenameSubmit(e: Event) {
    e.preventDefault();
    const name = renameValue.value.trim();
    if (!name || name.length > 80) {
      showToast("Kit name must be 1-80 characters.", "error");
      return;
    }

    const ok = await postAction("rename_kit", { name });
    if (!ok) return;

    kitName.value = name;
    showToast("Kit name saved.", "success");
  }

  async function onApplyProfileSubmit(e: Event) {
    e.preventDefault();
    const nextProfileId = selectedProfileId.value;
    if (!nextProfileId) {
      showToast("Select a profile first.", "error");
      return;
    }

    const ok = await postAction("apply_profile", { profileId: nextProfileId });
    if (!ok) return;

    entries.value = buildEntriesFromProfile(nextProfileId, catalog);
    qtyByItem.value = Object.fromEntries(
      entries.value.map((entry) => [entry.itemId, entry.quantityTarget]),
    );
    profileId.value = nextProfileId;
    showToast("Profile applied.", "success");
  }

  async function onAddItemSubmit(e: Event) {
    e.preventDefault();
    const itemId = addItemId.value;
    const quantityTarget = Math.max(1, Math.min(999, Number(addQty.value) || 1));
    const name = getCatalogItemName(itemId, catalog);

    if (!itemId || !name) {
      showToast("Select a valid catalog item.", "error");
      return;
    }

    const ok = await postAction("add_item", {
      itemId,
      quantity: String(quantityTarget),
    });
    if (!ok) return;

    const idx = entries.value.findIndex((entry) => entry.itemId === itemId);
    if (idx >= 0) {
      const next = [...entries.value];
      next[idx] = { ...next[idx], quantityTarget };
      entries.value = next;
    } else {
      entries.value = [...entries.value, { itemId, name, quantityTarget }];
    }
    qtyByItem.value = {
      ...qtyByItem.value,
      [itemId]: quantityTarget,
    };
    profileId.value = "custom";
    showToast("Item saved.", "success");
  }

  async function onUpdateQtySubmit(e: Event, itemId: string) {
    e.preventDefault();
    const current = qtyByItem.value[itemId] ?? 0;
    const quantityTarget = Math.max(0, Math.min(999, Number(current) || 0));

    const ok = await postAction("update_qty", {
      itemId,
      quantity: String(quantityTarget),
    });
    if (!ok) return;

    entries.value = entries.value.map((entry) =>
      entry.itemId === itemId ? { ...entry, quantityTarget } : entry
    );
    qtyByItem.value = {
      ...qtyByItem.value,
      [itemId]: quantityTarget,
    };
    showToast("Quantity updated.", "success");
  }

  async function onRemoveItem(itemId: string) {
    const ok = await postAction("remove_item", { itemId });
    if (!ok) return;

    entries.value = entries.value.filter((entry) => entry.itemId !== itemId);
    const nextQty = { ...qtyByItem.value };
    delete nextQty[itemId];
    qtyByItem.value = nextQty;
    profileId.value = "custom";
    showToast("Item removed.", "success");
  }

  return (
    <div class="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
      {toast.value && (
        <div class="fixed bottom-4 right-4 z-50 pointer-events-none">
          <div
            role="status"
            aria-live="polite"
            class={`rounded-md px-3 py-2 text-sm shadow-lg border pointer-events-auto ${
              toast.value.type === "success"
                ? "bg-green-600 border-green-700 text-white"
                : "bg-red-600 border-red-700 text-white"
            }`}
          >
            {toast.value.type === "success" ? "Success: " : "Error: "}
            {toast.value.message}
          </div>
        </div>
      )}

      <div class="mt-4 grid grid-cols-1 gap-3">
        <form onSubmit={onRenameSubmit} class="flex gap-2 items-end">
          <div class="flex-1">
            <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              Rename Kit
            </label>
            <input
              value={renameValue.value}
              onInput={(e) => {
                const target = e.currentTarget as HTMLInputElement;
                renameValue.value = target.value;
              }}
              maxLength={80}
              disabled={pending.value}
              class="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={pending.value}
            class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-60"
          >
            Save
          </button>
        </form>

        <form onSubmit={onApplyProfileSubmit} class="flex gap-2 items-end">
          <div class="flex-1">
            <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              Autofill / Replace From Profile
            </label>
            <select
              value={selectedProfileId.value}
              onInput={(e) => {
                const target = e.currentTarget as HTMLSelectElement;
                selectedProfileId.value = target.value;
              }}
              disabled={pending.value}
              class="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            >
              {FIRST_AID_PROFILES.map((profile) => (
                <option key={`${kitId}-${profile.id}`} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={pending.value}
            class="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:opacity-60"
          >
            Apply
          </button>
        </form>
      </div>

      <div class="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Editing: <strong>{kitName.value}</strong> ({entries.value.length} item{entries.value.length === 1 ? "" : "s"})
      </div>
      <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Profile: {profileId.value === "custom" ? "Custom" : profileId.value}
      </div>

      <div class="mt-4 overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-left border-b border-gray-200 dark:border-gray-700">
              <th class="py-2 pr-2 text-gray-500 dark:text-gray-400">Item</th>
              <th class="py-2 pr-2 text-gray-500 dark:text-gray-400">Target Qty</th>
              <th class="py-2 text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.value.map((entry) => (
              <tr
                key={`${kitId}-${entry.itemId}`}
                class="border-b border-gray-100 dark:border-gray-800"
              >
                <td class="py-2 pr-2 text-gray-900 dark:text-gray-100">{entry.name}</td>
                <td class="py-2 pr-2">
                  <form
                    onSubmit={(e) => onUpdateQtySubmit(e, entry.itemId)}
                    class="flex items-center gap-2"
                  >
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={qtyByItem.value[entry.itemId] ?? entry.quantityTarget}
                      disabled={pending.value}
                      onInput={(e) => {
                        const target = e.currentTarget as HTMLInputElement;
                        const raw = Number.parseInt(target.value, 10);
                        qtyByItem.value = {
                          ...qtyByItem.value,
                          [entry.itemId]: Number.isNaN(raw) ? 0 : raw,
                        };
                      }}
                      class="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                    <button
                      type="submit"
                      disabled={pending.value}
                      class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-60"
                    >
                      Save
                    </button>
                  </form>
                </td>
                <td class="py-2">
                  <button
                    type="button"
                    disabled={pending.value}
                    onClick={() => onRemoveItem(entry.itemId)}
                    class="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-60"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        onSubmit={onAddItemSubmit}
        class="mt-4 grid grid-cols-1 md:grid-cols-4 gap-2 items-end"
      >
        <div class="md:col-span-2">
          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">
            Add Catalog Item
          </label>
          <select
            value={addItemId.value}
            disabled={pending.value}
            onInput={(e) => {
              const target = e.currentTarget as HTMLSelectElement;
              addItemId.value = target.value;
            }}
            class="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          >
            {catalog.map((item) => (
              <option key={`${kitId}-add-${item.id}`} value={item.id}>
                {item.section} - {item.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">
            Qty
          </label>
          <input
            type="number"
            min={1}
            max={999}
            value={addQty.value}
            disabled={pending.value}
            onInput={(e) => {
              const target = e.currentTarget as HTMLInputElement;
              const raw = Number.parseInt(target.value, 10);
              addQty.value = Number.isNaN(raw) ? 1 : raw;
            }}
            class="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={pending.value}
          class="px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-60"
        >
          Add / Update
        </button>
      </form>
    </div>
  );
}
