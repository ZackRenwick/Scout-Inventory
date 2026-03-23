import { useComputed, useSignal } from "@preact/signals";
import NumberInput from "../components/NumberInput.tsx";

export interface FirstAidCheckItem {
  kitId: string;
  kitName: string;
  itemId: string;
  itemName: string;
  section: string;
  quantityTarget: number;
}

interface FirstAidCheckEntry extends FirstAidCheckItem {
  countedQty: number;
  skipped: boolean;
}

interface Props {
  items: FirstAidCheckItem[];
  csrfToken?: string;
  checkScope: "overall" | "kit";
}

type Phase = "wizard" | "review" | "submitting" | "done";

const inputClass =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500";

export default function FirstAidCheckWizard(
  { items: rawItems, csrfToken, checkScope }: Props,
) {
  const entries = useSignal<FirstAidCheckEntry[]>(
    rawItems.map((item) => ({
      ...item,
      countedQty: item.quantityTarget,
      skipped: false,
    })),
  );
  const currentIdx = useSignal(0);
  const phase = useSignal<Phase>("wizard");
  const submitError = useSignal<string | null>(null);
  const printReport = useSignal<"shortage" | "variance" | null>(null);
  const printGeneratedAt = useSignal("");

  const total = entries.value.length;
  const current = useComputed(() => entries.value[currentIdx.value]);

  const checkedEntries = useComputed(() =>
    entries.value.filter((entry) => !entry.skipped)
  );

  const shortages = useComputed(() =>
    checkedEntries.value.filter((entry) =>
      entry.countedQty < entry.quantityTarget
    )
  );

  const surplus = useComputed(() =>
    checkedEntries.value.filter((entry) =>
      entry.countedQty > entry.quantityTarget
    )
  );

  const variances = useComputed(() =>
    checkedEntries.value.filter((entry) =>
      entry.countedQty !== entry.quantityTarget
    )
  );

  const skippedCount = useComputed(() =>
    entries.value.filter((entry) => entry.skipped).length
  );

  const kitSequence = useComputed(() => {
    const seen = new Set<string>();
    const ordered: Array<{ id: string; name: string }> = [];
    for (const entry of entries.value) {
      if (seen.has(entry.kitId)) continue;
      seen.add(entry.kitId);
      ordered.push({ id: entry.kitId, name: entry.kitName });
    }
    return ordered;
  });

  function updateCurrentQty(qty: number) {
    const idx = currentIdx.value;
    entries.value = entries.value.map((entry, entryIdx) =>
      entryIdx === idx ? { ...entry, countedQty: qty } : entry
    );
  }

  function setCurrentSkipped(skipped: boolean) {
    const idx = currentIdx.value;
    entries.value = entries.value.map((entry, entryIdx) =>
      entryIdx === idx ? { ...entry, skipped } : entry
    );
  }

  function advance() {
    if (currentIdx.value < total - 1) {
      currentIdx.value = currentIdx.value + 1;
      return;
    }
    phase.value = "review";
  }

  function goBack() {
    if (currentIdx.value > 0) {
      currentIdx.value = currentIdx.value - 1;
    }
  }

  async function completeCheck() {
    phase.value = "submitting";
    submitError.value = null;

    const payload = {
      kitCount: new Set(checkedEntries.value.map((entry) => entry.kitId)).size,
      itemCount: checkedEntries.value.length,
      skippedCount: skippedCount.value,
      checkScope,
      checkedKitIds: [
        ...new Set(checkedEntries.value.map((entry) => entry.kitId)),
      ],
      shortages: shortages.value.map((entry) => ({
        kitId: entry.kitId,
        kitName: entry.kitName,
        itemId: entry.itemId,
        itemName: entry.itemName,
        quantityTarget: entry.quantityTarget,
        countedQty: entry.countedQty,
      })),
    };

    try {
      const response = await fetch("/api/first-aid-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken ?? "",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save check results.");
      }

      phase.value = "done";
    } catch (error) {
      submitError.value = error instanceof Error
        ? error.message
        : "Failed to save check results.";
      phase.value = "review";
    }
  }

  function printInPage(report: "shortage" | "variance") {
    printReport.value = report;
    printGeneratedAt.value = new Date().toLocaleString();
    // Let the DOM update with the print layout before triggering the dialog.
    requestAnimationFrame(() => window.print());
  }

  function printShortageReport() {
    if (shortages.value.length === 0) return;
    printInPage("shortage");
  }

  function printVarianceReport() {
    if (variances.value.length === 0) return;
    printInPage("variance");
  }

  if (phase.value === "done") {
    return (
      <div class="max-w-xl mx-auto text-center py-12">
        <div class="text-5xl mb-4">OK</div>
        <h2 class="text-2xl font-bold text-gray-800 dark:text-purple-100 mb-2">
          First Aid Check Complete
        </h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          Checked {checkedEntries.value.length}{" "}
          item{checkedEntries.value.length === 1 ? "" : "s"}
          {shortages.value.length === 0
            ? " and every kit is up to spec."
            : ` and found ${shortages.value.length} item${
              shortages.value.length === 1 ? "" : "s"
            } below target.`}
        </p>
        <div class="flex gap-3 justify-center">
          <a
            href="/first-aid"
            class="px-5 py-2.5 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 transition-colors"
          >
            Back to First Aid
          </a>
          <a
            href="/first-aid/check"
            class="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Run Another Check
          </a>
        </div>
      </div>
    );
  }

  if (phase.value === "review" || phase.value === "submitting") {
    const submitting = phase.value === "submitting";

    return (
      <div id="fa-check-review" class="max-w-4xl mx-auto">
        <style>
          {`@media print {
            #fa-check-review .screen-only { display: none !important; }
            #fa-check-review .print-only { display: block !important; }
            #fa-check-review { max-width: none !important; margin: 0 !important; }
            #fa-check-review table { width: 100%; border-collapse: collapse; font-size: 12px; }
            #fa-check-review th, #fa-check-review td { border: 1px solid #d1d5db; padding: 6px; text-align: left; }
            #fa-check-review th { background: #f3f4f6; }
            #fa-check-review .num { text-align: center; }
          }`}
        </style>

        <div class="print-only" style="display:none;">
          <h1 class="text-2xl font-bold text-gray-900 mb-1">
            {printReport.value === "variance"
              ? "First Aid Variance Report"
              : "First Aid Shortage Report"}
          </h1>
          <p class="text-sm text-gray-600 mb-4">
            Generated {printGeneratedAt.value || new Date().toLocaleString()}.
            {" "}
            {printReport.value === "variance"
              ? `${variances.value.length} variance${
                variances.value.length === 1 ? "" : "s"
              }.`
              : `${shortages.value.length} shortage${
                shortages.value.length === 1 ? "" : "s"
              }.`}
          </p>

          {printReport.value === "variance"
            ? (
              <table>
                <thead>
                  <tr>
                    <th>Kit</th>
                    <th>Section</th>
                    <th>Item</th>
                    <th class="num">Target</th>
                    <th class="num">Counted</th>
                    <th class="num">Difference</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {variances.value.map((entry) => {
                    const difference = entry.countedQty - entry.quantityTarget;
                    return (
                      <tr key={`print-var-${entry.kitId}-${entry.itemId}`}>
                        <td>{entry.kitName}</td>
                        <td>{entry.section}</td>
                        <td>{entry.itemName}</td>
                        <td class="num">{entry.quantityTarget}</td>
                        <td class="num">{entry.countedQty}</td>
                        <td class="num">{difference}</td>
                        <td>{difference < 0 ? "Shortage" : "Overage"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
            : (
              <table>
                <thead>
                  <tr>
                    <th>Kit</th>
                    <th>Section</th>
                    <th>Item</th>
                    <th class="num">Target</th>
                    <th class="num">Counted</th>
                    <th class="num">Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {shortages.value.map((entry) => (
                    <tr key={`print-short-${entry.kitId}-${entry.itemId}`}>
                      <td>{entry.kitName}</td>
                      <td>{entry.section}</td>
                      <td>{entry.itemName}</td>
                      <td class="num">{entry.quantityTarget}</td>
                      <td class="num">{entry.countedQty}</td>
                      <td class="num">
                        {entry.quantityTarget - entry.countedQty}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>

        <div class="screen-only">
          <div class="mb-6 flex items-center justify-between">
            <div>
              <h3 class="text-xl font-bold text-gray-800 dark:text-purple-100">
                Review First Aid Check
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {checkedEntries.value.length} checked
                {skippedCount.value > 0
                  ? `, ${skippedCount.value} skipped`
                  : ""}
                {shortages.value.length > 0
                  ? `, ${shortages.value.length} shortages`
                  : ", all items meet target"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                currentIdx.value = 0;
                phase.value = "wizard";
              }}
              class="text-sm text-purple-600 dark:text-purple-400 hover:underline"
            >
              &larr; Back to wizard
            </button>
          </div>

          {submitError.value && (
            <div class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">
              {submitError.value}
            </div>
          )}

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <div class="p-3 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Checked Items
              </p>
              <p class="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {checkedEntries.value.length}
              </p>
            </div>
            <div class="p-3 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <p class="text-xs text-red-600 dark:text-red-300">Below Target</p>
              <p class="text-xl font-semibold text-red-700 dark:text-red-300">
                {shortages.value.length}
              </p>
            </div>
            <div class="p-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
              <p class="text-xs text-amber-600 dark:text-amber-300">
                Above Target
              </p>
              <p class="text-xl font-semibold text-amber-700 dark:text-amber-300">
                {surplus.value.length}
              </p>
            </div>
          </div>

          <div class="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={printVarianceReport}
              disabled={variances.value.length === 0}
              class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Print Variance Report (PDF)
            </button>
            <button
              type="button"
              onClick={printShortageReport}
              disabled={shortages.value.length === 0}
              class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Print Shortage Report (PDF)
            </button>
          </div>

          {shortages.value.length === 0
            ? (
              <div class="text-center py-10 border-2 border-dashed border-green-200 dark:border-green-700 rounded-lg mb-6 bg-green-50/50 dark:bg-green-900/10">
                <p class="text-green-700 dark:text-green-300 font-medium">
                  All checked items are up to spec.
                </p>
              </div>
            )
            : (
              <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm mb-6 overflow-hidden">
                <table class="w-full text-sm">
                  <thead class="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                        Kit
                      </th>
                      <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                        Item
                      </th>
                      <th class="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-300">
                        Target
                      </th>
                      <th class="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-300">
                        Counted
                      </th>
                      <th class="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-300">
                        Missing
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                    {shortages.value.map((entry) => (
                      <tr
                        key={`${entry.kitId}-${entry.itemId}`}
                        class="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                      >
                        <td class="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {entry.kitName}
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-gray-800 dark:text-gray-100">
                            {entry.itemName}
                          </div>
                          <div class="text-xs text-gray-500 dark:text-gray-400">
                            {entry.section}
                          </div>
                        </td>
                        <td class="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                          {entry.quantityTarget}
                        </td>
                        <td class="px-4 py-3 text-center text-gray-900 dark:text-gray-100 font-semibold">
                          {entry.countedQty}
                        </td>
                        <td class="px-4 py-3 text-center text-red-700 dark:text-red-300 font-semibold">
                          {entry.quantityTarget - entry.countedQty}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          <div class="flex gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={completeCheck}
              class="flex-1 py-3 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Saving..." : "Complete Check"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const entry = current.value;
  const idx = currentIdx.value;
  const progressPct = Math.round((idx / total) * 100);
  const isFullCheck = kitSequence.value.length > 1;
  const currentKitIndex = kitSequence.value.findIndex((kit) =>
    kit.id === entry.kitId
  );

  return (
    <div class="max-w-xl mx-auto">
      <div class="mb-6">
        <div class="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1.5">
          <span>Item {idx + 1} of {total}</span>
          <span>
            {shortages.value.length}{" "}
            shortage{shortages.value.length === 1 ? "" : "s"} so far
          </span>
        </div>
        <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            class="h-full bg-purple-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {isFullCheck && (
        <div class="mb-4 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 px-4 py-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
            Now verifying kit {currentKitIndex + 1} of{" "}
            {kitSequence.value.length}
          </p>
          <p class="text-lg font-semibold text-purple-900 dark:text-purple-100 leading-tight">
            {entry.kitName}
          </p>
        </div>
      )}

      <div
        class={`bg-white dark:bg-gray-800 rounded-lg shadow border p-6 mb-5 ${
          entry.skipped
            ? "border-gray-300 dark:border-gray-600 opacity-60"
            : "border-gray-200 dark:border-gray-700"
        }`}
      >
        <div class="mb-4">
          <p class="text-xs uppercase tracking-wide text-purple-600 dark:text-purple-400 font-semibold">
            {entry.kitName}
          </p>
          <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">
            {entry.itemName}
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {entry.section}
          </p>
        </div>

        {entry.skipped
          ? (
            <button
              type="button"
              onClick={() => setCurrentSkipped(false)}
              class="w-full py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Undo skip and check this item
            </button>
          )
          : (
            <div class="space-y-4">
              <div class="p-3 rounded-md bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Target quantity
                </p>
                <p class="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {entry.quantityTarget}
                </p>
              </div>

              <div>
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Counted quantity in kit
                </label>
                <NumberInput
                  key={`${entry.kitId}-${entry.itemId}`}
                  value={entry.countedQty}
                  min={0}
                  onChange={(n) => updateCurrentQty(n)}
                  class={inputClass}
                />
              </div>
            </div>
          )}
      </div>

      <div class="flex gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={idx === 0}
          class="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          &larr; Back
        </button>
        {!entry.skipped && (
          <button
            type="button"
            onClick={() => {
              setCurrentSkipped(true);
              advance();
            }}
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
          {idx === total - 1 ? "Finish & Review ->" : "Next ->"}
        </button>
      </div>

      {idx > 0 && (
        <div class="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              phase.value = "review";
            }}
            class="text-sm text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
          >
            Jump to review
          </button>
        </div>
      )}
    </div>
  );
}
