import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";

interface NeckerMetrics {
  inStock: number;
  created: number;
  totalMade: number;
  adultCreated: number;
  adultTotalMade: number;
}

interface NeckerDashboardProps {
  csrfToken: string;
  canEdit?: boolean;
}

export default function NeckerDashboard(
  { csrfToken, canEdit = true }: NeckerDashboardProps,
) {
  const metrics = useSignal<NeckerMetrics | null>(null);
  const saving = useSignal(false);
  const error = useSignal<string | null>(null);
  const message = useSignal<string | null>(null);
  const setStockInput = useSignal("0");
  const setTotalMadeInput = useSignal("0");
  const setAdultTotalMadeInput = useSignal("0");
  const moveToStockInput = useSignal("1");
  const madeInput = useSignal("1");
  const adultMadeInput = useSignal("1");
  const adultDeliveredInput = useSignal("1");

  async function loadMetrics() {
    try {
      const res = await fetch("/api/neckers");
      if (!res.ok) throw new Error("Failed to load necker metrics");
      const data = await res.json();
      metrics.value = {
        inStock: data.inStock ?? data.count ?? 0,
        created: data.created ?? 0,
        totalMade: data.totalMade ?? 0,
        adultCreated: data.adultCreated ?? 0,
        adultTotalMade: data.adultTotalMade ?? 0,
      };
      setStockInput.value = String(metrics.value.inStock);
      setTotalMadeInput.value = String(metrics.value.totalMade);
      setAdultTotalMadeInput.value = String(metrics.value.adultTotalMade);
    } catch {
      error.value = "Could not load necker metrics.";
    }
  }

  useEffect(() => {
    loadMetrics();
  }, []);

  async function update(payload: Record<string, unknown>, okMessage?: string) {
    if (saving.value) return;
    saving.value = true;
    error.value = null;
    message.value = null;

    try {
      const res = await fetch("/api/neckers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to update necker metrics");
      }

      metrics.value = {
        inStock: data.inStock ?? data.count ?? 0,
        created: data.created ?? 0,
        totalMade: data.totalMade ?? 0,
        adultCreated: data.adultCreated ?? 0,
        adultTotalMade: data.adultTotalMade ?? 0,
      };
      setStockInput.value = String(metrics.value.inStock);
      setTotalMadeInput.value = String(metrics.value.totalMade);
      setAdultTotalMadeInput.value = String(metrics.value.adultTotalMade);
      message.value = okMessage ?? "Updated.";
    } catch (e) {
      error.value = e instanceof Error
        ? e.message
        : "Failed to update necker metrics.";
    } finally {
      saving.value = false;
    }
  }

  const cards = [
    {
      label: "In Stock",
      value: metrics.value?.inStock,
      icon: "🧣",
      tone:
        "bg-purple-100 text-purple-900 border-purple-200 dark:bg-purple-900/40 dark:text-purple-100 dark:border-purple-700",
      subtitle: "Current neckers available",
    },
    {
      label: "Created",
      value: metrics.value?.created,
      icon: "🪡",
      tone:
        "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/40 dark:text-blue-100 dark:border-blue-700",
      subtitle: "Current created counter",
    },
    {
      label: "Total Made",
      value: metrics.value?.totalMade,
      icon: "🏁",
      tone:
        "bg-green-100 text-green-900 border-green-200 dark:bg-green-900/40 dark:text-green-100 dark:border-green-700",
      subtitle: "All-time neckers made",
    },
    {
      label: "Adult Neckers Created",
      value: metrics.value?.adultCreated,
      icon: "🧑",
      tone: "bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-600",
      subtitle: "Adult neckers currently created",
    },
    {
      label: "Adult Total Made",
      value: metrics.value?.adultTotalMade,
      icon: "🧑‍🏫",
      tone: "bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-600",
      subtitle: "All-time adult neckers made",
    },
  ];

  return (
    <div class="space-y-6">
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            class={`rounded-xl border p-4 text-gray-900 dark:text-gray-100 ${card.tone}`}
          >
            <div class="flex items-center justify-between">
              <p class="font-semibold text-sm uppercase tracking-wide opacity-80">
                {card.label}
              </p>
              <span class="text-2xl" aria-hidden="true">{card.icon}</span>
            </div>
            <p class="text-4xl font-bold mt-3 tabular-nums">
              {card.value ?? "..."}
            </p>
            <p class="text-xs mt-2 opacity-75">{card.subtitle}</p>
          </div>
        ))}
      </div>

      {canEdit && (
        <div class="space-y-4">
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <section class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Production Flow
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Record neckers as created first, then transfer them into stock
                when ready.
              </p>

              <div class="mt-4 space-y-4">
                <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">
                    1. Record Newly Made
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Increases Created and Total Made only.
                  </p>
                  <div class="flex gap-2 mt-3 flex-wrap items-center">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={madeInput.value}
                      onInput={(e) => {
                        const target = e.currentTarget as HTMLInputElement;
                        madeInput.value = target.value;
                      }}
                      class="w-24 px-2 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    />
                    <button
                      type="button"
                      disabled={saving.value}
                      onClick={() => {
                        const parsed = Number.parseInt(madeInput.value, 10);
                        if (!Number.isInteger(parsed) || parsed <= 0) {
                          error.value =
                            "Made quantity must be a positive integer.";
                          return;
                        }
                        update(
                          { made: parsed },
                          `Recorded ${parsed} necker${
                            parsed === 1 ? "" : "s"
                          } made.`,
                        );
                      }}
                      class="px-3 py-2 rounded bg-green-700 text-white hover:bg-green-800 disabled:opacity-50"
                    >
                      Record Made
                    </button>
                  </div>
                </div>

                <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">
                    2. Move Created Into Stock
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Transfers neckers from Created into In Stock and reduces
                    Created by the same amount.
                  </p>
                  <div class="mt-2 inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                    Created available: {metrics.value?.created ?? 0}
                  </div>

                  <div class="mt-3 space-y-2">
                    <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <p class="text-sm text-gray-800 dark:text-gray-200">
                        Move everything currently in Created into stock.
                      </p>
                      <button
                        type="button"
                        disabled={saving.value || metrics.value === null ||
                          metrics.value.created <= 0}
                        onClick={() => {
                          const qty = metrics.value?.created ?? 0;
                          if (qty <= 0) {
                            error.value =
                              "No created neckers available to move.";
                            return;
                          }
                          update(
                            { moveToStock: qty },
                            `Moved all ${qty} created necker${
                              qty === 1 ? "" : "s"
                            } into stock.`,
                          );
                        }}
                        class="mt-2 px-3 py-2 rounded bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-50"
                      >
                        Move All To Stock
                      </button>
                    </div>

                    <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <label
                        for="move-created-qty"
                        class="text-sm text-gray-800 dark:text-gray-200"
                      >
                        Move a specific quantity into stock.
                      </label>
                      <div class="mt-2 flex items-center gap-2">
                        <input
                          id="move-created-qty"
                          type="number"
                          min="1"
                          step="1"
                          value={moveToStockInput.value}
                          onInput={(e) => {
                            const target = e.currentTarget as HTMLInputElement;
                            moveToStockInput.value = target.value;
                          }}
                          class="w-24 px-2 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                        <button
                          type="button"
                          disabled={saving.value || metrics.value === null ||
                            metrics.value.created <= 0}
                          onClick={() => {
                            const parsed = Number.parseInt(
                              moveToStockInput.value,
                              10,
                            );
                            if (!Number.isInteger(parsed) || parsed <= 0) {
                              error.value =
                                "Move quantity must be a positive integer.";
                              return;
                            }
                            update(
                              { moveToStock: parsed },
                              `Moved ${parsed} created necker${
                                parsed === 1 ? "" : "s"
                              } into stock.`,
                            );
                          }}
                          class="px-3 py-2 rounded bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-50"
                        >
                          Move Qty
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Adult Neckers Flow
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Adult neckers are managed separately from the main production
                flow.
              </p>
              <div class="mt-2 inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                Adult neckers created available:{" "}
                {metrics.value?.adultCreated ?? 0}
              </div>

              <div class="mt-3 space-y-2">
                <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">
                    Record Adult Neckers Created
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Adds to adult neckers created and adult total made.
                  </p>
                  <div class="mt-2 flex items-center gap-2">
                    <input
                      id="adult-made-qty"
                      type="number"
                      min="1"
                      step="1"
                      value={adultMadeInput.value}
                      onInput={(e) => {
                        const target = e.currentTarget as HTMLInputElement;
                        adultMadeInput.value = target.value;
                      }}
                      class="w-24 px-2 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    />
                    <button
                      type="button"
                      disabled={saving.value}
                      onClick={() => {
                        const parsed = Number.parseInt(
                          adultMadeInput.value,
                          10,
                        );
                        if (!Number.isInteger(parsed) || parsed <= 0) {
                          error.value =
                            "Adult made quantity must be a positive integer.";
                          return;
                        }
                        update(
                          { adultMade: parsed },
                          `Recorded ${parsed} adult necker${
                            parsed === 1 ? "" : "s"
                          } created.`,
                        );
                      }}
                      class="px-3 py-2 rounded bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-50"
                    >
                      Record Adult Neckers Created
                    </button>
                  </div>
                </div>

                <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">
                    Deliver Adult Neckers Created
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Marks adult neckers created as delivered and clears the
                    created count.
                  </p>
                  <div class="mt-2 space-y-2">
                    <div>
                      <button
                        type="button"
                        disabled={saving.value || metrics.value === null ||
                          metrics.value.adultCreated <= 0}
                        onClick={() => {
                          const qty = metrics.value?.adultCreated ?? 0;
                          if (qty <= 0) {
                            error.value =
                              "No adult neckers currently marked as created.";
                            return;
                          }
                          update(
                            { adultDelivered: qty },
                            `Marked all ${qty} adult necker${
                              qty === 1 ? "" : "s"
                            } created as delivered.`,
                          );
                        }}
                        class="px-3 py-2 rounded bg-green-700 text-white hover:bg-green-800 disabled:opacity-50"
                      >
                        Deliver All Adult Neckers Created
                      </button>
                    </div>

                    <div class="flex items-center gap-2 flex-wrap">
                      <input
                        id="adult-delivered-qty"
                        type="number"
                        min="1"
                        step="1"
                        value={adultDeliveredInput.value}
                        onInput={(e) => {
                          const target = e.currentTarget as HTMLInputElement;
                          adultDeliveredInput.value = target.value;
                        }}
                        class="w-24 px-2 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      />
                      <button
                        type="button"
                        disabled={saving.value || metrics.value === null ||
                          metrics.value.adultCreated <= 0}
                        onClick={() => {
                          const parsed = Number.parseInt(
                            adultDeliveredInput.value,
                            10,
                          );
                          if (!Number.isInteger(parsed) || parsed <= 0) {
                            error.value =
                              "Adult delivered quantity must be a positive integer.";
                            return;
                          }
                          update(
                            { adultDelivered: parsed },
                            `Marked ${parsed} adult necker${
                              parsed === 1 ? "" : "s"
                            } created as delivered.`,
                          );
                        }}
                        class="px-3 py-2 rounded bg-green-700 text-white hover:bg-green-800 disabled:opacity-50"
                      >
                        Deliver Adult Qty
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              Stock And Baseline
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Use stock correction for real-world adjustments. Increasing stock
              also increases Total Made.
            </p>

            <div class="mt-4 space-y-4">
              <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  Stock Correction
                </p>
                <div class="flex gap-2 mt-3 flex-wrap items-center">
                  <button
                    type="button"
                    disabled={saving.value || metrics.value === null ||
                      metrics.value.inStock === 0}
                    onClick={() => update({ delta: -1 }, "Reduced stock by 1.")}
                    class="px-3 py-2 rounded bg-red-700 text-white hover:bg-red-800 disabled:opacity-50"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    disabled={saving.value || metrics.value === null}
                    onClick={() =>
                      update({ delta: 1 }, "Increased stock by 1.")}
                    class="px-3 py-2 rounded bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-50"
                  >
                    +1
                  </button>
                  <div class="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={setStockInput.value}
                      onInput={(e) => {
                        const target = e.currentTarget as HTMLInputElement;
                        setStockInput.value = target.value;
                      }}
                      class="w-28 px-2 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    />
                    <button
                      type="button"
                      disabled={saving.value}
                      onClick={() => {
                        const parsed = Number.parseInt(setStockInput.value, 10);
                        if (!Number.isInteger(parsed) || parsed < 0) {
                          error.value =
                            "Set stock must be a non-negative integer.";
                          return;
                        }
                        update({ value: parsed }, `Stock set to ${parsed}.`);
                      }}
                      class="px-3 py-2 rounded bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                      Set Stock
                    </button>
                  </div>
                </div>
              </div>

              <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  Legacy Total Made Baseline
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Set once to include historic neckers made before this system.
                </p>
                <div class="flex items-center gap-2 mt-3 flex-wrap">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={setTotalMadeInput.value}
                    onInput={(e) => {
                      const target = e.currentTarget as HTMLInputElement;
                      setTotalMadeInput.value = target.value;
                    }}
                    class="w-36 px-2 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    disabled={saving.value}
                    onClick={() => {
                      const parsed = Number.parseInt(
                        setTotalMadeInput.value,
                        10,
                      );
                      if (!Number.isInteger(parsed) || parsed < 0) {
                        error.value =
                          "Total made must be a non-negative integer.";
                        return;
                      }
                      update(
                        { setTotalMade: parsed },
                        `Total made set to ${parsed}.`,
                      );
                    }}
                    class="px-3 py-2 rounded bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    Set Total Made
                  </button>
                </div>
              </div>

              <div class="rounded-lg border border-amber-300 dark:border-amber-700/70 p-4 bg-amber-50/60 dark:bg-amber-900/10">
                <p class="text-sm font-medium text-amber-900 dark:text-amber-300">
                  Created Counter Controls
                </p>
                <p class="text-xs text-amber-800/80 dark:text-amber-400 mt-1">
                  Resets only Created. Total Made remains unchanged.
                </p>
                <button
                  type="button"
                  disabled={saving.value}
                  onClick={() => {
                    if (
                      !globalThis.confirm(
                        "Reset created counter to 0? Total made will stay unchanged.",
                      )
                    ) {
                      return;
                    }
                    update({ resetCreated: true }, "Created counter reset.");
                  }}
                  class="mt-3 px-3 py-2 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  Reset Created Counter
                </button>
              </div>

              <div class="rounded-lg border border-amber-300 dark:border-amber-700/70 p-4 bg-amber-50/60 dark:bg-amber-900/10">
                <p class="text-sm font-medium text-amber-900 dark:text-amber-300">
                  Adult Created Counter Controls
                </p>
                <p class="text-xs text-amber-800/80 dark:text-amber-400 mt-1">
                  Resets only Adult Neckers Created. Adult Total Made remains
                  unchanged.
                </p>
                <button
                  type="button"
                  disabled={saving.value}
                  onClick={() => {
                    if (
                      !globalThis.confirm(
                        "Reset adult neckers created counter to 0? Adult total made will stay unchanged.",
                      )
                    ) {
                      return;
                    }
                    update(
                      { resetAdultCreated: true },
                      "Adult neckers created counter reset.",
                    );
                  }}
                  class="mt-3 px-3 py-2 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  Reset Adult Created Counter
                </button>
              </div>

              <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  Adult Legacy Total Made Baseline
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Set or reset all-time adult neckers made for legacy imports.
                </p>
                <div class="mt-3 flex items-center gap-2 flex-wrap">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={setAdultTotalMadeInput.value}
                    onInput={(e) => {
                      const target = e.currentTarget as HTMLInputElement;
                      setAdultTotalMadeInput.value = target.value;
                    }}
                    class="w-36 px-2 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    disabled={saving.value}
                    onClick={() => {
                      const parsed = Number.parseInt(
                        setAdultTotalMadeInput.value,
                        10,
                      );
                      if (!Number.isInteger(parsed) || parsed < 0) {
                        error.value =
                          "Adult total made must be a non-negative integer.";
                        return;
                      }
                      update(
                        { setAdultTotalMade: parsed },
                        `Adult total made set to ${parsed}.`,
                      );
                    }}
                    class="px-3 py-2 rounded bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    Set Adult Total Made
                  </button>
                  <button
                    type="button"
                    disabled={saving.value}
                    onClick={() => {
                      if (!globalThis.confirm("Reset adult total made to 0?")) {
                        return;
                      }
                      update(
                        { setAdultTotalMade: 0 },
                        "Adult total made reset to 0.",
                      );
                    }}
                    class="px-3 py-2 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    Reset Adult Total Made
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {message.value && (
        <p class="text-sm text-green-700 dark:text-green-400">
          {message.value}
        </p>
      )}
      {error.value && (
        <p class="text-sm text-red-700 dark:text-red-400">{error.value}</p>
      )}
    </div>
  );
}
