// Interactive camp meal planner — select meals, enter headcount, see shopping list
import { useState } from "preact/hooks";
import type { Meal, FoodItemSummary } from "../types/meals.ts";

interface Props {
  meals: Meal[];
  foodItems: FoodItemSummary[];
  csrfToken: string;
}

interface PlannerRow {
  key: string;
  /** Inventory item name this was linked to (for display) */
  linkedInventoryName?: string;
  name: string;
  unitsNeeded: number;
  /** null when not linked to any inventory item */
  inStock: number | null;
  /** null when not linked to any inventory item */
  toBuy: number | null;
  tracked: boolean;
  /** Number of distinct batches contributing to inStock */
  batchCount?: number;
}

export default function MealPlannerForm({ meals, foodItems }: Props) {
  // Map of mealId → number of times it will be served (0 = not selected)
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(meals.map((m) => [m.id, 0]))
  );
  const [headcount, setHeadcount] = useState<number>(0);
  const [results, setResults] = useState<PlannerRow[] | null>(null);
  // Ephemeral per-session links: ingredient name → inventory food name (or "" for unlinked)
  const [links, setLinks] = useState<Record<string, string>>({});

  // Name-based stock map: aggregates quantity across all items sharing the same name
  const stockByName = new Map<string, { total: number; batchCount: number }>();
  for (const f of foodItems) {
    const key = f.name.toLowerCase();
    const existing = stockByName.get(key);
    if (existing) {
      existing.total += f.quantity;
      existing.batchCount += 1;
    } else {
      stockByName.set(key, { total: f.quantity, batchCount: 1 });
    }
  }

  function setCount(mealId: string, value: number) {
    setCounts((prev) => ({ ...prev, [mealId]: Math.max(0, value) }));
  }

  // Unique ingredient names across all selected meals, sorted alphabetically
  const activeIngredientNames = Array.from(
    new Set(
      meals
        .filter((m) => (counts[m.id] ?? 0) > 0)
        .flatMap((m) => m.ingredients.map((i) => i.name)),
    ),
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  // Sorted unique inventory food names for the link dropdowns
  const foodNames = Array.from(new Set(foodItems.map((f) => f.name))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );

  function calculate() {
    if (headcount < 1) return;

    // Accumulate units needed per ingredient name
    const needed = new Map<string, number>();

    for (const meal of meals) {
      const count = counts[meal.id] ?? 0;
      if (count === 0) continue;
      for (const ing of meal.ingredients) {
        const units = Math.ceil((headcount * count) / ing.servingsPerUnit);
        needed.set(ing.name, (needed.get(ing.name) ?? 0) + units);
      }
    }

    const rows: PlannerRow[] = [];
    for (const [ingName, unitsNeeded] of needed.entries()) {
      const linkedName = links[ingName]; // inventory food name, or "" / undefined
      if (linkedName) {
        const stockEntry = stockByName.get(linkedName.toLowerCase());
        const inStock = stockEntry?.total ?? 0;
        rows.push({
          key: ingName,
          linkedInventoryName: linkedName,
          name: ingName,
          unitsNeeded,
          inStock,
          toBuy: Math.max(0, unitsNeeded - inStock),
          tracked: true,
          batchCount: stockEntry?.batchCount,
        });
      } else {
        rows.push({
          key: ingName,
          name: ingName,
          unitsNeeded,
          inStock: null,
          toBuy: null,
          tracked: false,
        });
      }
    }

    rows.sort((a, b) => {
      if (a.tracked !== b.tracked) return a.tracked ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
    setResults(rows);
  }

  const anySelected = Object.values(counts).some((c) => c > 0);
  const canCalculate = headcount > 0 && anySelected;

  return (
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-purple-100">Plan a Camp</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Select meals and how many times you'll serve each, then enter the headcount to see what you need.
        </p>
      </div>

      <div class="p-6 space-y-6">
        {/* Headcount */}
        <div class="flex items-center gap-4">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
            Number of people
          </label>
          <input
            type="number"
            min={1}
            value={headcount || ""}
            placeholder="e.g. 90"
            onInput={(e) => setHeadcount(Math.max(0, parseInt((e.target as HTMLInputElement).value) || 0))}
            class="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
        </div>

        {/* Meal selection */}
        <div>
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Meals — set how many times each will be served
          </p>
          <div class="space-y-2">
            {meals.map((meal) => {
              const count = counts[meal.id] ?? 0;
              return (
                <div key={meal.id} class="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCount(meal.id, count > 0 ? 0 : 1)}
                    class={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${count > 0 ? "bg-purple-600 border-purple-600 text-white" : "border-gray-300 dark:border-gray-500"}`}
                    aria-label={count > 0 ? `Deselect ${meal.name}` : `Select ${meal.name}`}
                  >
                    {count > 0 && <span class="text-xs leading-none">✓</span>}
                  </button>
                  <span class={`text-sm flex-1 ${count > 0 ? "text-gray-800 dark:text-purple-100" : "text-gray-500 dark:text-gray-400"}`}>
                    {meal.name}
                    {meal.description && (
                      <span class="text-xs text-gray-400 dark:text-gray-500 ml-1">— {meal.description}</span>
                    )}
                  </span>
                  {count > 0 && (
                    <div class="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setCount(meal.id, count - 1)}
                        class="w-6 h-6 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
                      >−</button>
                      <span class="w-8 text-center text-sm font-medium text-gray-800 dark:text-gray-100">{count}×</span>
                      <button
                        type="button"
                        onClick={() => setCount(meal.id, count + 1)}
                        class="w-6 h-6 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
                      >+</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Ingredient → inventory links (shown once any meal is selected) */}
        {activeIngredientNames.length > 0 && (
          <div>
            <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Link ingredients to inventory
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Match each recipe ingredient to an inventory item so stock levels can be checked. Leave blank to treat as untracked.
            </p>
            <div class="space-y-2">
              {activeIngredientNames.map((ingName) => (
                <div key={ingName} class="flex items-center gap-3">
                  <span class="text-sm text-gray-700 dark:text-gray-200 w-40 shrink-0 truncate" title={ingName}>
                    {ingName}
                  </span>
                  <select
                    value={links[ingName] ?? ""}
                    onChange={(e) => {
                      const val = (e.target as HTMLSelectElement).value;
                      setLinks((prev) => ({ ...prev, [ingName]: val }));
                    }}
                    class="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="">— not tracked —</option>
                    {foodNames.map((fn) => {
                      const stock = stockByName.get(fn.toLowerCase());
                      return (
                        <option key={fn} value={fn}>
                          {fn}{stock ? ` (${stock.total} in stock${stock.batchCount > 1 ? `, ${stock.batchCount} batches` : ""})` : " (0 in stock)"}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Calculate button */}
        <button
          type="button"
          onClick={calculate}
          disabled={!canCalculate}
          class="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
        >
          Calculate shopping list
        </button>

        {/* Results */}
        {results !== null && (
          <div>
            <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 class="text-base font-semibold text-gray-800 dark:text-purple-100 mb-1">
                Shopping list
                <span class="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                  for {headcount} people
                </span>
              </h3>

              {results.length === 0 ? (
                <p class="text-sm text-gray-500 dark:text-gray-400">No ingredients calculated — select at least one meal.</p>
              ) : (
                <>
                  {/* Summary badges */}
                  <div class="flex gap-3 mb-4 flex-wrap">
                    <span class="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {results.length} ingredient{results.length !== 1 ? "s" : ""}
                    </span>
                    <span class="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                      {results.filter((r) => r.tracked && (r.toBuy ?? 0) > 0).length} to buy
                    </span>
                    <span class="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                      {results.filter((r) => r.tracked && r.toBuy === 0).length} fully stocked
                    </span>
                    {results.some((r) => !r.tracked) && (
                      <span class="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                        {results.filter((r) => !r.tracked).length} not tracked
                      </span>
                    )}
                  </div>

                  {/* Table */}
                  <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table class="w-full text-sm">
                      <thead>
                        <tr class="bg-gray-50 dark:bg-gray-700/50 text-left">
                          <th class="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Item</th>
                          <th class="px-4 py-3 font-medium text-gray-600 dark:text-gray-300 text-right">Needed</th>
                          <th class="px-4 py-3 font-medium text-gray-600 dark:text-gray-300 text-right">In loft</th>
                          <th class="px-4 py-3 font-medium text-gray-600 dark:text-gray-300 text-right">To buy</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                        {results.map((row) => (
                          <tr
                            key={row.key}
                            class={!row.tracked ? "opacity-70" : (row.toBuy ?? 0) > 0 ? "bg-red-50/40 dark:bg-red-900/10" : ""}
                          >
                            <td class="px-4 py-3 text-gray-800 dark:text-gray-100">
                              {row.name}
                              {row.tracked && row.linkedInventoryName && row.linkedInventoryName !== row.name && (
                                <span class="ml-2 text-xs text-gray-400 dark:text-gray-500 font-normal">→ {row.linkedInventoryName}</span>
                              )}
                              {!row.tracked && (
                                <span class="ml-2 text-xs text-amber-600 dark:text-amber-400 font-normal">(not tracked)</span>
                              )}
                              {row.tracked && row.batchCount && row.batchCount > 1 && (
                                <span class="ml-2 text-xs text-gray-400 dark:text-gray-500 font-normal">({row.batchCount} batches)</span>
                              )}
                            </td>
                            <td class="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{row.unitsNeeded}</td>
                            <td class="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                              {row.tracked ? row.inStock : <span class="text-gray-400 dark:text-gray-500">—</span>}
                            </td>
                            <td class="px-4 py-3 text-right">
                              {!row.tracked ? (
                                <span class="font-semibold text-amber-600 dark:text-amber-400">{row.unitsNeeded}</span>
                              ) : (row.toBuy ?? 0) > 0 ? (
                                <span class="font-semibold text-red-600 dark:text-red-400">{row.toBuy}</span>
                              ) : (
                                <span class="font-semibold text-green-600 dark:text-green-400">0</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Buy list */}
                  {(() => {
                    const toBuyList = results.filter((r) => !r.tracked || (r.toBuy ?? 0) > 0);
                    if (toBuyList.length === 0) return (
                      <p class="mt-4 text-sm text-green-600 dark:text-green-400 font-medium">
                        ✓ Everything is fully stocked — nothing to buy!
                      </p>
                    );
                    return (
                      <div class="mt-6">
                        <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                          🛒 What to buy
                        </h4>
                        <ul class="divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                          {toBuyList.map((row) => (
                            <li key={row.key} class="flex items-center justify-between gap-4 px-4 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                              <div class="flex items-center gap-2 min-w-0">
                                <span class={`w-2 h-2 rounded-full shrink-0 ${row.tracked ? "bg-red-400" : "bg-amber-400"}`} />
                                <span class="text-sm text-gray-800 dark:text-gray-100 truncate">{row.name}</span>
                                {!row.tracked && (
                                  <span class="shrink-0 text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                                    not tracked
                                  </span>
                                )}
                              </div>
                              <span class="shrink-0 text-sm font-bold tabular-nums px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                                × {row.tracked ? row.toBuy : row.unitsNeeded}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
