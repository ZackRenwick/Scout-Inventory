// Interactive loan list island — shows active/overdue loans and return history
import { useSignal } from "@preact/signals";
import type { CheckOut } from "../types/inventory.ts";
import { formatDate } from "../lib/date-utils.ts";

interface LoanListProps {
  loans: CheckOut[];
  canEdit: boolean;
  csrfToken?: string;
}

function daysUntil(d: Date | string): number {
  const date = typeof d === "string" ? new Date(d) : d;
  return Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function isOverdue(loan: CheckOut): boolean {
  return loan.status === "checked-out" && daysUntil(loan.expectedReturnDate) < 0;
}

function dueBadge(loan: CheckOut): { text: string; cls: string } {
  if (loan.status === "returned") {
    return { text: "Returned", cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" };
  }
  const days = daysUntil(loan.expectedReturnDate);
  if (days < 0) {
    return {
      text: `Overdue ${Math.abs(days)}d`,
      cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    };
  }
  if (days === 0) {
    return { text: "Due today", cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" };
  }
  if (days <= 7) {
    return { text: `Due in ${days}d`, cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" };
  }
  return { text: `Due in ${days}d`, cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" };
}

export default function LoanList({ loans: initialLoans, canEdit, csrfToken }: LoanListProps) {
  const loans = useSignal<CheckOut[]>(initialLoans);
  const actioningId = useSignal<string | null>(null);
  const confirmingId = useSignal<{ id: string; action: "return" | "cancel" } | null>(null);
  const error = useSignal<string | null>(null);
  const showHistory = useSignal(false);

  const activeLoans = loans.value.filter((l) => l.status !== "returned");
  const historyLoans = loans.value.filter((l) => l.status === "returned");

  async function handleReturn(id: string) {
    actioningId.value = id;
    confirmingId.value = null;
    error.value = null;
    try {
      const res = await fetch(`/api/loans/${id}`, {
        method: "PATCH",
        headers: { "X-CSRF-Token": csrfToken ?? "" },
      });
      if (!res.ok) throw new Error("Failed to mark as returned.");
      const updated: CheckOut = await res.json();
      loans.value = loans.value.map((l) => (l.id === id ? updated : l));
    } catch (_e) {
      error.value = "Failed to mark as returned. Please try again.";
    } finally {
      actioningId.value = null;
    }
  }

  async function handleCancel(id: string) {
    actioningId.value = id;
    confirmingId.value = null;
    error.value = null;
    try {
      const res = await fetch(`/api/loans/${id}`, {
        method: "DELETE",
        headers: { "X-CSRF-Token": csrfToken ?? "" },
      });
      if (!res.ok) throw new Error("Failed to cancel loan.");
      loans.value = loans.value.filter((l) => l.id !== id);
    } catch (_e) {
      error.value = "Failed to cancel loan. Please try again.";
    } finally {
      actioningId.value = null;
    }
  }

  function LoanCard({ loan, isHistory = false }: { loan: CheckOut; isHistory?: boolean }) {
    const badge = dueBadge(loan);
    const overdue = isOverdue(loan);
    const acting = actioningId.value === loan.id;

    return (
      <div
        class={`bg-white dark:bg-gray-800 rounded-lg shadow border flex flex-col gap-3 p-4 ${
          overdue
            ? "border-red-300 dark:border-red-700"
            : "border-gray-200 dark:border-gray-700"
        }`}
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="font-semibold text-gray-800 dark:text-gray-100 truncate">{loan.itemName}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Qty: <strong class="text-gray-700 dark:text-gray-300">{loan.quantity}</strong>
              {" · "}
              Borrower: <strong class="text-gray-700 dark:text-gray-300">{loan.borrower}</strong>
            </p>
          </div>
          <span class={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
            {badge.text}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <span class="text-gray-400 dark:text-gray-500">Loaned</span>{" "}
            {formatDate(loan.checkOutDate)}
          </div>
          <div>
            <span class="text-gray-400 dark:text-gray-500">Expected back</span>{" "}
            <span class={overdue ? "text-red-600 dark:text-red-400 font-medium" : ""}>
              {formatDate(loan.expectedReturnDate)}
            </span>
          </div>
          {loan.actualReturnDate && (
            <div class="col-span-2">
              <span class="text-gray-400 dark:text-gray-500">Returned</span>{" "}
              {formatDate(loan.actualReturnDate)}
            </div>
          )}
        </div>

        {loan.notes && (
          <p class="text-sm text-gray-500 dark:text-gray-400 italic border-t border-gray-100 dark:border-gray-700 pt-2">
            {loan.notes}
          </p>
        )}

        {!isHistory && canEdit && (() => {
          const confirming = confirmingId.value;
          const isConfirmingReturn = confirming?.id === loan.id && confirming?.action === "return";
          const isConfirmingCancel = confirming?.id === loan.id && confirming?.action === "cancel";

          if (isConfirmingReturn) {
            return (
              <div class="pt-1 border-t border-gray-100 dark:border-gray-700 space-y-2">
                <p class="text-sm text-gray-700 dark:text-gray-300">
                  Mark <strong>{loan.itemName}</strong> as returned? Qty will be restored to stock.
                </p>
                <div class="flex gap-2">
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => handleReturn(loan.id)}
                    class="flex-1 py-1.5 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {acting ? "…" : "✓ Confirm Returned"}
                  </button>
                  <button
                    type="button"
                    onClick={() => (confirmingId.value = null)}
                    class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Keep
                  </button>
                </div>
              </div>
            );
          }

          if (isConfirmingCancel) {
            return (
              <div class="pt-1 border-t border-gray-100 dark:border-gray-700 space-y-2">
                <p class="text-sm text-gray-700 dark:text-gray-300">
                  Cancel loan of <strong>{loan.itemName}</strong>? Stock will be restored. This cannot be undone.
                </p>
                <div class="flex gap-2">
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => handleCancel(loan.id)}
                    class="flex-1 py-1.5 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {acting ? "…" : "✕ Confirm Cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={() => (confirmingId.value = null)}
                    class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Keep
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div class="flex gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                disabled={acting}
                onClick={() => (confirmingId.value = { id: loan.id, action: "return" })}
                class="flex-1 py-1.5 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                ✓ Mark Returned
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={() => (confirmingId.value = { id: loan.id, action: "cancel" })}
                class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                title="Cancel loan"
              >
                ✕
              </button>
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <div class="space-y-8">
      {error.value && (
        <div class="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">
          {error.value}
        </div>
      )}

      {/* Active / overdue */}
      <section>
        <h3 class="text-lg font-semibold text-gray-800 dark:text-purple-100 mb-3">
          Active Loans
          {activeLoans.length > 0 && (
            <span class="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
              ({activeLoans.length})
            </span>
          )}
        </h3>
        {activeLoans.length === 0 ? (
          <div class="text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
            <div class="text-4xl mb-2">📤</div>
            <p class="text-gray-500 dark:text-gray-400">No active loans</p>
            {canEdit && (
              <a
                href="/loans/new"
                class="mt-3 inline-block px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition-colors"
              >
                ➕ Record a Loan
              </a>
            )}
          </div>
        ) : (
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeLoans
              .sort((a, b) => daysUntil(a.expectedReturnDate) - daysUntil(b.expectedReturnDate))
              .map((loan) => <LoanCard key={loan.id} loan={loan} />)}
          </div>
        )}
      </section>

      {/* History */}
      {historyLoans.length > 0 && (
        <section>
          <button
            type="button"
            class="flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-purple-100 mb-3 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            onClick={() => (showHistory.value = !showHistory.value)}
          >
            <span>{showHistory.value ? "▾" : "▸"}</span>
            Return History
            <span class="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({historyLoans.length})
            </span>
          </button>
          {showHistory.value && (
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {historyLoans
                .sort((a, b) => new Date(b.actualReturnDate!).getTime() - new Date(a.actualReturnDate!).getTime())
                .map((loan) => <LoanCard key={loan.id} loan={loan} isHistory />)}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
