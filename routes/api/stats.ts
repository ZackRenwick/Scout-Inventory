// API route for dashboard statistics
import { Handlers } from "$fresh/server.ts";
import { getAllItems } from "../../db/kv.ts";
import { isFoodItem } from "../../types/inventory.ts";
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
  expiringFood: {
    expired: number;
    expiringSoon: number; // Within 7 days
    expiringWarning: number; // Within 30 days
  };
}

export const handler: Handlers = {
  async GET(_req) {
    try {
      const items = await getAllItems();
      
      const stats: Stats = {
        totalItems: items.length,
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
        categoryBreakdown: {
          tent: { count: 0, quantity: 0 },
          cooking: { count: 0, quantity: 0 },
          food: { count: 0, quantity: 0 },
          "camping-tools": { count: 0, quantity: 0 },
        },
        lowStockItems: 0,
        expiringFood: {
          expired: 0,
          expiringSoon: 0,
          expiringWarning: 0,
        },
      };
      
      // Calculate statistics
      for (const item of items) {
        // Category breakdown
        if (item.category in stats.categoryBreakdown) {
          stats.categoryBreakdown[item.category as keyof typeof stats.categoryBreakdown].count++;
          stats.categoryBreakdown[item.category as keyof typeof stats.categoryBreakdown].quantity += item.quantity;
        }
        
        // Low stock items
        if (item.quantity <= item.minThreshold) {
          stats.lowStockItems++;
        }
        
        // Expiring food
        if (isFoodItem(item)) {
          const daysUntilExpiry = getDaysUntil(item.expiryDate);
          
          if (daysUntilExpiry < 0) {
            stats.expiringFood.expired++;
          } else if (daysUntilExpiry <= 7) {
            stats.expiringFood.expiringSoon++;
          } else if (daysUntilExpiry <= 30) {
            stats.expiringFood.expiringWarning++;
          }
        }
      }
      
      return new Response(JSON.stringify(stats), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (_error) {
      return new Response(JSON.stringify({ error: "Failed to fetch stats" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
