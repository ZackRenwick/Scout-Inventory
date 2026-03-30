import { Handlers, PageProps } from "$fresh/server.ts";
import BetaBanner from "../../components/BetaBanner.tsx";
import Layout from "../../components/Layout.tsx";
import type { Session } from "../../lib/auth.ts";
import {
  createFirstAidKit,
  deleteFirstAidKit,
  dismissFirstAidKitCheckReminder,
  dismissFirstAidOverallCheckReminder,
  getAllFirstAidCatalogItems,
  getAllFirstAidKits,
  getFirstAidKitById,
  getFirstAidKitCheckStates,
  getFirstAidOverallCheckState,
  resetFirstAidCheckStates,
  updateFirstAidKit,
} from "../../db/kv.ts";
import {
  buildEntriesFromProfile,
  FIRST_AID_PROFILES,
  getCatalogItemName,
} from "../../lib/firstAidCatalog.ts";
import type { FirstAidKit } from "../../types/firstAid.ts";
import type { FirstAidCatalogItem } from "../../types/firstAid.ts";
import { logActivity } from "../../lib/activityLog.ts";

interface FirstAidPageData {
  kits: FirstAidKit[];
  catalog: FirstAidCatalogItem[];
  editingKitId?: string | null;
  kitLastCheckedById?: Record<string, Date | null>;
  kitDismissedUntilById?: Record<string, Date | null>;
  overallCheckDue?: boolean;
  overallLastCheckedAt?: Date | null;
  overallDismissedUntil?: Date | null;
  perKitDue?: Array<
    { kitId: string; kitName: string; lastCheckedAt: Date | null }
  >;
  session?: Session;
  error?: string;
  flash?: string;
}

function isDismissed(dismissedUntil: Date | null | undefined): boolean {
  return !!dismissedUntil && dismissedUntil.getTime() > Date.now();
}

function addOneCalendarMonth(from: Date): Date {
  const next = new Date(from);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + 1);
  const daysInTargetMonth = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0,
  ).getDate();
  next.setDate(Math.min(day, daysInTargetMonth));
  return next;
}

function isMonthlyDue(lastCheckedAt: Date | null | undefined): boolean {
  if (!lastCheckedAt) return true;
  return Date.now() >= addOneCalendarMonth(lastCheckedAt).getTime();
}

function formatLastChecked(lastCheckedAt: Date | null): string {
  if (!lastCheckedAt) return "never";
  return lastCheckedAt.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getNextCheckDueDate(
  lastCheckedAt: Date | null | undefined,
  dismissedUntil?: Date | null,
): Date | null {
  const checkDueDate = lastCheckedAt ? addOneCalendarMonth(lastCheckedAt) : null;

  if (checkDueDate && dismissedUntil) {
    return checkDueDate.getTime() > dismissedUntil.getTime()
      ? checkDueDate
      : dismissedUntil;
  }
  return checkDueDate ?? dismissedUntil ?? null;
}

function formatNextCheckDue(
  lastCheckedAt: Date | null | undefined,
  dismissedUntil?: Date | null,
): string {
  const dueDate = getNextCheckDueDate(lastCheckedAt, dismissedUntil);
  if (!dueDate) return "now";
  return dueDate.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function profileLabel(profileId?: string): string {
  return FIRST_AID_PROFILES.find((p) => p.id === profileId)?.label ?? "Custom";
}

function profileChipClass(profileId?: string): string {
  if (!profileId || profileId === "custom") {
    return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
  }
  return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
}

export const handler: Handlers<FirstAidPageData> = {
  async GET(req, ctx) {
    const session = ctx.state.session as Session;
    const url = new URL(req.url);
    const editingKitId = url.searchParams.get("edit")?.trim() || null;
    const [kits, catalog, overallCheckState, kitCheckStates] = await Promise
      .all([
        getAllFirstAidKits(),
        getAllFirstAidCatalogItems(),
        getFirstAidOverallCheckState(),
        getFirstAidKitCheckStates(),
      ]);

    const overallCheckDue = isMonthlyDue(overallCheckState?.lastCheckedAt) &&
      !isDismissed(overallCheckState?.dismissedUntil);

    const perKitDue = kits
      .filter((kit) => {
        const state = kitCheckStates[kit.id];
        return isMonthlyDue(state?.lastCheckedAt) &&
          !isDismissed(state?.dismissedUntil);
      })
      .map((kit) => ({
        kitId: kit.id,
        kitName: kit.name,
        lastCheckedAt: kitCheckStates[kit.id]?.lastCheckedAt ?? null,
      }));

    const kitLastCheckedById = Object.fromEntries(
      kits.map((
        kit,
      ) => [kit.id, kitCheckStates[kit.id]?.lastCheckedAt ?? null]),
    );

    const kitDismissedUntilById = Object.fromEntries(
      kits.map((
        kit,
      ) => [kit.id, kitCheckStates[kit.id]?.dismissedUntil ?? null]),
    );

    return ctx.render({
      kits,
      catalog,
      session,
      editingKitId,
      kitLastCheckedById,
      kitDismissedUntilById,
      overallCheckDue,
      overallLastCheckedAt: overallCheckState?.lastCheckedAt ?? null,
      overallDismissedUntil: overallCheckState?.dismissedUntil ?? null,
      perKitDue,
    });
  },

  async POST(req, ctx) {
    const session = ctx.state.session as Session;
    if (!session) {
      return new Response("Forbidden", { status: 403 });
    }

    const form = await req.formData();
    const csrfFromForm = form.get("_csrf")?.toString();
    if (csrfFromForm !== session.csrfToken) {
      return new Response("Invalid CSRF token", { status: 403 });
    }

    const action = form.get("action")?.toString();

    if (action === "dismiss_overall_check_reminder") {
      await dismissFirstAidOverallCheckReminder();
      return new Response(null, {
        status: 303,
        headers: { Location: "/first-aid" },
      });
    }

    if (action === "dismiss_kit_check_reminder") {
      const kitId = form.get("kitId")?.toString() ?? "";
      if (kitId) {
        await dismissFirstAidKitCheckReminder(kitId);
      }
      return new Response(null, {
        status: 303,
        headers: { Location: "/first-aid" },
      });
    }

    if (action === "admin_reset_kit_checks") {
      if (session.role !== "admin") {
        return new Response("Forbidden", { status: 403 });
      }
      await resetFirstAidCheckStates();
      await logActivity({
        username: session.username,
        action: "first_aid.check_reset",
        details: "Reset overall and per-kit first-aid check states",
      });
      return new Response(null, {
        status: 303,
        headers: { Location: "/first-aid" },
      });
    }

    if (session.role === "viewer") {
      return new Response("Forbidden", { status: 403 });
    }

    if (action === "create_kit") {
      const name = form.get("name")?.toString().trim() ?? "";
      const profileId = form.get("profileId")?.toString() ?? "";
      if (!name) {
        const [kits, catalog] = await Promise.all([
          getAllFirstAidKits(),
          getAllFirstAidCatalogItems(),
        ]);
        return ctx.render({
          kits,
          catalog,
          session,
          error: "Kit name is required.",
        });
      }
      if (name.length > 80) {
        const [kits, catalog] = await Promise.all([
          getAllFirstAidKits(),
          getAllFirstAidCatalogItems(),
        ]);
        return ctx.render({
          kits,
          catalog,
          session,
          error: "Kit name must be 80 characters or fewer.",
        });
      }
      const catalog = await getAllFirstAidCatalogItems();
      const entries = profileId
        ? buildEntriesFromProfile(profileId, catalog)
        : [];
      await createFirstAidKit(
        name,
        entries,
        session.username,
        profileId || undefined,
      );
      await logActivity({
        username: session.username,
        action: "first_aid.kit_created",
        resource: name,
        details: profileId
          ? `Created from profile ${profileId}`
          : "Created empty kit",
      });
      return new Response(null, {
        status: 303,
        headers: { Location: "/first-aid" },
      });
    }

    if (action === "delete_kit") {
      const kitId = form.get("kitId")?.toString() ?? "";
      const kit = await getFirstAidKitById(kitId);
      if (kit) {
        await deleteFirstAidKit(kitId);
        await logActivity({
          username: session.username,
          action: "first_aid.kit_deleted",
          resource: kit.name,
          resourceId: kit.id,
        });
      }
      return new Response(null, {
        status: 303,
        headers: { Location: "/first-aid" },
      });
    }

    if (action === "duplicate_kit") {
      const kitId = form.get("kitId")?.toString() ?? "";
      const kit = await getFirstAidKitById(kitId);
      if (kit) {
        const copyName = `${kit.name} (Copy)`;
        await createFirstAidKit(
          copyName,
          kit.entries.map((e) => ({ ...e })),
          session.username,
          kit.profileId,
        );
        await logActivity({
          username: session.username,
          action: "first_aid.kit_created",
          resource: copyName,
          details: `Duplicated from ${kit.name}`,
        });
      }
      return new Response(null, {
        status: 303,
        headers: { Location: "/first-aid" },
      });
    }

    if (action === "rename_kit") {
      const kitId = form.get("kitId")?.toString() ?? "";
      const name = form.get("name")?.toString().trim() ?? "";
      if (kitId && name && name.length <= 80) {
        await updateFirstAidKit(kitId, { name });
      }
      return new Response(null, {
        status: 303,
        headers: {
          Location: kitId ? `/first-aid?edit=${encodeURIComponent(kitId)}` : "/first-aid",
        },
      });
    }

    if (action === "apply_profile") {
      const kitId = form.get("kitId")?.toString() ?? "";
      const profileId = form.get("profileId")?.toString() ?? "";
      const catalog = await getAllFirstAidCatalogItems();
      const entries = buildEntriesFromProfile(profileId, catalog);
      if (kitId && entries.length > 0) {
        await updateFirstAidKit(kitId, { entries, profileId });
      }
      return new Response(null, {
        status: 303,
        headers: {
          Location: kitId ? `/first-aid?edit=${encodeURIComponent(kitId)}` : "/first-aid",
        },
      });
    }

    if (action === "add_item") {
      const kitId = form.get("kitId")?.toString() ?? "";
      const itemId = form.get("itemId")?.toString() ?? "";
      const qtyRaw = form.get("quantity")?.toString() ?? "1";
      const quantityTarget = Math.max(
        1,
        Math.min(999, Number.parseInt(qtyRaw, 10) || 1),
      );
      const catalog = await getAllFirstAidCatalogItems();
      const name = getCatalogItemName(itemId, catalog);
      const kit = await getFirstAidKitById(kitId);
      if (kit && name) {
        const existingIdx = kit.entries.findIndex((e) => e.itemId === itemId);
        const nextEntries = [...kit.entries];
        if (existingIdx >= 0) {
          nextEntries[existingIdx] = {
            ...nextEntries[existingIdx],
            quantityTarget,
          };
        } else {
          nextEntries.push({ itemId, name, quantityTarget });
        }
        await updateFirstAidKit(kitId, { entries: nextEntries });
      }
      return new Response(null, {
        status: 303,
        headers: {
          Location: kitId ? `/first-aid?edit=${encodeURIComponent(kitId)}` : "/first-aid",
        },
      });
    }

    if (action === "update_qty") {
      const kitId = form.get("kitId")?.toString() ?? "";
      const itemId = form.get("itemId")?.toString() ?? "";
      const qtyRaw = form.get("quantity")?.toString() ?? "0";
      const quantityTarget = Math.max(
        0,
        Math.min(999, Number.parseInt(qtyRaw, 10) || 0),
      );
      const kit = await getFirstAidKitById(kitId);
      if (kit) {
        const nextEntries = kit.entries.map((e) =>
          e.itemId === itemId ? { ...e, quantityTarget } : e
        );
        await updateFirstAidKit(kitId, { entries: nextEntries });
      }
      return new Response(null, {
        status: 303,
        headers: {
          Location: kitId ? `/first-aid?edit=${encodeURIComponent(kitId)}` : "/first-aid",
        },
      });
    }

    if (action === "remove_item") {
      const kitId = form.get("kitId")?.toString() ?? "";
      const itemId = form.get("itemId")?.toString() ?? "";
      const kit = await getFirstAidKitById(kitId);
      if (kit) {
        const nextEntries = kit.entries.filter((e) => e.itemId !== itemId);
        await updateFirstAidKit(kitId, {
          entries: nextEntries,
          profileId: "custom",
        });
      }
      return new Response(null, {
        status: 303,
        headers: {
          Location: kitId ? `/first-aid?edit=${encodeURIComponent(kitId)}` : "/first-aid",
        },
      });
    }

    return new Response(null, {
      status: 303,
      headers: { Location: "/first-aid" },
    });
  },
};

export default function FirstAidPage({ data }: PageProps<FirstAidPageData>) {
  const canEdit = data.session?.role !== "viewer";
  const kitLastCheckedById = data.kitLastCheckedById ?? {};
  const kitDismissedUntilById = data.kitDismissedUntilById ?? {};
  const overallCheckDue = data.overallCheckDue ?? false;
  const perKitDue = data.perKitDue ?? [];
  return (
    <Layout
      title="First Aid Kits"
      username={data.session?.username}
      role={data.session?.role}
    >
      <BetaBanner featureName="First Aid" />

      <div class="mb-6">
        <div class="flex justify-between items-center gap-4 flex-wrap">
          <p class="text-gray-600 dark:text-gray-400">
            Manage reusable first-aid kits, autofill from profiles, and print
            bag inserts
          </p>

          <div class="flex gap-2 flex-wrap items-center">
            <a
              href="/first-aid/check"
              class="px-4 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 transition-colors"
            >
              ✅ Run Kit Check
            </a>
            <a
              href="/first-aid/print"
              target="_blank"
              rel="noopener noreferrer"
              class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              🖨️ Print Inserts
            </a>
            <a
              href="/first-aid/catalog"
              class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              📋 Manage Catalog
            </a>
            {data.session?.role === "admin" && (
              <form method="POST">
                <input
                  type="hidden"
                  name="_csrf"
                  value={data.session?.csrfToken ?? ""}
                />
                <input
                  type="hidden"
                  name="action"
                  value="admin_reset_kit_checks"
                />
                <button
                  type="submit"
                  class="px-4 py-2 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 font-medium rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                  title="Clears all first-aid check completion and reminder-dismiss state"
                >
                  ♻️ Reset Check Status
                </button>
              </form>
            )}
          </div>
        </div>
        <p class="mt-3 text-sm text-gray-700 dark:text-gray-300">
          Overall next check due:{" "}
          <span class="font-semibold">
            {formatNextCheckDue(
              data.overallLastCheckedAt ?? null,
              data.overallDismissedUntil ?? null,
            )}
          </span>
        </p>
      </div>

      <div class="space-y-6">
        {data.error && (
          <div class="p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
            {data.error}
          </div>
        )}

        {(overallCheckDue || perKitDue.length > 0) && (
          <div class="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-3">
            {overallCheckDue && (
              <div class="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p class="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    Monthly overall first-aid check is due
                  </p>
                  <p class="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                    Last completed:{" "}
                    {formatLastChecked(data.overallLastCheckedAt ?? null)}
                  </p>
                  <p class="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                    Next due: {formatNextCheckDue(
                      data.overallLastCheckedAt ?? null,
                      data.overallDismissedUntil ?? null,
                    )}
                  </p>
                </div>
                <div class="flex gap-2">
                  <a
                    href="/first-aid/check"
                    class="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700"
                  >
                    Run Overall Check
                  </a>
                  <form method="POST">
                    <input
                      type="hidden"
                      name="_csrf"
                      value={data.session?.csrfToken ?? ""}
                    />
                    <input
                      type="hidden"
                      name="action"
                      value="dismiss_overall_check_reminder"
                    />
                    <button
                      type="submit"
                      class="px-3 py-1.5 text-sm border border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-200 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/30"
                    >
                      Dismiss until next month
                    </button>
                  </form>
                </div>
              </div>
            )}

            {perKitDue.length > 0 && (
              <div>
                <p class="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  {perKitDue.length} kit{perKitDue.length === 1 ? "" : "s"}{" "}
                  due individual monthly checks
                </p>
                <div class="mt-2 space-y-2">
                  {perKitDue.map((kitDue) => (
                    <div
                      key={`due-${kitDue.kitId}`}
                      class="flex items-start justify-between gap-3 flex-wrap text-sm"
                    >
                      <p class="text-amber-800 dark:text-amber-200">
                        <strong>{kitDue.kitName}</strong> · last checked{" "}
                        {formatLastChecked(kitDue.lastCheckedAt)} · next due
                        {" "}
                        {formatNextCheckDue(kitDue.lastCheckedAt)}
                      </p>
                      <div class="flex gap-2">
                        <a
                          href={`/first-aid/check?kit=${kitDue.kitId}`}
                          class="px-3 py-1.5 bg-white dark:bg-gray-800 border border-amber-400 dark:border-amber-600 rounded-md text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                        >
                          Check kit
                        </a>
                        <form method="POST">
                          <input
                            type="hidden"
                            name="_csrf"
                            value={data.session?.csrfToken ?? ""}
                          />
                          <input
                            type="hidden"
                            name="action"
                            value="dismiss_kit_check_reminder"
                          />
                          <input
                            type="hidden"
                            name="kitId"
                            value={kitDue.kitId}
                          />
                          <button
                            type="submit"
                            class="px-3 py-1.5 border border-amber-400 dark:border-amber-600 rounded-md text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                          >
                            Dismiss until next month
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {canEdit && (
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-5 sm:p-6">
            <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-3">
              Add New Kit
            </h3>
            <form
              method="POST"
              class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
            >
              <input
                type="hidden"
                name="_csrf"
                value={data.session?.csrfToken ?? ""}
              />
              <input type="hidden" name="action" value="create_kit" />
              <div class="md:col-span-2">
                <label class="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Kit Name
                </label>
                <input
                  name="name"
                  required
                  maxLength={80}
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Autofill Profile
                </label>
                <select
                  name="profileId"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Start empty</option>
                  {FIRST_AID_PROFILES.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                class="px-4 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700"
              >
                Add Kit
              </button>
            </form>
          </div>
        )}

        {data.kits.length === 0
          ? (
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 text-sm text-gray-600 dark:text-gray-400">
              No first-aid kits yet. Create one above and optionally autofill
              from a profile.
            </div>
          )
          : (
            <div class="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.kits.map((kit) => {
                const sorted = [...kit.entries].sort((a, b) =>
                  a.name.localeCompare(b.name, undefined, { numeric: true })
                );
                const lastCheckedAt = kitLastCheckedById[kit.id] ?? null;
                const isEditingKit = data.editingKitId === kit.id;
                return (
                  <div
                    key={kit.id}
                    class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 flex flex-col"
                  >
                    <div class="p-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 class="font-semibold text-gray-800 dark:text-gray-100 text-lg leading-tight">
                          {kit.name}
                        </h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {kit.entries.length}{" "}
                          item{kit.entries.length === 1 ? "" : "s"} configured
                        </p>
                      </div>
                      <div class="flex flex-col items-end gap-1">
                        <span
                          class={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                            profileChipClass(kit.profileId)
                          }`}
                        >
                          {profileLabel(kit.profileId)}
                        </span>
                        <span class="text-xs font-medium px-2 py-0.5 rounded-full border border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 whitespace-nowrap">
                          Last checked: {formatLastChecked(lastCheckedAt)}
                        </span>
                        <span class="text-xs font-medium px-2 py-0.5 rounded-full border border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-700 dark:bg-teal-900/30 dark:text-teal-200 whitespace-nowrap">
                          Next due: {formatNextCheckDue(
                            lastCheckedAt,
                            kitDismissedUntilById[kit.id] ?? null,
                          )}
                        </span>
                      </div>
                    </div>

                    {isEditingKit && (
                      <div class="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                        {canEdit && (
                          <div class="mt-4 grid grid-cols-1 gap-3">
                            <form method="POST" class="flex gap-2 items-end">
                              <input
                                type="hidden"
                                name="_csrf"
                                value={data.session?.csrfToken ?? ""}
                              />
                              <input
                                type="hidden"
                                name="action"
                                value="rename_kit"
                              />
                              <input
                                type="hidden"
                                name="kitId"
                                value={kit.id}
                              />
                              <div class="flex-1">
                                <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                  Rename Kit
                                </label>
                                <input
                                  name="name"
                                  defaultValue={kit.name}
                                  maxLength={80}
                                  class="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                                />
                              </div>
                              <button
                                type="submit"
                                class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                              >
                                Save
                              </button>
                            </form>

                            <form method="POST" class="flex gap-2 items-end">
                              <input
                                type="hidden"
                                name="_csrf"
                                value={data.session?.csrfToken ?? ""}
                              />
                              <input
                                type="hidden"
                                name="action"
                                value="apply_profile"
                              />
                              <input
                                type="hidden"
                                name="kitId"
                                value={kit.id}
                              />
                              <div class="flex-1">
                                <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                  Autofill / Replace From Profile
                                </label>
                                <select
                                  name="profileId"
                                  class="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                                >
                                  {FIRST_AID_PROFILES.map((p) => (
                                    <option
                                      key={`${kit.id}-${p.id}`}
                                      value={p.id}
                                      selected={kit.profileId === p.id}
                                    >
                                      {p.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <button
                                type="submit"
                                class="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700"
                              >
                                Apply
                              </button>
                            </form>
                          </div>
                        )}

                        <div class="mt-4 overflow-x-auto">
                          <table class="min-w-full text-sm">
                            <thead>
                              <tr class="text-left border-b border-gray-200 dark:border-gray-700">
                                <th class="py-2 pr-2 text-gray-500 dark:text-gray-400">
                                  Item
                                </th>
                                <th class="py-2 pr-2 text-gray-500 dark:text-gray-400">
                                  Target Qty
                                </th>
                                {canEdit && (
                                  <th class="py-2 text-gray-500 dark:text-gray-400">
                                    Actions
                                  </th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {sorted.map((entry) => (
                                <tr
                                  key={`${kit.id}-${entry.itemId}`}
                                  class="border-b border-gray-100 dark:border-gray-800"
                                >
                                  <td class="py-2 pr-2 text-gray-900 dark:text-gray-100">
                                    {entry.name}
                                  </td>
                                  <td class="py-2 pr-2">
                                    {canEdit
                                      ? (
                                        <form
                                          method="POST"
                                          class="flex items-center gap-2"
                                        >
                                          <input
                                            type="hidden"
                                            name="_csrf"
                                            value={data.session?.csrfToken ??
                                              ""}
                                          />
                                          <input
                                            type="hidden"
                                            name="action"
                                            value="update_qty"
                                          />
                                          <input
                                            type="hidden"
                                            name="kitId"
                                            value={kit.id}
                                          />
                                          <input
                                            type="hidden"
                                            name="itemId"
                                            value={entry.itemId}
                                          />
                                          <input
                                            type="number"
                                            name="quantity"
                                            min={0}
                                            max={999}
                                            value={entry.quantityTarget}
                                            class="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                          />
                                          <button
                                            type="submit"
                                            class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                                          >
                                            Save
                                          </button>
                                        </form>
                                      )
                                      : (
                                        <span class="text-gray-900 dark:text-gray-100">
                                          {entry.quantityTarget}
                                        </span>
                                      )}
                                  </td>
                                  {canEdit && (
                                    <td class="py-2">
                                      <form method="POST">
                                        <input
                                          type="hidden"
                                          name="_csrf"
                                          value={data.session?.csrfToken ?? ""}
                                        />
                                        <input
                                          type="hidden"
                                          name="action"
                                          value="remove_item"
                                        />
                                        <input
                                          type="hidden"
                                          name="kitId"
                                          value={kit.id}
                                        />
                                        <input
                                          type="hidden"
                                          name="itemId"
                                          value={entry.itemId}
                                        />
                                        <button
                                          type="submit"
                                          class="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
                                        >
                                          Remove
                                        </button>
                                      </form>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {canEdit && (
                          <form
                            method="POST"
                            class="mt-4 grid grid-cols-1 md:grid-cols-4 gap-2 items-end"
                          >
                            <input
                              type="hidden"
                              name="_csrf"
                              value={data.session?.csrfToken ?? ""}
                            />
                            <input
                              type="hidden"
                              name="action"
                              value="add_item"
                            />
                            <input type="hidden" name="kitId" value={kit.id} />
                            <div class="md:col-span-2">
                              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                Add Catalog Item
                              </label>
                              <select
                                name="itemId"
                                class="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                              >
                                {data.catalog.map((c) => (
                                  <option
                                    key={`${kit.id}-add-${c.id}`}
                                    value={c.id}
                                  >
                                    {c.section} - {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                Qty
                              </label>
                              <input
                                type="number"
                                name="quantity"
                                min={1}
                                max={999}
                                value={1}
                                class="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                              />
                            </div>
                            <button
                              type="submit"
                              class="px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                            >
                              Add / Update
                            </button>
                          </form>
                        )}
                      </div>
                    )}

                    <div class="border-t border-gray-100 dark:border-gray-700 px-4 py-3 flex flex-wrap gap-2">
                      <a
                        href={isEditingKit
                          ? "/first-aid"
                          : `/first-aid?edit=${kit.id}`}
                        class="flex-1 min-w-[5.5rem] text-center text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        {isEditingKit ? "Close" : canEdit ? "Edit" : "View"}
                      </a>
                      <a
                        href={`/first-aid/check?kit=${kit.id}`}
                        class="flex-1 min-w-[5.5rem] text-center text-sm px-3 py-1.5 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 rounded hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                      >
                        Check
                      </a>
                      <a
                        href={`/first-aid/print?kit=${kit.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="flex-1 min-w-[5.5rem] text-center text-sm font-medium px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                      >
                        Print
                      </a>
                      {canEdit && (
                        <form method="POST" class="flex-1 min-w-[6.75rem]">
                          <input
                            type="hidden"
                            name="_csrf"
                            value={data.session?.csrfToken ?? ""}
                          />
                          <input
                            type="hidden"
                            name="action"
                            value="duplicate_kit"
                          />
                          <input type="hidden" name="kitId" value={kit.id} />
                          <button
                            type="submit"
                            class="w-full text-center text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            Duplicate
                          </button>
                        </form>
                      )}
                      {canEdit && (
                        <form method="POST" class="flex-1 min-w-[6.25rem]">
                          <input
                            type="hidden"
                            name="_csrf"
                            value={data.session?.csrfToken ?? ""}
                          />
                          <input
                            type="hidden"
                            name="action"
                            value="delete_kit"
                          />
                          <input type="hidden" name="kitId" value={kit.id} />
                          <button
                            type="submit"
                            class="w-full text-center text-sm px-3 py-1.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            Delete
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </Layout>
  );
}
