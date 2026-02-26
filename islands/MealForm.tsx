// Create / edit a meal recipe — admin only
import { useState } from "preact/hooks";
import type { Meal, MealIngredient } from "../types/meals.ts";

interface Props {
  meal?: Meal;
  csrfToken: string;
}

type Status = { type: "success" | "error"; message: string } | null;

const emptyIngredient = (): MealIngredient => ({
  name: "",
  servingsPerUnit: 1,
});

export default function MealForm({ meal, csrfToken }: Props) {
  const isEdit = !!meal;

  const [name, setName] = useState(meal?.name ?? "");
  const [description, setDescription] = useState(meal?.description ?? "");
  const [ingredients, setIngredients] = useState<MealIngredient[]>(
    meal?.ingredients.length ? meal.ingredients : [emptyIngredient()],
  );
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  function updateIngredient(index: number, patch: Partial<MealIngredient>) {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)));
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, emptyIngredient()]);
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!name.trim()) {
      setStatus({ type: "error", message: "Meal name is required." });
      return;
    }
    const validIngredients = ingredients
      .filter((i) => i.name.trim() && i.servingsPerUnit > 0)
      .map((i) => ({ name: i.name.trim(), servingsPerUnit: i.servingsPerUnit }));
    if (validIngredients.length === 0) {
      setStatus({ type: "error", message: "At least one named ingredient is required." });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const url = isEdit ? `/api/meals/${meal!.id}` : "/api/meals";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, ingredients: validIngredients }),
      });

      if (res.ok) {
        globalThis.location.href = "/meals";
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus({ type: "error", message: (data as { error?: string }).error ?? "Failed to save meal." });
      }
    } catch {
      setStatus({ type: "error", message: "Network error — please try again." });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!meal) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/meals/${meal.id}`, {
        method: "DELETE",
        headers: { "X-CSRF-Token": csrfToken },
      });
      if (res.ok) {
        globalThis.location.href = "/meals";
      } else {
        setStatus({ type: "error", message: "Failed to delete meal." });
      }
    } catch {
      setStatus({ type: "error", message: "Network error — please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
      <h2 class="text-lg font-semibold text-gray-800 dark:text-purple-100 mb-6">
        {isEdit ? `Edit: ${meal!.name}` : "New Meal"}
      </h2>

      {status && (
        <div class={`mb-4 p-3 rounded-lg text-sm ${status.type === "success" ? "bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700" : "bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700"}`}>
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Name */}
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Meal name <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            required
            placeholder="e.g. Spaghetti Bolognese"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
        </div>

        {/* Description */}
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description <span class="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={description}
            onInput={(e) => setDescription((e.target as HTMLInputElement).value)}
            placeholder="e.g. Classic pasta with meat sauce"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
        </div>

        {/* Ingredients */}
        <div class="mb-6">
          <div class="flex items-center justify-between mb-3">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Ingredients <span class="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={addIngredient}
              class="text-sm text-purple-600 dark:text-purple-400 hover:underline"
            >
              ➕ Add ingredient
            </button>
          </div>

          <div class="space-y-3">
            {ingredients.map((ing, i) => {
              return (
              <div key={i} class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div class="flex gap-2 items-start">
                  {/* Name */}
                  <div class="flex-1 min-w-0">
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Name <span class="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={ing.name}
                      placeholder="e.g. Passata"
                      onInput={(e) => updateIngredient(i, { name: (e.target as HTMLInputElement).value })}
                      class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>

                  {/* Servings per unit */}
                  <div class="w-36 shrink-0">
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Servings per unit</label>
                    <input
                      type="number"
                      value={ing.servingsPerUnit}
                      min={1}
                      onInput={(e) => updateIngredient(i, { servingsPerUnit: Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1) })}
                      class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>

                  {/* Remove */}
                  <div class="pt-5">
                    <button
                      type="button"
                      onClick={() => removeIngredient(i)}
                      class="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-lg leading-none"
                      aria-label="Remove ingredient"
                      disabled={ingredients.length === 1}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );})}
          </div>
          <p class="mt-2 text-xs text-gray-400 dark:text-gray-500">
            "Servings per unit" = how many people one unit of this item feeds. E.g. a 500ml jar of passata serves 6.
          </p>
        </div>

        {/* Actions */}
        <div class="flex items-center justify-between gap-3">
          <button
            type="submit"
            disabled={loading}
            class="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm"
          >
            {loading ? "Saving…" : isEdit ? "Save changes" : "Create meal"}
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              class="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
            >
              Delete meal
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
