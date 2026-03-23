import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../components/Layout.tsx";
import FirstAidCheckWizard, {
  type FirstAidCheckItem,
} from "../../islands/FirstAidCheckWizard.tsx";
import type { Session } from "../../lib/auth.ts";
import { getAllFirstAidCatalogItems, getAllFirstAidKits } from "../../db/kv.ts";

interface FirstAidCheckPageData {
  items: FirstAidCheckItem[];
  kitCount: number;
  session: Session;
  selectedKitName?: string;
  checkScope: "overall" | "kit";
}

export const handler: Handlers<FirstAidCheckPageData> = {
  async GET(req, ctx) {
    const session = ctx.state.session as Session;
    const [kits, catalog] = await Promise.all([
      getAllFirstAidKits(),
      getAllFirstAidCatalogItems(),
    ]);

    const url = new URL(req.url);
    const selectedKitId = url.searchParams.get("kit")?.trim();
    const filteredKits = selectedKitId
      ? kits.filter((kit) => kit.id === selectedKitId)
      : kits;

    const sectionByItemId = new Map(
      catalog.map((item) => [item.id, item.section]),
    );

    const items: FirstAidCheckItem[] = filteredKits
      .flatMap((kit) =>
        kit.entries.map((entry) => ({
          kitId: kit.id,
          kitName: kit.name,
          itemId: entry.itemId,
          itemName: entry.name,
          section: sectionByItemId.get(entry.itemId) ?? "General",
          quantityTarget: entry.quantityTarget,
        }))
      )
      .sort((a, b) =>
        a.kitName.localeCompare(b.kitName, undefined, { numeric: true }) ||
        a.section.localeCompare(b.section, undefined, { numeric: true }) ||
        a.itemName.localeCompare(b.itemName, undefined, { numeric: true })
      );

    return ctx.render({
      items,
      kitCount: new Set(items.map((item) => item.kitId)).size,
      session,
      selectedKitName: filteredKits.length === 1
        ? filteredKits[0].name
        : undefined,
      checkScope: selectedKitId ? "kit" : "overall",
    });
  },
};

export default function FirstAidCheckPage(
  { data }: PageProps<FirstAidCheckPageData>,
) {
  return (
    <Layout
      title="First Aid Check"
      username={data.session.username}
      role={data.session.role}
    >
      <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p class="text-gray-600 dark:text-gray-400">
            Work through each configured kit item and confirm whether the kit is
            up to spec.
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-500 mt-1">
            {data.selectedKitName
              ? `${data.selectedKitName} check`
              : "All kits check"} with
            <strong class="text-gray-600 dark:text-gray-400">
              {data.items.length} item{data.items.length === 1 ? "" : "s"}
            </strong>
            <span>across</span>
            <strong class="text-gray-600 dark:text-gray-400">
              {data.kitCount} kit{data.kitCount === 1 ? "" : "s"}
            </strong>.
          </p>
        </div>

        <a
          href="/first-aid"
          class="self-start shrink-0 text-sm text-purple-600 dark:text-purple-400 hover:underline"
        >
          ← Back to First Aid
        </a>
      </div>

      {data.items.length === 0
        ? (
          <div class="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
            <p class="text-gray-500 dark:text-gray-400">
              No configured kit items found for this check.
            </p>
            <a
              href="/first-aid"
              class="mt-3 inline-block text-purple-600 dark:text-purple-400 hover:underline text-sm"
            >
              Configure kits first →
            </a>
          </div>
        )
        : (
          <FirstAidCheckWizard
            items={data.items}
            csrfToken={data.session.csrfToken}
            checkScope={data.checkScope}
          />
        )}
    </Layout>
  );
}
