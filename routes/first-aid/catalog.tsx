import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../components/Layout.tsx";
import type { Session } from "../../lib/auth.ts";
import {
  createFirstAidCatalogItem,
  deleteFirstAidCatalogItem,
  getAllFirstAidCatalogItems,
  getAllFirstAidKits,
  updateFirstAidCatalogItem,
} from "../../db/kv.ts";
import { FIRST_AID_SECTIONS, type FirstAidCatalogItem, type FirstAidSection, type FirstAidKit } from "../../types/firstAid.ts";

interface FirstAidCatalogPageData {
  catalog: FirstAidCatalogItem[];
  kits: FirstAidKit[];
  session?: Session;
  error?: string;
}

function isFirstAidSection(value: string): value is FirstAidSection {
  return (FIRST_AID_SECTIONS as readonly string[]).includes(value);
}

function normalizeSection(value: string | null): FirstAidSection {
  const next = (value ?? "General").trim();
  return isFirstAidSection(next) ? next : "General";
}

export const handler: Handlers<FirstAidCatalogPageData> = {
  async GET(_req, ctx) {
    const session = ctx.state.session as Session;
    const [catalog, kits] = await Promise.all([getAllFirstAidCatalogItems(), getAllFirstAidKits()]);
    return ctx.render({ catalog, kits, session });
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

    if (action === "catalog_create") {
      const name = form.get("name")?.toString().trim() ?? "";
      const section = normalizeSection(form.get("section")?.toString() ?? "General");
      if (name) {
        const id = `custom-${crypto.randomUUID().slice(0, 8)}`;
        await createFirstAidCatalogItem({ id, name, section });
      }
      return new Response(null, { status: 303, headers: { Location: "/first-aid/catalog" } });
    }

    if (action === "catalog_update") {
      const itemId = form.get("itemId")?.toString() ?? "";
      const name = form.get("name")?.toString().trim() ?? "";
      const section = normalizeSection(form.get("section")?.toString() ?? "General");
      if (itemId && name) {
        await updateFirstAidCatalogItem(itemId, { name, section });
      }
      return new Response(null, { status: 303, headers: { Location: "/first-aid/catalog" } });
    }

    if (action === "catalog_delete") {
      const itemId = form.get("itemId")?.toString() ?? "";
      if (itemId) {
        await deleteFirstAidCatalogItem(itemId);
      }
      return new Response(null, { status: 303, headers: { Location: "/first-aid/catalog" } });
    }

    return new Response(null, { status: 303, headers: { Location: "/first-aid/catalog" } });
  },
};

export default function FirstAidCatalogPage({ data }: PageProps<FirstAidCatalogPageData>) {
  const canEdit = data.session?.role !== "viewer";
  const usage = new Map<string, number>();
  for (const kit of data.kits) {
    for (const entry of kit.entries) {
      usage.set(entry.itemId, (usage.get(entry.itemId) ?? 0) + 1);
    }
  }

  const groupedCatalog = FIRST_AID_SECTIONS.map((section) => ({
    section,
    items: data.catalog
      .filter((item) => item.section === section)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
  })).filter((group) => group.items.length > 0);

  return (
    <Layout title="First Aid Catalog" username={data.session?.username} role={data.session?.role}>
      <div class="mb-6">
        <div class="flex justify-between items-center gap-4 flex-wrap">
          <p class="text-gray-600 dark:text-gray-400">
            Shared item library used by all first-aid kits
          </p>

          <div class="flex gap-2 flex-wrap items-center">
            <a
              href="/first-aid"
              class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              ← Back to First Aid Kits
            </a>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        {canEdit && (
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-5 sm:p-6">
            <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-3">Add Catalog Item</h3>
            <form method="POST" class="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
              <input type="hidden" name="_csrf" value={data.session?.csrfToken ?? ""} />
              <input type="hidden" name="action" value="catalog_create" />
              <div class="md:col-span-2">
                <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Item Name</label>
                <input name="name" required class="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm" />
              </div>
              <div>
                <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Section</label>
                <select name="section" class="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm">
                  {FIRST_AID_SECTIONS.map((section) => (
                    <option key={`create-section-${section}`} value={section}>{section}</option>
                  ))}
                </select>
              </div>
              <button type="submit" class="px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700">Add</button>
            </form>
          </div>
        )}

        <div class="space-y-4">
          {groupedCatalog.map((group) => (
            <section key={`section-${group.section}`} class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
              <div class="px-3 py-2 bg-slate-800 border-b border-slate-700">
                <p class="text-sm font-semibold text-slate-100">{group.section}</p>
                <p class="text-xs text-slate-300">{group.items.length} item{group.items.length === 1 ? "" : "s"}</p>
              </div>

              <div class="divide-y divide-gray-100 dark:divide-gray-800">
                {group.items.map((item) => (
                  <div key={`catalog-${item.id}`} class="p-3">
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                      {canEdit ? (
                        <form method="POST" class="md:col-span-10 grid grid-cols-1 md:grid-cols-10 gap-2 items-end">
                          <input type="hidden" name="_csrf" value={data.session?.csrfToken ?? ""} />
                          <input type="hidden" name="action" value="catalog_update" />
                          <input type="hidden" name="itemId" value={item.id} />
                          <div class="md:col-span-6">
                            <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Name</label>
                            <input name="name" value={item.name} class="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
                          </div>
                          <div class="md:col-span-3">
                            <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Section</label>
                            <select name="section" class="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                              {FIRST_AID_SECTIONS.map((section) => (
                                <option key={`${item.id}-${section}`} value={section} selected={item.section === section}>{section}</option>
                              ))}
                            </select>
                          </div>
                          <button type="submit" class="md:col-span-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-200 dark:hover:bg-gray-600">Save</button>
                        </form>
                      ) : (
                        <div class="md:col-span-10">
                          <p class="text-gray-900 dark:text-gray-100 text-sm">{item.name}</p>
                        </div>
                      )}

                      {canEdit && (
                        <form method="POST" class="md:col-span-2">
                          <input type="hidden" name="_csrf" value={data.session?.csrfToken ?? ""} />
                          <input type="hidden" name="action" value="catalog_delete" />
                          <input type="hidden" name="itemId" value={item.id} />
                          <button
                            type="submit"
                            class="w-full px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
                            title={usage.get(item.id)
                              ? `Used in ${usage.get(item.id)} kit${usage.get(item.id) === 1 ? "" : "s"}`
                              : "Not currently used in any kit"}
                          >
                            Delete
                          </button>
                        </form>
                      )}
                    </div>
                    <p class="mt-1 text-xs text-gray-600 dark:text-gray-300">
                      {usage.get(item.id)
                        ? `Warning: currently used in ${usage.get(item.id)} kit${usage.get(item.id) === 1 ? "" : "s"}.`
                        : "Not currently used in any kit."}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Layout>
  );
}
