// Maintenance lifecycle page for inspection scheduling and history
import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../../components/Layout.tsx";
import type { Session } from "../../../lib/auth.ts";
import { csrfFailed, forbidden } from "../../../lib/auth.ts";
import { addMaintenanceRecord, getItemById } from "../../../db/kv.ts";
import type { InventoryItem, MaintenanceRecord } from "../../../types/inventory.ts";
import { formatDate } from "../../../lib/date-utils.ts";
import { logActivity } from "../../../lib/activityLog.ts";

interface MaintenancePageData {
  item: InventoryItem | null;
  error?: string;
  session?: Session;
  csrfToken?: string;
}

function toDateInputValue(d: Date | undefined): string {
  if (!d) return "";
  return d.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function hasCondition(item: InventoryItem): item is InventoryItem & { condition: string } {
  return "condition" in item;
}

function dueText(nextInspectionDate?: Date): { text: string; className: string } {
  if (!nextInspectionDate) {
    return {
      text: "No inspection scheduled",
      className: "text-gray-600 dark:text-gray-400",
    };
  }

  const diffDays = Math.floor((nextInspectionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return {
      text: `Inspection overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`,
      className: "text-red-600 dark:text-red-400",
    };
  }
  if (diffDays <= 7) {
    return {
      text: `Inspection due in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
      className: "text-amber-600 dark:text-amber-400",
    };
  }

  return {
    text: `Next inspection in ${diffDays} days`,
    className: "text-green-600 dark:text-green-400",
  };
}

export const handler: Handlers<MaintenancePageData> = {
  async GET(_req, ctx) {
    const session = ctx.state.session as Session | undefined;
    const item = await getItemById(ctx.params.id);
    return ctx.render({ item, session, csrfToken: session?.csrfToken });
  },

  async POST(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") return forbidden();

    const formData = await req.formData();
    const csrfToken = formData.get("csrf") as string | null;
    if (!csrfToken || csrfToken !== session.csrfToken) return csrfFailed();

    const item = await getItemById(ctx.params.id);
    if (!item) {
      return ctx.render({ item: null, error: "Item not found.", session, csrfToken: session.csrfToken });
    }

    const dateRaw = String(formData.get("date") ?? "");
    const typeRaw = String(formData.get("type") ?? "");
    const notesRaw = String(formData.get("notes") ?? "").trim();
    const performedByRaw = String(formData.get("performedBy") ?? "").trim();
    const nextIntervalRaw = String(formData.get("nextInspectionIntervalDays") ?? "").trim();
    const conditionAfterRaw = String(formData.get("conditionAfter") ?? "").trim();

    const allowedTypes: MaintenanceRecord["type"][] = ["inspection", "repair", "cleaning", "replacement-part", "other"];
    if (!dateRaw || Number.isNaN(new Date(dateRaw).getTime())) {
      return ctx.render({ item, error: "Please provide a valid maintenance date.", session, csrfToken: session.csrfToken });
    }
    if (!allowedTypes.includes(typeRaw as MaintenanceRecord["type"])) {
      return ctx.render({ item, error: "Please choose a valid maintenance type.", session, csrfToken: session.csrfToken });
    }
    if (!notesRaw) {
      return ctx.render({ item, error: "Please add maintenance notes.", session, csrfToken: session.csrfToken });
    }
    if (notesRaw.length > 1000) {
      return ctx.render({ item, error: "Notes must be 1000 characters or fewer.", session, csrfToken: session.csrfToken });
    }

    let nextInspectionDate: Date | undefined;
    if (nextIntervalRaw) {
      const intervalDays = Number(nextIntervalRaw);
      if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 3650) {
        return ctx.render({
          item,
          error: "Next inspection interval must be a whole number between 1 and 3650.",
          session,
          csrfToken: session.csrfToken,
        });
      }
      nextInspectionDate = addDays(new Date(dateRaw), intervalDays);
    }

    const conditionAfter = hasCondition(item) && conditionAfterRaw
      ? conditionAfterRaw as "excellent" | "good" | "fair" | "needs-repair"
      : undefined;

    const updated = await addMaintenanceRecord(item.id, {
      date: new Date(dateRaw),
      type: typeRaw as MaintenanceRecord["type"],
      notes: notesRaw,
      performedBy: performedByRaw || undefined,
      nextInspectionDate,
      conditionAfter,
    });

    if (!updated) {
      return ctx.render({ item, error: "Failed to save maintenance record.", session, csrfToken: session.csrfToken });
    }

    await logActivity({
      username: session.username,
      action: "item.maintenance_logged",
      resource: updated.name,
      resourceId: updated.id,
      details: `Logged ${typeRaw} on ${dateRaw}${nextInspectionDate ? `, next due ${toDateInputValue(nextInspectionDate)}` : ""}`,
    });

    return new Response(null, {
      status: 303,
      headers: { Location: `/inventory/${updated.id}/maintenance` },
    });
  },
};

export default function MaintenancePage({ data }: PageProps<MaintenancePageData>) {
  if (!data.item) {
    return (
      <Layout title="Item Not Found" username={data.session?.username} role={data.session?.role}>
        <div class="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <p class="text-red-700 text-lg">Item not found</p>
          <a href="/inventory" class="mt-4 inline-block text-red-600 hover:text-red-800 underline">
            Back to Inventory
          </a>
        </div>
      </Layout>
    );
  }

  const item = data.item;
  const maintenanceHistory = item.maintenanceHistory ?? [];
  const due = dueText(item.nextInspectionDate);

  return (
    <Layout title={`Maintenance: ${item.name}`} username={data.session?.username} role={data.session?.role}>
      <div class="max-w-4xl mx-auto space-y-6">
        <div>
          <a href={`/inventory/${item.id}`} class="text-purple-600 dark:text-purple-400 hover:text-purple-800">
            Back to Item
          </a>
        </div>

        <div class="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-5 sm:p-6">
          <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Maintenance Lifecycle</h1>
          <p class="mt-1 text-gray-600 dark:text-gray-400">{item.name} · {item.location}</p>

          <div class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div class="rounded-md border border-gray-200 dark:border-gray-700 p-3">
              <p class="text-gray-500 dark:text-gray-400">Last inspected</p>
              <p class="font-semibold text-gray-900 dark:text-gray-100">{item.lastInspectedDate ? formatDate(item.lastInspectedDate) : "Not recorded"}</p>
            </div>
            <div class="rounded-md border border-gray-200 dark:border-gray-700 p-3">
              <p class="text-gray-500 dark:text-gray-400">Next inspection</p>
              <p class="font-semibold text-gray-900 dark:text-gray-100">{item.nextInspectionDate ? formatDate(item.nextInspectionDate) : "Not scheduled"}</p>
            </div>
            <div class="rounded-md border border-gray-200 dark:border-gray-700 p-3">
              <p class="text-gray-500 dark:text-gray-400">Status</p>
              <p class={`font-semibold ${due.className}`}>{due.text}</p>
            </div>
          </div>
        </div>

        {data.session?.role !== "viewer" && (
          <div class="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-5 sm:p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Log Inspection / Maintenance</h2>
            {data.error && (
              <div class="mb-4 p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
                {data.error}
              </div>
            )}

            <form method="POST" class="space-y-4">
              <input type="hidden" name="csrf" value={data.csrfToken ?? ""} />

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                  <input
                    type="date"
                    name="date"
                    value={toDateInputValue(new Date())}
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                  <select
                    name="type"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    required
                  >
                    <option value="inspection">Inspection</option>
                    <option value="repair">Repair</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="replacement-part">Replacement part</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Performed By</label>
                  <input
                    type="text"
                    name="performedBy"
                    placeholder="Optional"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Next inspection in (days)</label>
                  <input
                    type="number"
                    name="nextInspectionIntervalDays"
                    min={1}
                    max={3650}
                    placeholder="e.g. 90"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              {hasCondition(item) && (
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Condition After Work</label>
                  <select
                    name="conditionAfter"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Leave unchanged</option>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="needs-repair">Needs repair</option>
                  </select>
                </div>
              )}

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  name="notes"
                  rows={4}
                  required
                  placeholder="What was checked, fixed, cleaned, or replaced?"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
                />
              </div>

              <button
                type="submit"
                class="px-4 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 transition-colors"
              >
                Save Maintenance Entry
              </button>
            </form>
          </div>
        )}

        <div class="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-5 sm:p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">History</h2>
          {maintenanceHistory.length === 0 ? (
            <p class="text-gray-600 dark:text-gray-400">No maintenance records logged yet.</p>
          ) : (
            <div class="space-y-3">
              {maintenanceHistory.map((entry) => (
                <div key={entry.id} class="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <p class="font-medium text-gray-900 dark:text-gray-100">
                      {formatDate(entry.date)} · {entry.type.replace("-", " ")}
                    </p>
                    {entry.conditionAfter && (
                      <span class="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                        Condition: {entry.conditionAfter}
                      </span>
                    )}
                  </div>
                  <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{entry.notes}</p>
                  {entry.performedBy && (
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-500">By: {entry.performedBy}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
