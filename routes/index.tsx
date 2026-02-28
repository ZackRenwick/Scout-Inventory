// Dashboard - Overview of inventory statistics
import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../components/Layout.tsx";
import StatCard from "../components/StatCard.tsx";
import SpaceDashboard from "../islands/SpaceDashboard.tsx";
import NeckerCounter from "../islands/NeckerCounter.tsx";
import NeckerAlert from "../islands/NeckerAlert.tsx";
import type { Session } from "../lib/auth.ts";
import { getComputedStats, getFoodItemsSortedByExpiry, getActiveCheckOuts } from "../db/kv.ts";
import { getDaysUntil } from "../lib/date-utils.ts";

interface DashboardData {
  neckerThreshold: number;
  stats: {
    totalItems: number;
    totalQuantity: number;
    categoryBreakdown: {
      tent: { count: number; quantity: number };
      cooking: { count: number; quantity: number };
      food: { count: number; quantity: number };
      "camping-tools": { count: number; quantity: number };
      games: { count: number; quantity: number };
    };
    spaceBreakdown: {
      "camp-store": { count: number; quantity: number };
      "scout-post-loft": { count: number; quantity: number };
    };
    lowStockItems: number;
    needsRepairItems: number;
    activeLoans: number;
    overdueLoans: number;
    expiringFood: {
      expired: number;
      expiringSoon: number;
      expiringWarning: number;
    };
  };
  session?: Session;
}

export const handler: Handlers<DashboardData> = {
  async GET(_req, ctx) {
    try {
      // getComputedStats is O(1). getFoodItemsSortedByExpiry is O(n_food).
      // getActiveCheckOuts is cache-backed after the first request.
      // All three run concurrently.
      const [computed, foodItems, activeLoansData] = await Promise.all([
        getComputedStats(),
        getFoodItemsSortedByExpiry(),
        getActiveCheckOuts(),
      ]);

      const expiringFood = { expired: 0, expiringSoon: 0, expiringWarning: 0 };
      for (const item of foodItems) {
        const d = getDaysUntil(item.expiryDate);
        if (d < 0)       expiringFood.expired++;
        else if (d <= 7)  expiringFood.expiringSoon++;
        else if (d <= 30) expiringFood.expiringWarning++;
      }

      // activeLoansCount comes from precomputed stats (O(1) KV read, already fetched above).
      // overdueLoans is time-based so must be computed at request time, but the
      // checkout list is served from the in-memory cache.
      const now = new Date();
      const overdueLoans = activeLoansData.filter(
        (l) => new Date(l.expectedReturnDate) < now,
      ).length;

      const stats: DashboardData["stats"] = {
        totalItems:        computed.totalItems,
        totalQuantity:     computed.totalQuantity,
        categoryBreakdown: computed.categoryBreakdown,
        spaceBreakdown:    computed.spaceBreakdown,
        lowStockItems:     computed.lowStockItems,
        needsRepairItems:  computed.needsRepairItems,
        activeLoans:       computed.activeLoansCount ?? activeLoansData.length,
        overdueLoans,
        expiringFood,
      };
      const neckerThreshold = parseInt(Deno.env.get("NECKER_MIN_THRESHOLD") ?? "10", 10);
      return ctx.render({ stats, session: ctx.state.session as Session, neckerThreshold });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      // Return empty stats on error
      return ctx.render({
        stats: {
          totalItems: 0,
          totalQuantity: 0,
          categoryBreakdown: {
            tent: { count: 0, quantity: 0 },
            cooking: { count: 0, quantity: 0 },
            food: { count: 0, quantity: 0 },
            "camping-tools": { count: 0, quantity: 0 },
            games: { count: 0, quantity: 0 },
          },
          spaceBreakdown: {
            "camp-store": { count: 0, quantity: 0 },
            "scout-post-loft": { count: 0, quantity: 0 },
          },
          lowStockItems: 0,
          needsRepairItems: 0,
          activeLoans: 0,
          overdueLoans: 0,
          expiringFood: { expired: 0, expiringSoon: 0, expiringWarning: 0 },
        },
        session: ctx.state.session as Session,
        neckerThreshold: parseInt(Deno.env.get("NECKER_MIN_THRESHOLD") ?? "10", 10),
      });
    }
  },
};

export default function Home({ data }: PageProps<DashboardData>) {
  const { stats, session, neckerThreshold } = data;
  const totalAlerts = stats.lowStockItems + stats.expiringFood.expired + stats.expiringFood.expiringSoon + stats.expiringFood.expiringWarning + stats.needsRepairItems;
  
  return (
    <Layout username={session?.username} role={session?.role}>
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-gray-800 dark:text-purple-100 mb-2">📊 Dashboard</h1>
        <p class="text-gray-600 dark:text-gray-400">Overview of your scout inventory</p>
      </div>

      {/* Alert Banner */}
      {totalAlerts > 0 && (
        <div class="bg-red-100 dark:bg-red-900/60 border-l-4 border-red-600 dark:border-red-400 p-4 mb-8">
          <div class="flex">
            <div class="flex-shrink-0">
              <span class="text-2xl">⚠️</span>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-red-900 dark:text-red-100">
                Attention Required Soon
              </h3>
              <div class="mt-2 text-sm text-red-800 dark:text-red-200">
                <ul class="list-disc list-inside space-y-1">
                  {stats.lowStockItems > 0 && (
                    <li><a href="/inventory?lowstock=true" class="underline hover:text-red-900 dark:hover:text-red-50">{stats.lowStockItems} item{stats.lowStockItems !== 1 ? 's' : ''} running low on stock</a></li>
                  )}
                  {stats.expiringFood.expired > 0 && (
                    <li><a href="/reports/expiring" class="underline hover:text-red-900 dark:hover:text-red-50">{stats.expiringFood.expired} food item{stats.expiringFood.expired !== 1 ? 's' : ''} expired</a></li>
                  )}
                  {stats.expiringFood.expiringSoon > 0 && (
                    <li><a href="/reports/expiring" class="underline hover:text-red-900 dark:hover:text-red-50">{stats.expiringFood.expiringSoon} food item{stats.expiringFood.expiringSoon !== 1 ? 's' : ''} expiring within 7 days</a></li>
                  )}
                  {stats.expiringFood.expiringWarning > 0 && (
                    <li><a href="/reports/expiring" class="underline hover:text-red-900 dark:hover:text-red-50">{stats.expiringFood.expiringWarning} food item{stats.expiringFood.expiringWarning !== 1 ? 's' : ''} expiring within 30 days</a></li>
                  )}
                  {stats.needsRepairItems > 0 && (
                    <li><a href="/inventory?needsrepair=true" class="underline hover:text-red-900 dark:hover:text-red-50">{stats.needsRepairItems} item{stats.needsRepairItems !== 1 ? 's' : ''} need repair</a></li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic necker low-stock alert (client-side, updates with NeckerCounter) */}
      <NeckerAlert minThreshold={neckerThreshold} />

      {/* Quick Actions */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <h2 class="text-2xl font-bold text-gray-800 dark:text-purple-100 mb-4">Quick Actions</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <a
            href="/inventory/add"
            class="flex items-center justify-center p-4 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors"
          >
            <span class="text-xl mr-2">➕</span>
            <span class="font-medium">Add Item</span>
          </a>
          <a
            href="/inventory"
            class="flex items-center justify-center p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span class="text-xl mr-2">📋</span>
            <span class="font-medium">View All</span>
          </a>
          <a
            href="/reports/expiring"
            class="flex items-center justify-center p-4 bg-orange-700 text-white rounded-lg hover:bg-orange-800 transition-colors"
          >
            <span class="text-xl mr-2">⏰</span>
            <span class="font-medium">Expiring Food</span>
          </a>
          <a
            href="/inventory?lowstock=true"
            class="flex items-center justify-center p-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <span class="text-xl mr-2">⚠️</span>
            <span class="font-medium">Low Stock</span>
          </a>
          <a
            href="/inventory?needsrepair=true"
            class="flex items-center justify-center p-4 bg-yellow-500 text-gray-900 rounded-lg hover:bg-yellow-600 transition-colors"
          >
            <span class="text-xl mr-2">🔧</span>
            <span class="font-medium">Needs Repair</span>
          </a>
        </div>
      </div>
      
      {/* Overview Stats */}
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-8">
        <a href="/reports/expiring" class="block hover:shadow-lg transition-shadow">
          <StatCard
            title="Expired Food"
            value={stats.expiringFood.expired}
            icon="🚫"
            color={stats.expiringFood.expired > 0 ? "red" : "green"}
            subtitle="Remove from stock"
          />
        </a>
        <a href="/reports/expiring" class="block hover:shadow-lg transition-shadow">
          <StatCard
            title="Expiring Soon"
            value={stats.expiringFood.expiringSoon}
            icon="⏰"
            color={stats.expiringFood.expiringSoon > 0 ? "yellow" : "green"}
            subtitle="Within 7 days"
          />
        </a>
        <a href="/inventory?lowstock=true" class="block hover:shadow-lg transition-shadow">
          <StatCard
            title="Low Stock"
            value={stats.lowStockItems}
            icon="⚠️"
            color={stats.lowStockItems > 0 ? "red" : "green"}
            subtitle="Need restocking"
          />
        </a>
        <a href="/inventory?onloan=true" class="block hover:shadow-lg transition-shadow">
          <StatCard
            title="Active Loans"
            value={stats.activeLoans}
            icon="📤"
            color={stats.overdueLoans > 0 ? "red" : stats.activeLoans > 0 ? "yellow" : "green"}
            subtitle={stats.overdueLoans > 0 ? `${stats.overdueLoans} overdue` : "Items out on loan"}
          />
        </a>
        <a href="/inventory?needsrepair=true" class="block hover:shadow-lg transition-shadow">
          <StatCard
            title="Needs Repair"
            value={stats.needsRepairItems}
            icon="🔧"
            color={stats.needsRepairItems > 0 ? "yellow" : "green"}
            subtitle="Items flagged for repair"
          />
        </a>
        <NeckerCounter
          csrfToken={session?.csrfToken ?? ""}
          canEdit={session?.role !== "viewer"}
        />
      </div>

      <SpaceDashboard categoryBreakdown={stats.categoryBreakdown} spaceBreakdown={stats.spaceBreakdown} expiringFood={stats.expiringFood} />
      
    </Layout>
  );
}
