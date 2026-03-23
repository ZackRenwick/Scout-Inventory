import { Handlers, PageProps } from "$fresh/server.ts";
import BetaBanner from "../../components/BetaBanner.tsx";
import Layout from "../../components/Layout.tsx";
import type { Session } from "../../lib/auth.ts";
import {
  createFirstAidKit,
  getAllFirstAidCatalogItems,
  deleteFirstAidKit,
  getAllFirstAidKits,
  getFirstAidKitById,
  updateFirstAidKit,
} from "../../db/kv.ts";
import { FIRST_AID_PROFILES, buildEntriesFromProfile, getCatalogItemName } from "../../lib/firstAidCatalog.ts";
import type { FirstAidKit } from "../../types/firstAid.ts";
import type { FirstAidCatalogItem } from "../../types/firstAid.ts";
import { logActivity } from "../../lib/activityLog.ts";

interface FirstAidPageData {
  kits: FirstAidKit[];
  catalog: FirstAidCatalogItem[];
  session?: Session;
  error?: string;
  flash?: string;
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
  async GET(_req, ctx) {
    const session = ctx.state.session as Session;
    const [kits, catalog] = await Promise.all([getAllFirstAidKits(), getAllFirstAidCatalogItems()]);
    return ctx.render({ kits, catalog, session });
  },

  async POST(req, ctx) {
    const session = ctx.state.session as Session;
    if (!session || session.role === "viewer") {
      return new Response("Forbidden", { status: 403 });
    }

    const form = await req.formData();
    const csrfFromForm = form.get("_csrf")?.toString();
    if (csrfFromForm !== session.csrfToken) {
      return new Response("Invalid CSRF token", { status: 403 });
    }

    const action = form.get("action")?.toString();

    if (action === "create_kit") {
      const name = form.get("name")?.toString().trim() ?? "";
      const profileId = form.get("profileId")?.toString() ?? "";
      if (!name) {
        const [kits, catalog] = await Promise.all([getAllFirstAidKits(), getAllFirstAidCatalogItems()]);
        return ctx.render({ kits, catalog, session, error: "Kit name is required." });
      }
      if (name.length > 80) {
        const [kits, catalog] = await Promise.all([getAllFirstAidKits(), getAllFirstAidCatalogItems()]);
        return ctx.render({ kits, catalog, session, error: "Kit name must be 80 characters or fewer." });
      }
      const catalog = await getAllFirstAidCatalogItems();
      const entries = profileId ? buildEntriesFromProfile(profileId, catalog) : [];
      await createFirstAidKit(name, entries, session.username, profileId || undefined);
      await logActivity({
        username: session.username,
        action: "first_aid.kit_created",
        resource: name,
        details: profileId ? `Created from profile ${profileId}` : "Created empty kit",
      });
      return new Response(null, { status: 303, headers: { Location: "/first-aid" } });
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
      return new Response(null, { status: 303, headers: { Location: "/first-aid" } });
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
      return new Response(null, { status: 303, headers: { Location: "/first-aid" } });
    }

    if (action === "rename_kit") {
      const kitId = form.get("kitId")?.toString() ?? "";
      const name = form.get("name")?.toString().trim() ?? "";
      if (kitId && name && name.length <= 80) {
        await updateFirstAidKit(kitId, { name });
      }
      return new Response(null, { status: 303, headers: { Location: "/first-aid" } });
    }

    if (action === "apply_profile") {
      const kitId = form.get("kitId")?.toString() ?? "";
      const profileId = form.get("profileId")?.toString() ?? "";
      const catalog = await getAllFirstAidCatalogItems();
      const entries = buildEntriesFromProfile(profileId, catalog);
      if (kitId && entries.length > 0) {
        await updateFirstAidKit(kitId, { entries, profileId });
      }
      return new Response(null, { status: 303, headers: { Location: "/first-aid" } });
    }

    if (action === "add_item") {
      const kitId = form.get("kitId")?.toString() ?? "";
      const itemId = form.get("itemId")?.toString() ?? "";
      const qtyRaw = form.get("quantity")?.toString() ?? "1";
      const quantityTarget = Math.max(1, Math.min(999, Number.parseInt(qtyRaw, 10) || 1));
      const catalog = await getAllFirstAidCatalogItems();
      const name = getCatalogItemName(itemId, catalog);
      const kit = await getFirstAidKitById(kitId);
      if (kit && name) {
        const existingIdx = kit.entries.findIndex((e) => e.itemId === itemId);
        const nextEntries = [...kit.entries];
        if (existingIdx >= 0) {
          nextEntries[existingIdx] = { ...nextEntries[existingIdx], quantityTarget };
        } else {
          nextEntries.push({ itemId, name, quantityTarget });
        }
        await updateFirstAidKit(kitId, { entries: nextEntries });
      }
      return new Response(null, { status: 303, headers: { Location: "/first-aid" } });
    }

    if (action === "update_qty") {
      const kitId = form.get("kitId")?.toString() ?? "";
      const itemId = form.get("itemId")?.toString() ?? "";
      const qtyRaw = form.get("quantity")?.toString() ?? "0";
      const quantityTarget = Math.max(0, Math.min(999, Number.parseInt(qtyRaw, 10) || 0));
      const kit = await getFirstAidKitById(kitId);
      if (kit) {
        const nextEntries = kit.entries.map((e) => e.itemId === itemId ? { ...e, quantityTarget } : e);
        await updateFirstAidKit(kitId, { entries: nextEntries });
      }
      return new Response(null, { status: 303, headers: { Location: "/first-aid" } });
    }

    if (action === "remove_item") {
      const kitId = form.get("kitId")?.toString() ?? "";
      const itemId = form.get("itemId")?.toString() ?? "";
      const kit = await getFirstAidKitById(kitId);
      if (kit) {
        const nextEntries = kit.entries.filter((e) => e.itemId !== itemId);
        await updateFirstAidKit(kitId, { entries: nextEntries, profileId: "custom" });
      }
      return new Response(null, { status: 303, headers: { Location: "/first-aid" } });
    }

    return new Response(null, { status: 303, headers: { Location: "/first-aid" } });
  },
};

export default function FirstAidPage({ data }: PageProps<FirstAidPageData>) {
  const canEdit = data.session?.role !== "viewer";
  return (
    <Layout title="First Aid Kits" username={data.session?.username} role={data.session?.role}>
      <BetaBanner featureName="First Aid" />

      <div class="mb-6">
        <div class="flex justify-between items-center gap-4 flex-wrap">
          <p class="text-gray-600 dark:text-gray-400">
            Manage reusable first-aid kits, autofill from profiles, and print bag inserts
          </p>

          <div class="flex gap-2 flex-wrap items-center">
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
          </div>
        </div>
      </div>

      <div class="space-y-6">
        {data.error && (
          <div class="p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
            {data.error}
          </div>
        )}

        {canEdit && (
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-5 sm:p-6">
            <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-3">Add New Kit</h3>
            <form method="POST" class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <input type="hidden" name="_csrf" value={data.session?.csrfToken ?? ""} />
              <input type="hidden" name="action" value="create_kit" />
              <div class="md:col-span-2">
                <label class="block text-sm text-gray-700 dark:text-gray-300 mb-1">Kit Name</label>
                <input name="name" required maxLength={80} class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label class="block text-sm text-gray-700 dark:text-gray-300 mb-1">Autofill Profile</label>
                <select name="profileId" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  <option value="">Start empty</option>
                  {FIRST_AID_PROFILES.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <button type="submit" class="px-4 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700">
                Add Kit
              </button>
            </form>
          </div>
        )}

        {data.kits.length === 0 ? (
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 text-sm text-gray-600 dark:text-gray-400">
            No first-aid kits yet. Create one above and optionally autofill from a profile.
          </div>
        ) : (
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.kits.map((kit) => {
              const sorted = [...kit.entries].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
              return (
                <div key={kit.id} class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 flex flex-col">
                  <details class="group flex-1">
                    <summary class="cursor-pointer list-none p-4 flex items-start justify-between gap-2">
                      <div>
                        <h3 class="font-semibold text-gray-800 dark:text-gray-100 text-lg leading-tight">{kit.name}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{kit.entries.length} item{kit.entries.length === 1 ? "" : "s"} configured</p>
                      </div>
                      <span class={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${profileChipClass(kit.profileId)}`}>
                        {profileLabel(kit.profileId)}
                      </span>
                    </summary>

                    <div class="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                    {canEdit && (
                    <div class="mt-4 grid grid-cols-1 gap-3">
                      <form method="POST" class="flex gap-2 items-end">
                        <input type="hidden" name="_csrf" value={data.session?.csrfToken ?? ""} />
                        <input type="hidden" name="action" value="rename_kit" />
                        <input type="hidden" name="kitId" value={kit.id} />
                        <div class="flex-1">
                          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Rename Kit</label>
                          <input name="name" defaultValue={kit.name} maxLength={80} class="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm" />
                        </div>
                        <button type="submit" class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">Save</button>
                      </form>

                      <form method="POST" class="flex gap-2 items-end">
                        <input type="hidden" name="_csrf" value={data.session?.csrfToken ?? ""} />
                        <input type="hidden" name="action" value="apply_profile" />
                        <input type="hidden" name="kitId" value={kit.id} />
                        <div class="flex-1">
                          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Autofill / Replace From Profile</label>
                          <select name="profileId" class="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm">
                            {FIRST_AID_PROFILES.map((p) => (
                              <option key={`${kit.id}-${p.id}`} value={p.id} selected={kit.profileId === p.id}>{p.label}</option>
                            ))}
                          </select>
                        </div>
                        <button type="submit" class="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700">Apply</button>
                      </form>
                    </div>
                  )}

                  <div class="mt-4 overflow-x-auto">
                    <table class="min-w-full text-sm">
                      <thead>
                        <tr class="text-left border-b border-gray-200 dark:border-gray-700">
                          <th class="py-2 pr-2 text-gray-500 dark:text-gray-400">Item</th>
                          <th class="py-2 pr-2 text-gray-500 dark:text-gray-400">Target Qty</th>
                          {canEdit && <th class="py-2 text-gray-500 dark:text-gray-400">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((entry) => (
                          <tr key={`${kit.id}-${entry.itemId}`} class="border-b border-gray-100 dark:border-gray-800">
                            <td class="py-2 pr-2 text-gray-900 dark:text-gray-100">{entry.name}</td>
                            <td class="py-2 pr-2">
                              {canEdit ? (
                                <form method="POST" class="flex items-center gap-2">
                                  <input type="hidden" name="_csrf" value={data.session?.csrfToken ?? ""} />
                                  <input type="hidden" name="action" value="update_qty" />
                                  <input type="hidden" name="kitId" value={kit.id} />
                                  <input type="hidden" name="itemId" value={entry.itemId} />
                                  <input type="number" name="quantity" min={0} max={999} value={entry.quantityTarget} class="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                                  <button type="submit" class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-200 dark:hover:bg-gray-600">Save</button>
                                </form>
                              ) : (
                                <span class="text-gray-900 dark:text-gray-100">{entry.quantityTarget}</span>
                              )}
                            </td>
                            {canEdit && (
                              <td class="py-2">
                                <form method="POST">
                                  <input type="hidden" name="_csrf" value={data.session?.csrfToken ?? ""} />
                                  <input type="hidden" name="action" value="remove_item" />
                                  <input type="hidden" name="kitId" value={kit.id} />
                                  <input type="hidden" name="itemId" value={entry.itemId} />
                                  <button type="submit" class="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50">Remove</button>
                                </form>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {canEdit && (
                    <form method="POST" class="mt-4 grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                      <input type="hidden" name="_csrf" value={data.session?.csrfToken ?? ""} />
                      <input type="hidden" name="action" value="add_item" />
                      <input type="hidden" name="kitId" value={kit.id} />
                      <div class="md:col-span-2">
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Add Catalog Item</label>
                        <select name="itemId" class="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm">
                          {data.catalog.map((c) => (
                            <option key={`${kit.id}-add-${c.id}`} value={c.id}>{c.section} - {c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Qty</label>
                        <input type="number" name="quantity" min={1} max={999} value={1} class="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm" />
                      </div>
                      <button type="submit" class="px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700">Add / Update</button>
                    </form>
                  )}
                    </div>
                  </details>

                  <div class="border-t border-gray-100 dark:border-gray-700 px-4 py-3 flex gap-2">
                    <a
                      href={`/first-aid/print?kit=${kit.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="flex-1 text-center text-sm font-medium px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                    >
                      Print
                    </a>
                    {canEdit && (
                      <form method="POST">
                        <input type="hidden" name="_csrf" value={data.session?.csrfToken ?? ""} />
                        <input type="hidden" name="action" value="duplicate_kit" />
                        <input type="hidden" name="kitId" value={kit.id} />
                        <button type="submit" class="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Duplicate</button>
                      </form>
                    )}
                    {canEdit && (
                      <form method="POST">
                        <input type="hidden" name="_csrf" value={data.session?.csrfToken ?? ""} />
                        <input type="hidden" name="action" value="delete_kit" />
                        <input type="hidden" name="kitId" value={kit.id} />
                        <button type="submit" class="text-sm px-3 py-1.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Delete</button>
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
