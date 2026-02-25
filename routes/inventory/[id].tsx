// Individual item details page
import { Handlers, PageProps } from "$fresh/server.ts";
import type { InventoryItem, TentItem, CookingEquipment, FoodItem, GamesItem } from "../../types/inventory.ts";
import { isTentItem, isCookingEquipment, isFoodItem, isGamesItem } from "../../types/inventory.ts";
import Layout from "../../components/Layout.tsx";
import ExpiryBadge from "../../components/ExpiryBadge.tsx";
import CategoryIcon from "../../components/CategoryIcon.tsx";
import { formatDate } from "../../lib/date-utils.ts";
import type { Session } from "../../lib/auth.ts";
import { getItemById } from "../../db/kv.ts";

interface ItemDetailData {
  item: InventoryItem | null;
  session?: Session;
}

export const handler: Handlers<ItemDetailData> = {
  async GET(_req, ctx) {
    const { id } = ctx.params;
    
    try {
      const item = await getItemById(id);
      if (!item) {
        return ctx.render({ item: null, session: ctx.state.session as Session });
      }
      return ctx.render({ item, session: ctx.state.session as Session });
    } catch (error) {
      console.error("Failed to fetch item:", error);
      return ctx.render({ item: null, session: ctx.state.session as Session });
    }
  },
};

export default function ItemDetailPage({ data }: PageProps<ItemDetailData>) {
  if (!data.item) {
    return (
      <Layout title="Item Not Found" username={data.session?.username} role={data.session?.role}>
        <div class="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <p class="text-red-700 text-lg">Item not found</p>
          <a href="/inventory" class="mt-4 inline-block text-red-600 hover:text-red-800 underline">
            ← Back to Inventory
          </a>
        </div>
      </Layout>
    );
  }
  
  const item = data.item;
  const isLowStock = item.quantity <= item.minThreshold;
  
  return (
    <Layout title={item.name} username={data.session?.username} role={data.session?.role}>
      <div class="mb-6">
        <a href="/inventory" class="text-purple-600 dark:text-purple-400 hover:text-purple-800">
          ← Back to Inventory
        </a>
      </div>
      
      <div class="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-5 sm:p-8">
        {/* Header */}
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div class="flex items-center space-x-3">
            <CategoryIcon category={item.category} size="lg" />
            <div>
              <h1 class="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">{item.name}</h1>
              <p class="text-gray-600 dark:text-gray-400 capitalize">{item.category}</p>
            </div>
          </div>
          <div class="flex gap-3 shrink-0">
            {data.session?.role !== "viewer" && (
            <a
              href={`/inventory/edit/${item.id}`}
              class="px-4 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700"
            >
              ✏️ Edit
            </a>
            )}
            {data.session?.role === "admin" && (
            <a
              href={`/inventory/${item.id}/qr`}
              target="_blank"
              rel="noopener noreferrer"
              class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              🖨️ QR Label
            </a>
            )}
          </div>
        </div>
        
        {/* Alerts */}
        {isLowStock && (
          <div class="mb-6 bg-red-50 dark:bg-red-950/50 border-l-4 border-red-500 p-4">
            <p class="text-red-700 dark:text-red-300 font-medium">
              ⚠️ Low Stock Alert - Only {item.quantity} remaining (minimum: {item.minThreshold})
            </p>
          </div>
        )}
        
        {isFoodItem(item) && (
          <div class="mb-6">
            <ExpiryBadge expiryDate={item.expiryDate} />
          </div>
        )}
        
        {/* Common Details */}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
          <div>
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">Quantity</h3>
            <p class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{item.quantity}</p>
          </div>
          <div>
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">Minimum Threshold</h3>
            <p class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{item.minThreshold}</p>
          </div>
          <div>
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">Location</h3>
            <p class="mt-1 text-lg text-gray-900 dark:text-gray-100">{item.location}</p>
          </div>
          <div>
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">Added Date</h3>
            <p class="mt-1 text-lg text-gray-900 dark:text-gray-100">{formatDate(item.addedDate)}</p>
          </div>
        </div>
        
        {/* Category-specific Details */}
        {isTentItem(item) && (
          <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
            <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Tent Details</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Type</h3>
                <p class="mt-1 text-gray-900 dark:text-gray-100 capitalize">{item.tentType}</p>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Capacity</h3>
                <p class="mt-1 text-gray-900 dark:text-gray-100">{item.capacity} people</p>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Size</h3>
                <p class="mt-1 text-gray-900 dark:text-gray-100">{item.size}</p>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Condition</h3>
                <p class="mt-1 text-gray-900 dark:text-gray-100 capitalize">{item.condition}</p>
              </div>
              {item.brand && (
                <div>
                  <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Brand</h3>
                  <p class="mt-1 text-gray-900 dark:text-gray-100">{item.brand}</p>
                </div>
              )}
              {item.yearPurchased && (
                <div>
                  <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Year Purchased</h3>
                  <p class="mt-1 text-gray-900 dark:text-gray-100">{item.yearPurchased}</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {isCookingEquipment(item) && (
          <div class="mt-6 p-4 bg-orange-50 dark:bg-orange-950/40 rounded-lg">
            <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Cooking Equipment Details</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Equipment Type</h3>
                <p class="mt-1 text-gray-900 dark:text-gray-100 capitalize">{item.equipmentType === "water-container" ? "Water Container" : item.equipmentType === "box" ? "Box / Kit" : item.equipmentType.replace('-', ' ')}</p>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Condition</h3>
                <p class="mt-1 text-gray-900 dark:text-gray-100 capitalize">{item.condition}</p>
              </div>
              {item.material && (
                <div>
                  <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Material</h3>
                  <p class="mt-1 text-gray-900 dark:text-gray-100">{item.material}</p>
                </div>
              )}
              {item.fuelType && (
                <div>
                  <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Fuel Type</h3>
                  <p class="mt-1 text-gray-900 dark:text-gray-100">{item.fuelType}</p>
                </div>
              )}
              {item.capacity && (
                <div>
                  <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Capacity</h3>
                  <p class="mt-1 text-gray-900 dark:text-gray-100">{item.capacity}</p>
                </div>
              )}
            </div>
            {item.contents && item.contents.length > 0 && (
              <div class="mt-4 pt-4 border-t border-orange-200 dark:border-orange-700">
                <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase mb-3">Box Contents</h3>
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-orange-200 dark:border-orange-700">
                      <th class="text-left py-1.5 pr-4 font-medium text-gray-600 dark:text-gray-300">Item</th>
                      <th class="text-right py-1.5 font-medium text-gray-600 dark:text-gray-300">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.contents.map((c, i) => (
                      <tr key={i} class="border-b border-orange-100 dark:border-orange-900/40 last:border-0">
                        <td class="py-1.5 pr-4 text-gray-900 dark:text-gray-100">{c.name}</td>
                        <td class="py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">{c.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr class="border-t border-orange-200 dark:border-orange-700">
                      <td class="py-1.5 pr-4 text-xs text-gray-500 dark:text-gray-400">Total items</td>
                      <td class="py-1.5 text-right font-semibold text-gray-700 dark:text-gray-200">
                        {item.contents.reduce((sum, c) => sum + c.quantity, 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
        
        {isFoodItem(item) && (
          <div class="mt-6 p-4 bg-green-50 dark:bg-green-950/40 rounded-lg">
            <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Food Details</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Food Type</h3>
                <p class="mt-1 text-gray-900 dark:text-gray-100 capitalize">{item.foodType}</p>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Expiry Date</h3>
                <p class="mt-1 text-gray-900 dark:text-gray-100 font-bold">{formatDate(item.expiryDate)}</p>
              </div>
              {item.storageRequirements && (
                <div>
                  <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Storage Requirements</h3>
                  <p class="mt-1 text-gray-900 dark:text-gray-100 capitalize">{item.storageRequirements.replace(/-/g, ' ')}</p>
                </div>
              )}
              {item.weight && (
                <div>
                  <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Weight</h3>
                  <p class="mt-1 text-gray-900 dark:text-gray-100">{item.weight}</p>
                </div>
              )}
              {item.servings && (
                <div>
                  <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Servings</h3>
                  <p class="mt-1 text-gray-900 dark:text-gray-100">{item.servings}</p>
                </div>
              )}
              {item.allergens && item.allergens.length > 0 && (
                <div>
                  <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Allergens</h3>
                  <p class="mt-1 text-gray-900 dark:text-gray-100">{item.allergens.join(", ")}</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {isGamesItem(item) && (
          <div class="mt-6 p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg">
            <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Games Details</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Game Type</h3>
                <p class="mt-1 text-gray-900 dark:text-gray-100 capitalize">{item.gameType.replace(/-/g, ' ')}</p>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Condition</h3>
                <p class="mt-1 text-gray-900 dark:text-gray-100 capitalize">{item.condition}</p>
              </div>
              {item.playerCount && (
                <div>
                  <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Player Count</h3>
                  <p class="mt-1 text-gray-900 dark:text-gray-100">{item.playerCount}</p>
                </div>
              )}
              {item.yearPurchased && (
                <div>
                  <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Year Purchased</h3>
                  <p class="mt-1 text-gray-900 dark:text-gray-100">{item.yearPurchased}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {item.notes && (
          <div class="mt-6">
          <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Notes</h2>
          <p class="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-4 rounded">{item.notes}</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
