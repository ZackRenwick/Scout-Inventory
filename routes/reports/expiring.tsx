// Expiring food report page
import { Handlers, PageProps } from "$fresh/server.ts";
import type { InventoryItem, FoodItem } from "../../types/inventory.ts";
import { isFoodItem } from "../../types/inventory.ts";
import { getDaysUntil } from "../../lib/date-utils.ts";
import Layout from "../../components/Layout.tsx";
import ExpiryBadge from "../../components/ExpiryBadge.tsx";
import type { Session } from "../../lib/auth.ts";

interface ExpiringFoodData {
  expired: FoodItem[];
  expiringSoon: FoodItem[];
  expiringWarning: FoodItem[];
  session?: Session;
}

export const handler: Handlers<ExpiringFoodData> = {
  async GET(_req, ctx) {
    try {
      const response = await fetch(`http://localhost:8000/api/items?category=food`);
      const items: InventoryItem[] = await response.json();
      
      // Convert date strings and categorize
      const expired: FoodItem[] = [];
      const expiringSoon: FoodItem[] = [];
      const expiringWarning: FoodItem[] = [];
      
      // deno-lint-ignore no-explicit-any
      items.forEach((item: any) => {
        if (isFoodItem(item)) {
          const foodItem: FoodItem = {
            ...item,
            addedDate: new Date(item.addedDate),
            lastUpdated: new Date(item.lastUpdated),
            expiryDate: new Date(item.expiryDate),
          };
          
          const daysUntil = getDaysUntil(foodItem.expiryDate);
          
          if (daysUntil < 0) {
            expired.push(foodItem);
          } else if (daysUntil <= 7) {
            expiringSoon.push(foodItem);
          } else if (daysUntil <= 30) {
            expiringWarning.push(foodItem);
          }
        }
      });
      
      // Sort by expiry date (soonest first)
      const sortByExpiry = (a: FoodItem, b: FoodItem) => 
        a.expiryDate.getTime() - b.expiryDate.getTime();
      
      expired.sort(sortByExpiry);
      expiringSoon.sort(sortByExpiry);
      expiringWarning.sort(sortByExpiry);
      
      return ctx.render({ expired, expiringSoon, expiringWarning, session: ctx.state.session as Session });
    } catch (error) {
      console.error("Failed to fetch food items:", error);
      return ctx.render({ expired: [], expiringSoon: [], expiringWarning: [], session: ctx.state.session as Session });
    }
  },
};

function FoodItemRow({ item }: { item: FoodItem }) {
  return (
    <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
      <td class="px-6 py-4">
        <div class="font-medium text-gray-900 dark:text-gray-100">{item.name}</div>
        <div class="text-sm text-gray-500 dark:text-gray-400">{item.foodType}</div>
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

export default function ExpiringFoodPage({ data }: PageProps<ExpiringFoodData>) {
  const totalItems = data.expired.length + data.expiringSoon.length + data.expiringWarning.length;
  
  return (
    <Layout title="Expiring Food Report" username={data.session?.username} role={data.session?.role}>
      <div class="mb-6">
        <p class="text-gray-600 dark:text-gray-400">Monitor food items approaching their expiry dates</p>
      </div>
      
      {totalItems === 0 ? (
        <div class="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg p-8 text-center">
          <span class="text-6xl mb-4 block">✅</span>
          <p class="text-green-700 dark:text-green-300 text-lg font-medium">All food items are fresh!</p>
          <p class="text-green-600 dark:text-green-400 mt-2">No items are expiring in the next 30 days.</p>
        </div>
      ) : (
        <div class="space-y-8">
          {/* Expired Items */}
          {data.expired.length > 0 && (
            <div>
              <div class="bg-red-100 border-l-4 border-red-500 p-4 mb-4">
                <h2 class="text-xl font-bold text-red-800">
                  ❌ Expired Items ({data.expired.length})
                </h2>
                <p class="text-red-700 text-sm mt-1">These items should be removed from inventory</p>
              </div>
              <div class="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-red-50 dark:bg-red-950/40">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Item</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quantity</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Location</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {data.expired.map(item => <FoodItemRow key={item.id} item={item} />)}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Expiring Soon (≤ 7 days) */}
          {data.expiringSoon.length > 0 && (
            <div>
              <div class="bg-orange-100 border-l-4 border-orange-500 p-4 mb-4">
                <h2 class="text-xl font-bold text-orange-800">
                  🔴 Expiring Soon ({data.expiringSoon.length})
                </h2>
                <p class="text-orange-700 text-sm mt-1">Use within 7 days</p>
              </div>
              <div class="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-orange-50 dark:bg-orange-950/40">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Item</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quantity</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Location</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {data.expiringSoon.map(item => <FoodItemRow key={item.id} item={item} />)}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Expiring Warning (8-30 days) */}
          {data.expiringWarning.length > 0 && (
            <div>
              <div class="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-4">
                <h2 class="text-xl font-bold text-yellow-800">
                  🟡 Expiring Within 30 Days ({data.expiringWarning.length})
                </h2>
                <p class="text-yellow-700 text-sm mt-1">Plan to use these items soon</p>
              </div>
              <div class="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-yellow-50 dark:bg-yellow-950/40">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Item</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quantity</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Location</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {data.expiringWarning.map(item => <FoodItemRow key={item.id} item={item} />)}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
