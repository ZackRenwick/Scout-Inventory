// API route for dashboard statistics
import { Handlers } from "$fresh/server.ts";
import { getComputedStats, getFoodItemsSortedByExpiry } from "../../db/kv.ts";
import { getDaysUntil } from "../../lib/date-utils.ts";

interface Stats {
  totalItems: number;
  totalQuantity: number;
  categoryBreakdown: {
    tent: { count: number; quantity: number };
    cooking: { count: number; quantity: number };
    food: { count: number; quantity: number };
    "camping-tools": { count: number; quantity: number };
  };
  lowStockItems: number;
  needsRepairItems: number;
  expiringFood: {
    expired: number;
    expiringSoon: number; // Within 7 days
    expiringWarning: number; // Within 30 days
  };
}

export const handler: Handlers = {
  async GET(_req) {
    try {
      // getComputedStats is O(1) — reads a single precomputed KV entry.
      // getFoodItemsSortedByExpiry uses the expiry index — O(n_food).
      const [computed, foodItems] = await Promise.all([
        getComputedStats(),
        getFoodItemsSortedByExpiry(),
      ]);

      const expiringFood = { expired: 0, expiringSoon: 0, expiringWarning: 0 };
      for (const item of foodItems) {
        const d = getDaysUntil(item.expiryDate);
        if (d < 0)       expiringFood.expired++;
        else if (d <= 7)  expiringFood.expiringSoon++;
        else if (d <= 30) expiringFood.expiringWarning++;
      }

      const stats: Stats = {
        totalItems:        computed.totalItems,
        totalQuantity:     computed.totalQuantity,
        categoryBreakdown: {
          tent:            computed.categoryBreakdown.tent,
          cooking:         computed.categoryBreakdown.cooking,
          food:            computed.categoryBreakdown.food,
          "camping-tools": computed.categoryBreakdown["camping-tools"],
        },
        lowStockItems:    computed.lowStockItems,
        needsRepairItems: computed.needsRepairItems,
        expiringFood,
      };

      return Response.json(stats);
    } catch (_error) {
      return Response.json({ error: "Failed to fetch stats" }, { status: 500 });
    }
  },
};
