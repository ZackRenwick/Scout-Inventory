// Guided stock-take wizard island
import { useSignal, useComputed } from "@preact/signals";

export interface StocktakeItem {
  id: string;
  name: string;
  category: string;
  location: string;
  recordedQty: number;
  hasCondition: boolean;
  recordedCondition?: string;
}

interface StocktakeEntry extends StocktakeItem {
  countedQty: number;
  countedCondition?: string;
  skipped: boolean;
}

interface Props {
  items: StocktakeItem[];
  csrfToken?: string;
}

type Phase = "wizard" | "review" | "applying" | "done";

const CONDITIONS = ["excellent", "good", "fair", "needs-repair"] as const;

const CATEGORY_EMOJI: Record<string, string> = {
  tent: "⛺",
  cooking: "🍳",
  food: "🥫",
  "camping-tools": "🪓",
  games: "🎮",
};

const inputClass =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500";

export default function StocktakeWizard({ items: rawItems, csrfToken }: Props) {
  const entries = useSignal<StocktakeEntry[]>(
    rawItems.map((item) => ({
      ...item,
      countedQty: item.recordedQty,
      countedCondition: item.recordedCondition,
      skipped: false,
    })),
  );
  const currentIdx = useSignal(0);
  const phase = useSignal<Phase>("wizard");
  const applyError = useSignal<string | null>(null);
  const applyResult = useSignal<{ applied: number; errors: string[] } | null>(null);

  const total = entries.value.length;

  const current = useComputed(() => entries.value[currentIdx.value]);

  const discrepancies = useComputed(() =>
    entries.value.filter(
      (e) =>
        !e.skipped &&
        (e.countedQty !== e.recordedQty ||
          (e.hasCondition && e.countedCondition !== e.recordedCondition)),
    )
  );

  const skippedCount = useComputed(() => entries.value.filter((e) => e.skipped).length);

  function updateCurrentQty(qty: number) {
    const idx = currentIdx.value;
    entries.value = entries.value.map((e, i) =>
      i === idx ? { ...e, countedQty: qty } : e
    );
  }

  function updateCurrentCondition(cond: string) {
    const idx = currentIdx.value;
    entries.value = entries.value.map((e, i) =>
      i === idx ? { ...e, countedCondition: cond } : e
    );
  }

  function skipCurrent() {
    const idx = currentIdx.value;
    entries.value = entries.value.map((e, i) =>
      i === idx ? { ...e, skipped: true } : e
    );
    advance();
  }

  function unskipCurrent() {
    const idx = currentIdx.value;
    entries.value = entries.value.map((e, i) =>
      i === idx ? { ...e, skipped: false } : e
    );
  }

  function advance() {
    if (currentIdx.value < total - 1) {
      currentIdx.value = currentIdx.value + 1;
    } else {
      phase.value = "review";
    }
  }

  function goBack() {
    if (currentIdx.value > 0) {
      currentIdx.value = currentIdx.value - 1;
    }
  }

  async function applyChanges() {
    phase.value = "applying";
    applyError.value = null;

    const updates = discrepancies.value.map((e) => ({
      id: e.id,
      quantity: e.countedQty,
      ...(e.hasCondition && e.countedCondition ? { condition: e.countedCondition } : {}),
    }));

    try {
      const res = await fetch("/api/stocktake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken ?? "",
        },
        body: JSON.stringify({ updates }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to apply changes.");
      applyResult.value = data;
      phase.value = "done";
    } catch (e) {
      applyError.value = e instanceof Error ? e.message : "Failed to apply changes.";
      phase.value = "review";
    }
  }

  // ── DONE ────────────────────────────────────────────────────────────────────
  if (phase.value === "done") {
    const result = applyResult.value!;
    return (
      <div class="max-w-xl mx-auto text-center py-12">
        <div class="text-5xl mb-4">✅</div>
        <h2 class="text-2xl font-bold text-gray-800 dark:text-purple-100 mb-2">Stock-take Complete</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          {result.applied === 0
            ? "No corrections were needed — inventory is up to date."
            : `${result.applied} item${result.applied !== 1 ? "s" : ""} updated in inventory.`}
        </p>
        {result.errors.length > 0 && (
          <div class="mb-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-md text-sm text-left text-yellow-800 dark:text-yellow-300">
            <p class="font-semibold mb-1">Some updates failed:</p>
            <ul class="list-disc list-inside space-y-0.5">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}
        <div class="flex gap-3 justify-center">
          <a
            href="/inventory"
            class="px-5 py-2.5 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 transition-colors"
          >
            View Inventory
          </a>
          <a
            href="/admin/stocktake"
            class="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Run Another
          </a>
        </div>
      </div>
    );
  }

  // ── REVIEW ───────────────────────────────────────────────────────────────────
  if (phase.value === "review" || phase.value === "applying") {
    const applying = phase.value === "applying";
    return (
      <div class="max-w-3xl mx-auto">
        <div class="mb-6 flex items-center justify-between">
          <div>
            <h3 class="text-xl font-bold text-gray-800 dark:text-purple-100">Review Discrepancies</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {discrepancies.value.length} discrepanc{discrepancies.value.length !== 1 ? "ies" : "y"} found
              {skippedCount.value > 0 && ` · ${skippedCount.value} skipped`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { currentIdx.value = 0; phase.value = "wizard"; }}
            class="text-sm text-purple-600 dark:text-purple-400 hover:underline"
          >
            ← Back to wizard
          </button>
        </div>

        {applyError.value && (
          <div class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">
            {applyError.value}
          </div>
        )}

        {discrepancies.value.length === 0 ? (
          <div class="text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg mb-6">
            <div class="text-4xl mb-2">🎉</div>
            <p class="text-gray-600 dark:text-gray-400 font-medium">No discrepancies found</p>
            <p class="text-sm text-gray-500 dark:text-gray-500 mt-1">All counted quantities match the records.</p>
          </div>
        ) : (
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm mb-6 overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Item</th>
                  <th class="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-300">Recorded</th>
                  <th class="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-300">Counted</th>
                  <th class="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-300">Δ Qty</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                {discrepancies.value.map((e) => {
                  const qtyDiff = e.countedQty - e.recordedQty;
                  const condChanged = e.hasCondition && e.countedCondition !== e.recordedCondition;
                  return (
                    <tr key={e.id} class="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td class="px-4 py-3">
                        <div class="font-medium text-gray-800 dark:text-gray-100">{e.name}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">{e.location}</div>
                        {condChanged && (
                          <div class="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                            Condition: {e.recordedCondition} → {e.countedCondition}
                          </div>
                        )}
                      </td>
                      <td class="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{e.recordedQty}</td>
                      <td class="px-4 py-3 text-center font-semibold text-gray-900 dark:text-gray-100">{e.countedQty}</td>
                      <td class="px-4 py-3 text-center">
                        <span class={`font-bold ${qtyDiff > 0 ? "text-green-600 dark:text-green-400" : qtyDiff < 0 ? "text-red-600 dark:text-red-400" : "text-gray-500"}`}>
                          {qtyDiff === 0 ? "—" : qtyDiff > 0 ? `+${qtyDiff}` : qtyDiff}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div class="flex gap-3">
          <button
            type="button"
            disabled={applying || discrepancies.value.length === 0}
            onClick={applyChanges}
            class="flex-1 py-3 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {applying ? "Applying…" : `Apply ${discrepancies.value.length} Correction${discrepancies.value.length !== 1 ? "s" : ""}`}
          </button>
          {discrepancies.value.length === 0 && (
            <button
              type="button"
              disabled={applying}
              onClick={() => { applyResult.value = { applied: 0, errors: [] }; phase.value = "done"; }}
              class="flex-1 py-3 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              ✓ Confirm — No Changes Needed
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── WIZARD ───────────────────────────────────────────────────────────────────
  const entry = current.value;
  const idx = currentIdx.value;
  const progressPct = Math.round((idx / total) * 100);
  const qtyChanged = entry.countedQty !== entry.recordedQty;
  const condChanged = entry.hasCondition && entry.countedCondition !== entry.recordedCondition;

  return (
    <div class="max-w-xl mx-auto">
      {/* Progress */}
      <div class="mb-6">
        <div class="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1.5">
          <span>Item {idx + 1} of {total}</span>
          <span>{skippedCount.value > 0 && `${skippedCount.value} skipped · `}{discrepancies.value.length} discrepanc{discrepancies.value.length !== 1 ? "ies" : "y"} so far</span>
        </div>
        <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            class="h-full bg-purple-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Item card */}
      <div class={`bg-white dark:bg-gray-800 rounded-lg shadow border p-6 mb-5 ${
        entry.skipped
          ? "border-gray-300 dark:border-gray-600 opacity-60"
          : "border-gray-200 dark:border-gray-700"
      }`}>
        {/* Header */}
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xl">{CATEGORY_EMOJI[entry.category] ?? "📦"}</span>
              <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">{entry.name}</h3>
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400">{entry.location}</p>
          </div>
          {entry.skipped && (
            <span class="shrink-0 text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              Skipped
            </span>
          )}
        </div>

        {entry.skipped ? (
          <button
            type="button"
            onClick={unskipCurrent}
            class="w-full py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            ↩ Undo skip — count this item
          </button>
        ) : (
          <div class="space-y-4">
            {/* Quantity */}
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Actual count
                </label>
                <span class="text-xs text-gray-400 dark:text-gray-500">
                  Recorded: {entry.recordedQty}
                  {qtyChanged && (
                    <span class={`ml-2 font-semibold ${entry.countedQty > entry.recordedQty ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                      ({entry.countedQty > entry.recordedQty ? "+" : ""}{entry.countedQty - entry.recordedQty})
                    </span>
                  )}
                </span>
              </div>
              <input
                type="number"
                min={0}
                class={inputClass}
                value={entry.countedQty}
                onInput={(e) => updateCurrentQty(Math.max(0, parseInt((e.target as HTMLInputElement).value) || 0))}
              />
            </div>

            {/* Condition */}
            {entry.hasCondition && (
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Condition</label>
                  {condChanged && (
                    <span class="text-xs text-orange-500 dark:text-orange-400 font-medium">Changed</span>
                  )}
                </div>
                <select
                  class={inputClass}
                  value={entry.countedCondition ?? ""}
                  onChange={(e) => updateCurrentCondition((e.target as HTMLSelectElement).value)}
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1).replace("-", " ")}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div class="flex gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={idx === 0}
          class="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          ← Back
        </button>
        {!entry.skipped && (
          <button
            type="button"
            onClick={skipCurrent}
            class="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Skip
          </button>
        )}
        <button
          type="button"
          onClick={advance}
          class="flex-1 py-2.5 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 transition-colors"
        >
          {idx === total - 1 ? "Finish & Review →" : "Next →"}
        </button>
      </div>

      {/* Jump to review */}
      {idx > 0 && (
        <div class="mt-4 text-center">
          <button
            type="button"
            onClick={() => (phase.value = "review")}
            class="text-sm text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
          >
            Jump to review (skip remaining items)
          </button>
        </div>
      )}
    </div>
  );
}
