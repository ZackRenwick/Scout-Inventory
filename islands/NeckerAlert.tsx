// Reactive necker low-stock alert — reads the shared neckerCount signal,
// so it updates instantly when NeckerCounter changes the value.
import { neckerCount } from "../lib/neckerSignal.ts";

export default function NeckerAlert() {
  // Nothing to show until the count has loaded or if stock is fine
  if (neckerCount.value === null || neckerCount.value >= 10) {
    return null;
  }

  return (
    <div class="bg-orange-100 dark:bg-orange-900/60 border-l-4 border-orange-500 dark:border-orange-400 p-4 mb-8">
      <div class="flex">
        <div class="flex-shrink-0">
          <span class="text-2xl">🧣</span>
        </div>
        <div class="ml-3">
          <h3 class="text-base font-medium text-orange-900 dark:text-orange-100">
            Neckers Running Low
          </h3>
          <p class="mt-1 text-sm text-orange-800 dark:text-orange-200">
            Only <strong>{neckerCount.value}</strong> necker{neckerCount.value !== 1 ? "s" : ""} in stock — consider restocking.
          </p>
        </div>
      </div>
    </div>
  );
}
