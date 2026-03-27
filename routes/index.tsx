// Dashboard - Overview of inventory statistics
import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../components/Layout.tsx";
import StatCard from "../components/StatCard.tsx";
import SpaceDashboard from "../islands/SpaceDashboard.tsx";
import NeckerCounter from "../islands/NeckerCounter.tsx";
import NeckerAlert from "../islands/NeckerAlert.tsx";
import type { Session } from "../lib/auth.ts";
import {
  getActiveCheckOuts,
  getAllFirstAidKitIds,
  getAllItems,
  getAllRiskAssessments,
  getComputedStats,
  getFirstAidKitCheckStates,
  getFirstAidOverallCheckState,
  getFoodItemsSortedByExpiry,
} from "../db/kv.ts";
import { getDaysUntil } from "../lib/date-utils.ts";

const YEARLY_CHECK_DAYS = 365;

function isDismissed(dismissedUntil: Date | null | undefined): boolean {
  return !!dismissedUntil && dismissedUntil.getTime() > Date.now();
}

function addOneCalendarMonth(from: Date): Date {
  const next = new Date(from);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + 1);
  const daysInTargetMonth = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0,
  ).getDate();
  next.setDate(Math.min(day, daysInTargetMonth));
  return next;
}

function isMonthlyDue(lastCheckedAt: Date | null | undefined): boolean {
  if (!lastCheckedAt) return true;
  return Date.now() >= addOneCalendarMonth(lastCheckedAt).getTime();
}

function isYearlyDue(lastCheckedAt: Date | null | undefined): boolean {
  if (!lastCheckedAt) return true;
  const ageMs = Date.now() - lastCheckedAt.getTime();
  return ageMs >= YEARLY_CHECK_DAYS * 24 * 60 * 60 * 1000;
}

interface DashboardData {
  neckerThreshold: number;
  stats: {
    totalItems: number;
    totalQuantity: number;
    categoryBreakdown: {
      tent: { count: number; quantity: number };
      cooking: { count: number; quantity: number };
      food: { count: number; quantity: number };
      fuel: { count: number; quantity: number };
      "camping-tools": { count: number; quantity: number };
      games: { count: number; quantity: number };
      kit: { count: number; quantity: number };
    };
    spaceBreakdown: {
      "camp-store": { count: number; quantity: number };
      "scout-post-loft": { count: number; quantity: number };
      "gas-storage-box": { count: number; quantity: number };
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
    inspections: {
      dueSoon: number;
      overdue: number;
    };
  };
  firstAid: {
    overallDue: boolean;
    dueKitCount: number;
  };
  riskAssessments: {
    annualDueCount: number;
  };
  session?: Session;
}

export const handler: Handlers<DashboardData> = {
  async GET(_req, ctx) {
    try {
      const session = ctx.state.session as Session;
      const canViewInspections = session.role === "manager" ||
        session.role === "admin";

      // getComputedStats is O(1). getFoodItemsSortedByExpiry is O(n_food).
      // getActiveCheckOuts is cache-backed after the first request.
      // getAllItems is only needed for manager inspection stats.
      const [
        computed,
        foodItems,
        activeLoansData,
        allItems,
        firstAidKitIds,
        overallFirstAidCheck,
        firstAidKitStates,
        riskAssessments,
      ] = await Promise.all([
        getComputedStats(),
        getFoodItemsSortedByExpiry(),
        getActiveCheckOuts(),
        canViewInspections ? getAllItems() : Promise.resolve([]),
        getAllFirstAidKitIds(),
        getFirstAidOverallCheckState(),
        getFirstAidKitCheckStates(),
        getAllRiskAssessments(),
      ]);
      const overallFirstAidDue =
        isMonthlyDue(overallFirstAidCheck?.lastCheckedAt) &&
        !isDismissed(overallFirstAidCheck?.dismissedUntil);
      const dueKitCount = firstAidKitIds.filter((kitId) => {
        const kitState = firstAidKitStates[kitId];
        return isMonthlyDue(kitState?.lastCheckedAt) &&
          !isDismissed(kitState?.dismissedUntil);
      }).length;
      const annualRiskDueCount = riskAssessments.filter((assessment) =>
        isYearlyDue(assessment.lastAnnualCheckAt) &&
        !isDismissed(assessment.annualReminderDismissedUntil)
      ).length;

      const expiringFood = { expired: 0, expiringSoon: 0, expiringWarning: 0 };
      for (const item of foodItems) {
        const d = getDaysUntil(item.expiryDate);
        if (d < 0) expiringFood.expired++;
        else if (d <= 7) expiringFood.expiringSoon++;
        else if (d <= 30) expiringFood.expiringWarning++;
      }

      // activeLoansCount comes from precomputed stats (O(1) KV read, already fetched above).
      // overdueLoans is time-based so must be computed at request time, but the
      // checkout list is served from the in-memory cache.
      const now = new Date();
      const overdueLoans = activeLoansData.filter(
        (l) => new Date(l.expectedReturnDate) < now,
      ).length;

      const inspections = { dueSoon: 0, overdue: 0 };
      if (canViewInspections) {
        for (const item of allItems) {
          if (!item.nextInspectionDate) continue;
          const days = getDaysUntil(item.nextInspectionDate);
          if (days < 0) inspections.overdue++;
          else if (days <= 30) inspections.dueSoon++;
        }
      }

      const stats: DashboardData["stats"] = {
        totalItems: computed.totalItems,
        totalQuantity: computed.totalQuantity,
        categoryBreakdown: computed.categoryBreakdown,
        spaceBreakdown: computed.spaceBreakdown,
        lowStockItems: computed.lowStockItems,
        needsRepairItems: computed.needsRepairItems,
        activeLoans: computed.activeLoansCount ?? activeLoansData.length,
        overdueLoans,
        expiringFood,
        inspections,
      };
      const neckerThreshold = parseInt(
        Deno.env.get("NECKER_MIN_THRESHOLD") ?? "10",
        10,
      );
      return ctx.render({
        stats,
        session,
        neckerThreshold,
        firstAid: {
          overallDue: overallFirstAidDue,
          dueKitCount,
        },
        riskAssessments: {
          annualDueCount: annualRiskDueCount,
        },
      });
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
            fuel: { count: 0, quantity: 0 },
            "camping-tools": { count: 0, quantity: 0 },
            games: { count: 0, quantity: 0 },
            kit: { count: 0, quantity: 0 },
          },
          spaceBreakdown: {
            "camp-store": { count: 0, quantity: 0 },
            "scout-post-loft": { count: 0, quantity: 0 },
            "gas-storage-box": { count: 0, quantity: 0 },
          },
          lowStockItems: 0,
          needsRepairItems: 0,
          activeLoans: 0,
          overdueLoans: 0,
          expiringFood: { expired: 0, expiringSoon: 0, expiringWarning: 0 },
          inspections: { dueSoon: 0, overdue: 0 },
        },
        session: ctx.state.session as Session,
        neckerThreshold: parseInt(
          Deno.env.get("NECKER_MIN_THRESHOLD") ?? "10",
          10,
        ),
        firstAid: {
          overallDue: false,
          dueKitCount: 0,
        },
        riskAssessments: {
          annualDueCount: 0,
        },
      });
    }
  },
};

export default function Home({ data }: PageProps<DashboardData>) {
  const { stats, session, neckerThreshold, firstAid, riskAssessments } = data;
  const canViewInspections = session?.role === "manager" ||
    session?.role === "admin";
  const inspectionTotal = stats.inspections.overdue + stats.inspections.dueSoon;
  const hasExpiredFoodIssue = stats.expiringFood.expired > 0;
  const hasLowStockIssue = stats.lowStockItems > 0;
  const hasNeedsRepairIssue = stats.needsRepairItems > 0;
  const hasInspectionDueIssue = canViewInspections && inspectionTotal > 0;
  const hasComplianceIssues = hasExpiredFoodIssue || hasLowStockIssue ||
    hasNeedsRepairIssue || hasInspectionDueIssue;
  const totalAlerts = stats.lowStockItems + stats.expiringFood.expired +
    stats.expiringFood.expiringSoon + stats.expiringFood.expiringWarning +
    stats.needsRepairItems;
  const hasFirstAidDue = firstAid.overallDue || firstAid.dueKitCount > 0;
  const hasRiskAssessmentDue = riskAssessments.annualDueCount > 0;

  return (
    <Layout username={session?.username} role={session?.role}>
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-gray-800 dark:text-purple-100 mb-2">
          📊 Dashboard
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Overview of your scout inventory
        </p>
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
                    <li>
                      <a
                        href="/inventory?lowstock=true"
                        class="underline hover:text-red-900 dark:hover:text-red-50"
                      >
                        {stats.lowStockItems}{" "}
                        item{stats.lowStockItems !== 1 ? "s" : ""}{" "}
                        running low on stock
                      </a>
                    </li>
                  )}
                  {stats.expiringFood.expired > 0 && (
                    <li>
                      <a
                        href="/reports/expiring"
                        class="underline hover:text-red-900 dark:hover:text-red-50"
                      >
                        {stats.expiringFood.expired}{" "}
                        food item{stats.expiringFood.expired !== 1 ? "s" : ""}
                        {" "}
                        expired
                      </a>
                    </li>
                  )}
                  {stats.expiringFood.expiringSoon > 0 && (
                    <li>
                      <a
                        href="/reports/expiring"
                        class="underline hover:text-red-900 dark:hover:text-red-50"
                      >
                        {stats.expiringFood.expiringSoon}{" "}
                        food item{stats.expiringFood.expiringSoon !== 1
                          ? "s"
                          : ""} expiring within 7 days
                      </a>
                    </li>
                  )}
                  {stats.expiringFood.expiringWarning > 0 && (
                    <li>
                      <a
                        href="/reports/expiring"
                        class="underline hover:text-red-900 dark:hover:text-red-50"
                      >
                        {stats.expiringFood.expiringWarning}{" "}
                        food item{stats.expiringFood.expiringWarning !== 1
                          ? "s"
                          : ""} expiring within 30 days
                      </a>
                    </li>
                  )}
                  {stats.needsRepairItems > 0 && (
                    <li>
                      <a
                        href="/inventory?needsrepair=true"
                        class="underline hover:text-red-900 dark:hover:text-red-50"
                      >
                        {stats.needsRepairItems}{" "}
                        item{stats.needsRepairItems !== 1 ? "s" : ""}{" "}
                        need repair
                      </a>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic necker low-stock alert (client-side, updates with NeckerCounter) */}
      <NeckerAlert minThreshold={neckerThreshold} />

      {hasFirstAidDue && (
        <div class="bg-amber-100 dark:bg-amber-900/60 border-l-4 border-amber-500 dark:border-amber-400 p-4 mb-8">
          <div class="flex">
            <div class="flex-shrink-0">
              <span class="text-2xl">🩹</span>
            </div>
            <div class="ml-3">
              <h3 class="text-base font-medium text-amber-900 dark:text-amber-100">
                First Aid Checks Due
              </h3>
              <p class="mt-1 text-sm text-amber-800 dark:text-amber-200">
                {firstAid.overallDue
                  ? "Monthly overall check is due"
                  : "Overall check is up to date"}
                {firstAid.dueKitCount > 0 &&
                  ` · ${firstAid.dueKitCount} kit${
                    firstAid.dueKitCount === 1 ? "" : "s"
                  } due individual checks`}
                .{" "}
                <a
                  href="/first-aid"
                  class="underline hover:text-amber-900 dark:hover:text-amber-50"
                >
                  Open First Aid
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      {hasRiskAssessmentDue && (
        <div class="bg-rose-100 dark:bg-rose-900/60 border-l-4 border-rose-500 dark:border-rose-400 p-4 mb-8">
          <div class="flex">
            <div class="flex-shrink-0">
              <span class="text-2xl">📝</span>
            </div>
            <div class="ml-3">
              <h3 class="text-base font-medium text-rose-900 dark:text-rose-100">
                Risk Assessment Annual Checks Due
              </h3>
              <p class="mt-1 text-sm text-rose-800 dark:text-rose-200">
                {riskAssessments.annualDueCount} assessment
                {riskAssessments.annualDueCount === 1 ? "" : "s"} due annual
                review.{" "}
                <a
                  href="/risk-assessments"
                  class="underline hover:text-rose-900 dark:hover:text-rose-50"
                >
                  Open Risk Assessments
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-8">
        <h2 class="text-xl font-bold text-gray-800 dark:text-purple-100 mb-3">
          Quick Actions
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-8 gap-2 sm:gap-2">
          <a
            href="/inventory/add"
            class="inline-flex items-center justify-center gap-2 px-3 sm:px-2 lg:px-3 py-2.5 min-h-11 bg-green-700 text-white rounded-md hover:bg-green-800 transition-colors text-sm sm:text-xs lg:text-sm font-medium"
          >
            <span class="sm:hidden lg:inline">➕</span>
            <span>Add Item</span>
          </a>
          <a
            href="/inventory"
            class="inline-flex items-center justify-center gap-2 px-3 sm:px-2 lg:px-3 py-2.5 min-h-11 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm sm:text-xs lg:text-sm font-medium"
          >
            <span class="sm:hidden lg:inline">📋</span>
            <span>View All</span>
          </a>
          <a
            href="/reports/expiring"
            class="inline-flex items-center justify-center gap-2 px-3 sm:px-2 lg:px-3 py-2.5 min-h-11 bg-orange-700 text-white rounded-md hover:bg-orange-800 transition-colors text-sm sm:text-xs lg:text-sm font-medium"
          >
            <span class="sm:hidden lg:inline">⏰</span>
            <span>Expiring Food</span>
          </a>
          <a
            href="/inventory?lowstock=true"
            class="inline-flex items-center justify-center gap-2 px-3 sm:px-2 lg:px-3 py-2.5 min-h-11 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm sm:text-xs lg:text-sm font-medium"
          >
            <span class="sm:hidden lg:inline">⚠️</span>
            <span>Low Stock</span>
          </a>
          <a
            href="/inventory?needsrepair=true"
            class="inline-flex items-center justify-center gap-2 px-3 sm:px-2 lg:px-3 py-2.5 min-h-11 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-600 transition-colors text-sm sm:text-xs lg:text-sm font-medium"
          >
            <span class="sm:hidden lg:inline">🔧</span>
            <span>Needs Repair</span>
          </a>
          <a
            href="/neckers"
            class="inline-flex items-center justify-center gap-2 px-3 sm:px-2 lg:px-3 py-2.5 min-h-11 bg-purple-700 text-white rounded-md hover:bg-purple-800 transition-colors text-sm sm:text-xs lg:text-sm font-medium"
          >
            <span class="sm:hidden lg:inline">🧣</span>
            <span>Neckers</span>
          </a>
          <a
            href="/first-aid"
            class="inline-flex items-center justify-center gap-2 px-3 sm:px-2 lg:px-3 py-2.5 min-h-11 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm sm:text-xs lg:text-sm font-medium"
          >
            <span class="sm:hidden lg:inline">🩹</span>
            <span>First Aid</span>
          </a>
          <a
            href="/risk-assessments"
            class="inline-flex items-center justify-center gap-2 px-3 sm:px-2 lg:px-3 py-2.5 min-h-11 bg-rose-700 text-white rounded-md hover:bg-rose-800 transition-colors text-sm sm:text-xs lg:text-sm font-medium"
          >
            <span class="sm:hidden lg:inline">📝</span>
            <span>Risk Assessments</span>
          </a>
        </div>
      </div>

      <div class="w-full">
        {/* Overview Stats */}
        {hasComplianceIssues && (
          <div class="mb-6 space-y-3 sm:space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="text-lg sm:text-xl font-bold text-gray-800 dark:text-purple-100">
                Alerts &amp; Compliance
              </h2>
              <span class="hidden sm:inline text-sm text-gray-500 dark:text-gray-400">
                High-priority checks first
              </span>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5">
              {hasExpiredFoodIssue && (
                <a
                  href="/reports/expiring"
                  class="block hover:shadow-lg transition-shadow"
                >
                  <StatCard
                    title="Expired Food"
                    value={stats.expiringFood.expired}
                    icon="🚫"
                    color="red"
                    subtitle="Remove from stock"
                  />
                </a>
              )}
              {hasLowStockIssue && (
                <a
                  href="/inventory?lowstock=true"
                  class="block hover:shadow-lg transition-shadow"
                >
                  <StatCard
                    title="Low Stock"
                    value={stats.lowStockItems}
                    icon="⚠️"
                    color="red"
                    subtitle="Need restocking"
                  />
                </a>
              )}
              {hasNeedsRepairIssue && (
                <a
                  href="/inventory?needsrepair=true"
                  class="block hover:shadow-lg transition-shadow"
                >
                  <StatCard
                    title="Needs Repair"
                    value={stats.needsRepairItems}
                    icon="🔧"
                    color="yellow"
                    subtitle="Items flagged for repair"
                  />
                </a>
              )}
              {hasInspectionDueIssue && (
                <a
                  href="/inventory"
                  class="block hover:shadow-lg transition-shadow"
                >
                  <StatCard
                    title="Inspections"
                    value={inspectionTotal}
                    icon="🛠️"
                    color={stats.inspections.overdue > 0 ? "red" : "yellow"}
                    subtitle={stats.inspections.overdue > 0
                      ? `${stats.inspections.overdue} overdue`
                      : `${stats.inspections.dueSoon} due in 30d`}
                  />
                </a>
              )}
            </div>
          </div>
        )}

        <div class="mb-6 space-y-3 sm:space-y-4">
          <div class="flex items-center justify-between pt-1">
            <h2 class="text-lg sm:text-xl font-bold text-gray-800 dark:text-purple-100">
              Operations
            </h2>
            <span class="hidden sm:inline text-sm text-gray-500 dark:text-gray-400">
              Live stock movement
            </span>
          </div>
          <div class="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-3.5">
            <a
              href="/inventory?onloan=true"
              class="block hover:shadow-lg transition-shadow"
            >
              <StatCard
                title="Active Loans"
                value={stats.activeLoans}
                icon="📤"
                color={stats.overdueLoans > 0
                  ? "red"
                  : stats.activeLoans > 0
                  ? "yellow"
                  : "green"}
                subtitle={stats.overdueLoans > 0
                  ? `${stats.overdueLoans} overdue`
                  : "Items out on loan"}
              />
            </a>
            <NeckerCounter
              csrfToken={session?.csrfToken ?? ""}
              canIncrease={session?.role !== "viewer"}
              canDecrease={session?.role === "admin" ||
                session?.role === "manager"}
            />
          </div>
        </div>

        <SpaceDashboard
          categoryBreakdown={stats.categoryBreakdown}
          spaceBreakdown={stats.spaceBreakdown}
          expiringFood={stats.expiringFood}
        />
      </div>
    </Layout>
  );
}
