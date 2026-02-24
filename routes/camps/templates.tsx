// Camp equipment templates management page
import { Handlers, PageProps } from "$fresh/server.ts";
import type { CampTemplate, InventoryItem } from "../../types/inventory.ts";
import Layout from "../../components/Layout.tsx";
import type { Session } from "../../lib/auth.ts";
import { getAllCampTemplates, deleteCampTemplate, getAllItems } from "../../db/kv.ts";
import TemplateBuilder from "../../islands/TemplateBuilder.tsx";

interface TemplatesPageData {
  templates: CampTemplate[];
  allItems: InventoryItem[];
  session?: Session;
  flash?: string;
}

export const handler: Handlers<TemplatesPageData> = {
  async GET(_req, ctx) {
    const [templates, allItems] = await Promise.all([getAllCampTemplates(), getAllItems()]);
    return ctx.render({ templates, allItems, session: ctx.state.session as Session });
  },

  async POST(req, ctx) {
    const session = ctx.state.session as Session;
    if (!session || session.role !== "admin") {
      return new Response("Forbidden", { status: 403 });
    }
    const form = await req.formData();
    const action = form.get("action")?.toString();
    const csrfFromForm = form.get("_csrf")?.toString();
    if (csrfFromForm !== session.csrfToken) {
      return new Response("Invalid CSRF token", { status: 403 });
    }
    if (action === "delete") {
      const id = form.get("id")?.toString();
      if (id) await deleteCampTemplate(id);
    }
    return new Response(null, { status: 303, headers: { Location: "/camps/templates" } });
  },
};

export default function CampTemplatesPage({ data }: PageProps<TemplatesPageData>) {
  const isAdmin = data.session?.role === "admin";
  const csrfToken = data.session?.csrfToken ?? "";

  return (
    <Layout title="Camp Equipment Templates" username={data.session?.username} role={data.session?.role}>
      <div class="mb-6">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">📋 Equipment Templates</h1>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Reusable equipment lists that can be imported into any camp plan.
              Create manually below, or open a camp plan and use "📋 Save as template".
            </p>
          </div>
          <a
            href="/camps"
            class="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            ← Back to Camps
          </a>
        </div>
      </div>

      {(data.session?.role === "editor" || data.session?.role === "admin") && (
        <TemplateBuilder allItems={data.allItems} csrfToken={data.session?.csrfToken ?? ""} />
      )}

      {data.templates.length === 0 ? (
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p class="text-gray-500 dark:text-gray-400 text-sm">
            No templates yet. Use "➕ New Template" above to create one, or open a camp plan
            and use "📋 Save as template".
          </p>
        </div>
      ) : (
        <div class="space-y-4">
          {data.templates.map((tpl) => (
            <div
              key={tpl.id}
              class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-5"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <h2 class="text-base font-semibold text-gray-900 dark:text-white">{tpl.name}</h2>
                  {tpl.description && (
                    <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{tpl.description}</p>
                  )}
                  <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    {tpl.items.length} item{tpl.items.length !== 1 ? "s" : ""} ·
                    Created by {tpl.createdBy} ·
                    {new Date(tpl.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                {isAdmin && (
                  <form
                    method="POST"
                    action="/camps/templates"
                    onSubmit={(e) => {
                      if (!confirm(`Delete template "${tpl.name}"? This cannot be undone.`)) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="action" value="delete" />
                    <input type="hidden" name="id" value={tpl.id} />
                    <input type="hidden" name="_csrf" value={csrfToken} />
                    <button
                      type="submit"
                      class="text-sm px-3 py-1.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    >
                      🗑 Delete
                    </button>
                  </form>
                )}
              </div>

              {tpl.items.length > 0 && (
                <details class="mt-3">
                  <summary class="cursor-pointer text-xs text-purple-600 dark:text-purple-400 hover:underline select-none">
                    View {tpl.items.length} item{tpl.items.length !== 1 ? "s" : ""}
                  </summary>
                  <div class="mt-2 border border-gray-100 dark:border-gray-700 rounded-md divide-y divide-gray-100 dark:divide-gray-700 max-h-64 overflow-y-auto">
                    {tpl.items.map((item) => (
                      <div key={item.itemId} class="px-3 py-2 flex justify-between items-center text-sm">
                        <span class="font-medium text-gray-800 dark:text-gray-100">{item.itemName}</span>
                        <span class="text-gray-500 dark:text-gray-400 text-xs ml-2 shrink-0">
                          {item.itemCategory} · {item.itemLocation} · qty: {item.quantityPlanned}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
