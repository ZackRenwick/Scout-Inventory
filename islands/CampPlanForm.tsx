// Camp plan creation / edit form island
import { useSignal } from "@preact/signals";
import type { CampPlan } from "../types/inventory.ts";

interface CampPlanFormProps {
  csrfToken?: string;
  existing?: CampPlan; // when editing
}

function isoDate(d: Date | string | undefined): string {
  if (!d) {
    return "";
  }
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().split("T")[0];
}

export default function CampPlanForm({ csrfToken, existing }: CampPlanFormProps) {
  const name = useSignal(existing?.name ?? "");
  const campDate = useSignal(isoDate(existing?.campDate));
  const endDate = useSignal(isoDate(existing?.endDate));
  const location = useSignal(existing?.location ?? "");
  const notes = useSignal(existing?.notes ?? "");
  const saving = useSignal(false);
  const error = useSignal<string | null>(null);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!name.value.trim() || !campDate.value) {
      error.value = "Name and start date are required.";
      return;
    }
    saving.value = true;
    error.value = null;

    try {
      const payload = {
        name: name.value.trim(),
        campDate: campDate.value,
        endDate: endDate.value || undefined,
        location: location.value.trim(),
        notes: notes.value.trim(),
      };

      let res: Response;
      if (existing) {
        res = await fetch(`/api/camps/${existing.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken ?? "",
          },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/camps", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken ?? "",
          },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save camp plan");
      }

      const saved: CampPlan = await res.json();
      globalThis.location.href = `/camps/${saved.id}`;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to save camp plan.";
      saving.value = false;
    }
  }

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <form onSubmit={handleSubmit} class="space-y-5">
      {error.value && (
        <div class="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">
          {error.value}
        </div>
      )}

      <div>
        <label class={labelClass}>Camp Name *</label>
        <input
          type="text"
          class={inputClass}
          value={name.value}
          onInput={(e) => (name.value = (e.target as HTMLInputElement).value)}
          placeholder="e.g. Summer Camp 2026"
          required
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class={labelClass}>Start Date *</label>
          <input
            type="date"
            class={inputClass}
            value={campDate.value}
            onInput={(e) => (campDate.value = (e.target as HTMLInputElement).value)}
            required
          />
        </div>
        <div>
          <label class={labelClass}>End Date</label>
          <input
            type="date"
            class={inputClass}
            value={endDate.value}
            onInput={(e) => (endDate.value = (e.target as HTMLInputElement).value)}
          />
        </div>
      </div>

      <div>
        <label class={labelClass}>Location</label>
        <input
          type="text"
          class={inputClass}
          value={location.value}
          onInput={(e) => (location.value = (e.target as HTMLInputElement).value)}
          placeholder="e.g. Gilwell Park"
        />
      </div>

      <div>
        <label class={labelClass}>Notes</label>
        <textarea
          class={`${inputClass} resize-none`}
          rows={3}
          value={notes.value}
          onInput={(e) => (notes.value = (e.target as HTMLTextAreaElement).value)}
          placeholder="Any additional details about this camp..."
        />
      </div>

      <div class="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving.value}
          class="px-5 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 disabled:opacity-60 transition-colors"
        >
          {saving.value ? "Saving…" : existing ? "Save Changes" : "Create Camp Plan"}
        </button>
        <a
          href="/camps"
          class="px-5 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
