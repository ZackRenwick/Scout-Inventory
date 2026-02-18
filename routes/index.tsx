// Dashboard - Overview of inventory statistics
import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../components/Layout.tsx";
import StatCard from "../components/StatCard.tsx";
import type { Session } from "../lib/auth.ts";

interface DashboardData {
  stats: {
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
      expiringSoon: number;
      expiringWarning: number;
    };
  };
  session?: Session;
}

export const handler: Handlers<DashboardData> = {
  async GET(_req, ctx) {
    try {
      const response = await fetch(`http://localhost:8000/api/stats`);
      const stats = await response.json();
      
      return ctx.render({ stats, session: ctx.state.session as Session });
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
          },
          lowStockItems: 0,
          expiringFood: { expired: 0, expiringSoon: 0, expiringWarning: 0 },
        },
        session: ctx.state.session as Session,
      });
    }
  },
};

export default function Home({ data }: PageProps<DashboardData>) {
  const { stats, session } = data;
  const totalAlerts = stats.lowStockItems + stats.expiringFood.expired + stats.expiringFood.expiringSoon;
  
  return (
    <Layout username={session?.username} role={session?.role}>
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-gray-800 dark:text-purple-100 mb-2">📊 Dashboard</h1>
        <p class="text-gray-600 dark:text-gray-400">Overview of your camp loft inventory</p>
      </div>

      {/* Alert Banner */}
      {totalAlerts > 0 && (
        <div class="bg-red-50 dark:bg-red-900/60 border-l-4 border-red-500 dark:border-red-400 p-4 mb-8">
          <div class="flex">
            <div class="flex-shrink-0">
              <span class="text-2xl">⚠️</span>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-red-800 dark:text-red-100">
                Attention Required
              </h3>
              <div class="mt-2 text-sm text-red-700 dark:text-red-200">
                <ul class="list-disc list-inside space-y-1">
                  {stats.lowStockItems > 0 && (
                    <li>{stats.lowStockItems} item{stats.lowStockItems !== 1 ? 's' : ''} running low on stock</li>
                  )}
                  {stats.expiringFood.expired > 0 && (
                    <li>{stats.expiringFood.expired} food item{stats.expiringFood.expired !== 1 ? 's' : ''} expired</li>
                  )}
                  {stats.expiringFood.expiringSoon > 0 && (
                    <li>{stats.expiringFood.expiringSoon} food item{stats.expiringFood.expiringSoon !== 1 ? 's' : ''} expiring within 7 days</li>
                  )}
                </ul>
              </div>
              <div class="mt-3">
                <a href="/reports/expiring" class="text-sm font-medium text-red-800 dark:text-red-100 hover:text-red-900 dark:hover:text-red-50 underline">
                  View expiring food →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <h2 class="text-2xl font-bold text-gray-800 dark:text-purple-100 mb-4">Quick Actions</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a
            href="/inventory/add"
            class="flex items-center justify-center p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
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
            class="flex items-center justify-center p-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
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
        </div>
      </div>
      
      {/* Overview Stats */}
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Items"
          value={stats.totalItems}
          icon="📦"
          color="blue"
          subtitle="Unique items"
        />
        <StatCard
          title="Total Quantity"
          value={stats.totalQuantity}
          icon="🔢"
          color="green"
          subtitle="Individual units"
        />
        <StatCard
          title="Low Stock"
          value={stats.lowStockItems}
          icon="⚠️"
          color={stats.lowStockItems > 0 ? "red" : "green"}
          subtitle="Need restocking"
        />
        <StatCard
          title="Expiring Soon"
          value={stats.expiringFood.expiringSoon + stats.expiringFood.expired}
          icon="⏰"
          color={stats.expiringFood.expiringSoon + stats.expiringFood.expired > 0 ? "yellow" : "green"}
          subtitle="Food items"
        />
      </div>
      
      {/* Category Breakdown */}
      <div class="mb-8">
        <h2 class="text-2xl font-bold text-gray-800 dark:text-purple-100 mb-4">Inventory by Category</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <a href="/inventory?category=tent" class="block hover:shadow-lg transition-shadow">
            <StatCard
              title="⛺ Tents"
              value={stats.categoryBreakdown.tent.count}
              color="blue"
              subtitle={`${stats.categoryBreakdown.tent.quantity} total units`}
            />
          </a>
          <a href="/inventory?category=cooking" class="block hover:shadow-lg transition-shadow">
            <StatCard
              title="🍳 Cooking Equipment"
              value={stats.categoryBreakdown.cooking.count}
              color="purple"
              subtitle={`${stats.categoryBreakdown.cooking.quantity} total units`}
            />
          </a>
          <a href="/inventory?category=food" class="block hover:shadow-lg transition-shadow">
            <StatCard
              title="🥫 Food Items"
              value={stats.categoryBreakdown.food.count}
              color="green"
              subtitle={`${stats.categoryBreakdown.food.quantity} total units`}
            />
          </a>
          <a href="/inventory?category=camping-tools" class="block hover:shadow-lg transition-shadow">
            <StatCard
              title="🪓 Camping Tools"
              value={stats.categoryBreakdown["camping-tools"].count}
              color="yellow"
              subtitle={`${stats.categoryBreakdown["camping-tools"].quantity} total units`}
            />
          </a>
        </div>
      </div>
      
      {/* Expiry Status Breakdown */}
      {(stats.expiringFood.expired + stats.expiringFood.expiringSoon + stats.expiringFood.expiringWarning) > 0 && (
        <div class="mb-8">
          <h2 class="text-2xl font-bold text-gray-800 dark:text-purple-100 mb-4">Food Expiry Status</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="Expired"
              value={stats.expiringFood.expired}
              icon="❌"
              color="red"
              subtitle="Remove from inventory"
            />
            <StatCard
              title="Expiring Soon"
              value={stats.expiringFood.expiringSoon}
              icon="🔴"
              color="yellow"
              subtitle="Within 7 days"
            />
            <StatCard
              title="Expiring Warning"
              value={stats.expiringFood.expiringWarning}
              icon="🟡"
              color="yellow"
              subtitle="Within 30 days"
            />
          </div>
        </div>
      )}
    </Layout>
  );
}
