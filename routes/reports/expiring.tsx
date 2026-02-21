// Expiring food report page
import { Handlers, PageProps } from "$fresh/server.ts";
import type { InventoryItem, FoodItem } from "../../types/inventory.ts";
import { isFoodItem } from "../../types/inventory.ts";
import { getDaysUntil } from "../../lib/date-utils.ts";
import Layout from "../../components/Layout.tsx";
import ExpiryBadge from "../../components/ExpiryBadge.tsx";
import type { Session } from "../../lib/auth.ts";
import { getAllItems } from "../../db/kv.ts";

interface ExpiringFoodData {
  expired: FoodItem[];
  expiringSoon: FoodItem[];
  expiringWarning: FoodItem[];
  fresh: FoodItem[];
  session?: Session;
}

export const handler: Handlers<ExpiringFoodData> = {
  async GET(_req, ctx) {
    try {
      const items = await getAllItems();

      const expired: FoodItem[] = [];
      const expiringSoon: FoodItem[] = [];
      const expiringWarning: FoodItem[] = [];
      const fresh: FoodItem[] = [];

      items.forEach((item) => {
        if (isFoodItem(item)) {
          
          const daysUntil = getDaysUntil(item.expiryDate);
          
          if (daysUntil < 0) {
            expired.push(item);
          } else if (daysUntil <= 7) {
            expiringSoon.push(item);
          } else if (daysUntil <= 30) {
            expiringWarning.push(item);
          } else {
            fresh.push(item);
          }
        }
      });
      
      // Sort by expiry date (soonest first)
      const sortByExpiry = (a: FoodItem, b: FoodItem) => 
        a.expiryDate.getTime() - b.expiryDate.getTime();
      
      expired.sort(sortByExpiry);
      expiringSoon.sort(sortByExpiry);
      expiringWarning.sort(sortByExpiry);
      fresh.sort(sortByExpiry);
      
      return ctx.render({ expired, expiringSoon, expiringWarning, fresh, session: ctx.state.session as Session });
    } catch (error) {
      console.error("Failed to fetch food items:", error);
      return ctx.render({ expired: [], expiringSoon: [], expiringWarning: [], fresh: [], session: ctx.state.session as Session });
    }
  },
};

function FoodItemCard({ item }: { item: FoodItem }) {
  const days = getDaysUntil(item.expiryDate);
  const accent = days < 0 ? "border-l-red-500" : days <= 7 ? "border-l-orange-500" : "border-l-yellow-500";
  return (
    <div class={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 border-l-4 ${accent} shadow-sm`}>
      <div class="flex items-start justify-between px-4 pt-4 pb-2">
        <div class="min-w-0">
          <div class="font-semibold text-gray-900 dark:text-gray-100">{item.name}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 capitalize mt-0.5">{item.foodType}</div>
        </div>
        <div class="shrink-0 ml-3">
          <ExpiryBadge expiryDate={item.expiryDate} />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 px-4 pb-3 text-sm">
        <div>
          <span class="text-xs text-gray-500 dark:text-gray-400 block">Quantity</span>
          <span class="font-medium text-gray-900 dark:text-gray-100">{item.quantity}</span>
        </div>
        <div>
          <span class="text-xs text-gray-500 dark:text-gray-400 block">Location</span>
          <span class="text-gray-900 dark:text-gray-100 truncate block">{item.location}</span>
        </div>
      </div>
      <div class="flex items-center px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg text-sm">
        <a href={`/inventory/${item.id}`} class="font-medium text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200">
          View Details →
        </a>
      </div>
    </div>
  );
}

function FoodItemRow({ item }: { item: FoodItem }) {
  return (
    <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
      <td class="px-6 py-4">
        <div class="font-medium text-gray-900 dark:text-gray-100">{item.name}</div>
        <div class="text-sm text-gray-500 dark:text-gray-400 capitalize">{item.foodType}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-gray-100">
        {item.quantity}
      </td>
      <td class="px-6 py-4 text-gray-900 dark:text-gray-100">
        {item.location}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <ExpiryBadge expiryDate={item.expiryDate} />
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">
        <a
          href={`/inventory/${item.id}`}
          class="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-200"
        >
          View Details
        </a>
      </td>
    </tr>
  );
}

function FoodSection({
  items,
  headerBg,
  headerBorder,
  headerText,
  subText,
  tableBg,
  title,
  description,
}: {
  items: FoodItem[];
  headerBg: string;
  headerBorder: string;
  headerText: string;
  subText: string;
  tableBg: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div class={`${headerBg} border-l-4 ${headerBorder} p-4 mb-4`}>
        <h2 class={`text-xl font-bold ${headerText}`}>{title} ({items.length})</h2>
        <p class={`text-sm mt-1 ${subText}`}>{description}</p>
      </div>
      {/* Mobile cards */}
      <div class="block lg:hidden space-y-3">
        {items.map((item) => <FoodItemCard key={item.id} item={item} />)}
      </div>
      {/* Desktop table */}
      <div class="hidden lg:block bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class={tableBg}>
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Item</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quantity</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Location</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {items.map((item) => <FoodItemRow key={item.id} item={item} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ExpiringFoodPage({ data }: PageProps<ExpiringFoodData>) {
  const totalItems = data.expired.length + data.expiringSoon.length + data.expiringWarning.length + data.fresh.length;
  
  return (
    <Layout title="Expiring Food Report" username={data.session?.username} role={data.session?.role}>
      <div class="mb-6">
        <p class="text-gray-600 dark:text-gray-400">Monitor food items approaching their expiry dates</p>
      </div>
      
      {totalItems === 0 ? (
        <div class="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
          <span class="text-6xl mb-4 block">🥫</span>
          <p class="text-gray-700 dark:text-gray-300 text-lg font-medium">No food items in inventory</p>
          <p class="text-gray-500 dark:text-gray-400 mt-2">Add food items to start tracking expiry dates.</p>
        </div>
      ) : (
        <div class="space-y-8">
          {data.expired.length > 0 && (
            <FoodSection
              items={data.expired}
              title="❌ Expired Items"
              description="These items should be removed from inventory"
              headerBg="bg-red-100 dark:bg-red-900/40"
              headerBorder="border-red-500"
              headerText="text-red-800 dark:text-red-100"
              subText="text-red-700 dark:text-red-300"
              tableBg="bg-red-50 dark:bg-red-950/40"
            />
          )}
          {data.expiringSoon.length > 0 && (
            <FoodSection
              items={data.expiringSoon}
              title="🔴 Expiring Soon"
              description="Use within 7 days"
              headerBg="bg-orange-100 dark:bg-orange-900/40"
              headerBorder="border-orange-500"
              headerText="text-orange-800 dark:text-orange-100"
              subText="text-orange-700 dark:text-orange-300"
              tableBg="bg-orange-50 dark:bg-orange-950/40"
            />
          )}
          {data.expiringWarning.length > 0 && (
            <FoodSection
              items={data.expiringWarning}
              title="🟡 Expiring Within 30 Days"
              description="Plan to use these items soon"
              headerBg="bg-yellow-100 dark:bg-yellow-900/40"
              headerBorder="border-yellow-500"
              headerText="text-yellow-800 dark:text-yellow-100"
              subText="text-yellow-700 dark:text-yellow-300"
              tableBg="bg-yellow-50 dark:bg-yellow-950/40"
            />
          )}
          {data.fresh.length > 0 && (
            <FoodSection
              items={data.fresh}
              title="✅ Fresh"
              description="More than 30 days until expiry"
              headerBg="bg-green-100 dark:bg-green-900/40"
              headerBorder="border-green-500"
              headerText="text-green-800 dark:text-green-100"
              subText="text-green-700 dark:text-green-300"
              tableBg="bg-green-50 dark:bg-green-950/40"
            />
          )}
        </div>
      )}
    </Layout>
  );
}
