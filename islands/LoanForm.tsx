// Island for creating a new loan record
import { useSignal, useComputed } from "@preact/signals";

export interface LoanableItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  location: string;
}

interface LoanFormProps {
  items: LoanableItem[];
  csrfToken?: string;
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

/** Default expected return date: 4 weeks from today. */
function defaultReturnDateIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 28);
  return d.toISOString().split("T")[0];
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500";
const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

export default function LoanForm({ items, csrfToken }: LoanFormProps) {
  const search = useSignal("");
  const selectedItem = useSignal<LoanableItem | null>(null);
  const borrower = useSignal("");
  const quantity = useSignal(1);
  const expectedReturn = useSignal(defaultReturnDateIso());
  const notes = useSignal("");
  const saving = useSignal(false);
  const error = useSignal<string | null>(null);
  const showDropdown = useSignal(false);

  const filtered = useComputed(() => {
    const q = search.value.toLowerCase().trim();
    if (!q) return items.slice(0, 10);
    return items
      .filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          i.location.toLowerCase().includes(q),
      )
      .slice(0, 10);
  });

  function selectItem(item: LoanableItem) {
    selectedItem.value = item;
    search.value = item.name;
    showDropdown.value = false;
    // Clamp quantity to the newly-selected item's stock
    if (quantity.value > item.quantity) {
      quantity.value = item.quantity;
    }
    if (quantity.value < 1) quantity.value = 1;
  }

  function clearSelection() {
    selectedItem.value = null;
    search.value = "";
    quantity.value = 1;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!selectedItem.value) {
      error.value = "Please select an item to loan.";
      return;
    }
    if (!borrower.value.trim()) {
      error.value = "Please enter the borrower's name or organisation.";
      return;
    }
    if (!expectedReturn.value) {
      error.value = "Please set an expected return date.";
      return;
    }
    if (expectedReturn.value <= todayIso()) {
      error.value = "Expected return date must be in the future.";
      return;
    }
    const qty = quantity.value;
    if (!Number.isInteger(qty) || qty < 1 || qty > selectedItem.value.quantity) {
      error.value = `Quantity must be between 1 and ${selectedItem.value.quantity}.`;
      return;
    }

    saving.value = true;
    error.value = null;

    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken ?? "",
        },
        body: JSON.stringify({
          itemId: selectedItem.value.id,
          borrower: borrower.value.trim(),
          quantity: qty,
          expectedReturnDate: expectedReturn.value,
          notes: notes.value.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create loan.");
      }

      globalThis.location.href = "/loans";
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to create loan.";
      saving.value = false;
    }
  }

  return (
    <form onSubmit={handleSubmit} class="space-y-5">
      {error.value && (
        <div class="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">
          {error.value}
        </div>
      )}

      {/* Item picker */}
      <div class="relative">
        <label class={labelClass}>Item *</label>
        <div class="flex gap-2">
          <input
            type="text"
            class={inputClass}
            value={search.value}
            placeholder="Search by name, category, or location…"
            onInput={(e) => {
              search.value = (e.target as HTMLInputElement).value;
              selectedItem.value = null;
              showDropdown.value = true;
            }}
            onFocus={() => {
              if (!selectedItem.value) showDropdown.value = true;
            }}
            onBlur={() => {
              // Brief delay so click on dropdown item fires first
              setTimeout(() => { showDropdown.value = false; }, 150);
            }}
            autocomplete="off"
          />
          {selectedItem.value && (
            <button
              type="button"
              class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              onClick={clearSelection}
              title="Clear selection"
            >
              ✕
            </button>
          )}
        </div>

        {showDropdown.value && !selectedItem.value && (
          <div class="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {filtered.value.length === 0 ? (
              <p class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No items match your search.</p>
            ) : (
              filtered.value.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  class="w-full text-left px-4 py-2.5 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                  onClick={() => selectItem(item)}
                >
                  <span class="font-medium text-gray-800 dark:text-gray-100">{item.name}</span>
                  <span class="ml-2 text-xs text-gray-500 dark:text-gray-400">
                    {item.category} · {item.location} · {item.quantity} in stock
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {selectedItem.value && (
          <p class="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            {selectedItem.value.category} · {selectedItem.value.location} ·{" "}
            <strong class="text-gray-700 dark:text-gray-300">{selectedItem.value.quantity} in stock</strong>
          </p>
        )}
      </div>

      {/* Borrower */}
      <div>
        <label class={labelClass}>Borrower / Organisation *</label>
        <input
          type="text"
          class={inputClass}
          value={borrower.value}
          onInput={(e) => (borrower.value = (e.target as HTMLInputElement).value)}
          placeholder="e.g. 12th Edinburgh Scouts"
          required
        />
      </div>

      {/* Quantity + expected return */}
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class={labelClass}>Quantity *</label>
          <input
            type="number"
            class={inputClass}
            min={1}
            max={selectedItem.value?.quantity ?? undefined}
            value={quantity.value}
            onInput={(e) => (quantity.value = Number((e.target as HTMLInputElement).value))}
            required
          />
          {selectedItem.value && (
            <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Max: {selectedItem.value.quantity}
            </p>
          )}
        </div>
        <div>
          <label class={labelClass}>Expected Return *</label>
          <input
            type="date"
            class={inputClass}
            min={todayIso()}
            value={expectedReturn.value}
            onInput={(e) => (expectedReturn.value = (e.target as HTMLInputElement).value)}
            required
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label class={labelClass}>Notes</label>
        <textarea
          class={`${inputClass} resize-none`}
          rows={3}
          value={notes.value}
          onInput={(e) => (notes.value = (e.target as HTMLTextAreaElement).value)}
          placeholder="Contact details, purpose, any conditions…"
        />
      </div>

      <div class="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving.value || !selectedItem.value}
          class="flex-1 py-2.5 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving.value ? "Recording loan…" : "Record Loan"}
        </button>
        <a
          href="/loans"
          class="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
