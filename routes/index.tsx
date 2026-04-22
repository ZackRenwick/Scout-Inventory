// Dashboard - Overview of inventory statistics
import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../components/Layout.tsx";
import StatCard from "../components/StatCard.tsx";
import NeckerCounter from "../islands/NeckerCounter.tsx";
import NeckerAlert from "../islands/NeckerAlert.tsx";
import type { Session } from "../lib/auth.ts";
import {
  getActiveCheckOuts,
  getAllFirstAidKitIds,
  getAllItems,
  getAllRiskAssessments,
  rebuildComputedStats,
  getComputedStats,
  getFirstAidKitCheckStates,
  getFirstAidOverallCheckState,
  getFoodItemsSortedByExpiry,
} from "../db/kv.ts";
import { getDaysUntil } from "../lib/date-utils.ts";
import { getRecentActivity, type ActivityEntry } from "../lib/activityLog.ts";

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
    itemsAtCamp: number;
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
  recentActivity: ActivityEntry[];
  session?: Session;
}

export const handler: Handlers<DashboardData> = {
  async GET(_req, ctx) {
    try {
      const session = ctx.state.session as Session;
      const canViewInspections = session.role === "manager" ||
        session.role === "admin";

      const isAdmin = session.role === "admin";

      await rebuildComputedStats();

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
        recentActivity,
      ] = await Promise.all([
        getComputedStats(),
        getFoodItemsSortedByExpiry(),
        getActiveCheckOuts(),
        canViewInspections ? getAllItems() : Promise.resolve([]),
        getAllFirstAidKitIds(),
        getFirstAidOverallCheckState(),
        getFirstAidKitCheckStates(),
        getAllRiskAssessments(),
        isAdmin ? getRecentActivity(10) : Promise.resolve([]),
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
        itemsAtCamp: computed.itemsAtCampCount ?? 0,
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
        recentActivity,
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
          itemsAtCamp: 0,
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
        recentActivity: [],
      });
    }
  },
};

function actionIcon(action: string): string {
  if (action.includes("easter_egg")) return "🍋";
  if (action.includes("login")) return "🔑";
  if (action.includes("logout")) return "🚪";
  if (action.includes("deleted") || action.includes("delete")) return "🗑️";
  if (action.includes("created") || action.includes("imported")) return "✨";
  if (action.includes("updated") || action.includes("password")) return "✏️";
  if (action.includes("camp")) return "🏕️";
  if (action.includes("loan")) return "📤";
  if (action.includes("neckers")) return "🧣";
  if (action.includes("first_aid")) return "🩹";
  if (action.includes("risk")) return "📝";
  if (action.includes("stocktake")) return "📋";
  if (action.includes("meal")) return "🍽️";
  return "📌";
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Home({ data }: PageProps<DashboardData>) {
  const { stats, session, neckerThreshold, firstAid, riskAssessments, recentActivity } = data;
  const canViewInspections = session?.role === "manager" ||
    session?.role === "admin";
  const canViewNeckers = session?.role === "manager" ||
    session?.role === "admin";
  const canViewFirstAidAndRisk = session?.role !== "explorer";
  const inspectionTotal = stats.inspections.overdue + stats.inspections.dueSoon;
  const hasExpiredFoodIssue = stats.expiringFood.expired > 0;
  const hasExpiringSoonIssue = stats.expiringFood.expiringSoon > 0;
  const hasExpiringWarningIssue = stats.expiringFood.expiringWarning > 0;
  const hasLowStockIssue = stats.lowStockItems > 0;
  const hasNeedsRepairIssue = stats.needsRepairItems > 0;
  const hasInspectionDueIssue = canViewInspections && inspectionTotal > 0;
  const hasFirstAidDue = canViewFirstAidAndRisk &&
    (firstAid.overallDue || firstAid.dueKitCount > 0);
  const hasRiskAssessmentDue = canViewFirstAidAndRisk &&
    riskAssessments.annualDueCount > 0;
  const hasComplianceIssues = hasExpiredFoodIssue || hasExpiringSoonIssue ||
    hasExpiringWarningIssue || hasLowStockIssue || hasNeedsRepairIssue ||
    hasInspectionDueIssue || hasFirstAidDue || hasRiskAssessmentDue;

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

      {/* Dynamic necker low-stock alert (client-side, updates with NeckerCounter) */}
      <NeckerAlert minThreshold={neckerThreshold} />

      {/* Quick Actions */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-8">
        <h2 class="text-xl font-bold text-gray-800 dark:text-purple-100 mb-3">
          Quick Actions
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-8 gap-2 md:gap-2">
          <a
            href="/inventory/add"
            class="inline-flex items-center justify-center gap-2 px-3 md:px-2 lg:px-3 py-2.5 min-h-11 bg-green-700 text-white rounded-md hover:bg-green-800 transition-colors text-sm md:text-xs lg:text-sm font-medium"
          >
            <span class="md:hidden lg:inline">➕</span>
            <span>Add Item</span>
          </a>
          <a
            href="/inventory"
            class="inline-flex items-center justify-center gap-2 px-3 md:px-2 lg:px-3 py-2.5 min-h-11 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm md:text-xs lg:text-sm font-medium"
          >
            <span class="md:hidden lg:inline">📋</span>
            <span>View All</span>
          </a>
          <a
            href="/reports/expiring"
            class="inline-flex items-center justify-center gap-2 px-3 md:px-2 lg:px-3 py-2.5 min-h-11 bg-orange-700 text-white rounded-md hover:bg-orange-800 transition-colors text-sm md:text-xs lg:text-sm font-medium"
          >
            <span class="md:hidden lg:inline">⏰</span>
            <span>Expiring Food</span>
          </a>
          <a
            href="/inventory?lowstock=true"
            class="inline-flex items-center justify-center gap-2 px-3 md:px-2 lg:px-3 py-2.5 min-h-11 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm md:text-xs lg:text-sm font-medium"
          >
            <span class="md:hidden lg:inline">⚠️</span>
            <span>Low Stock</span>
          </a>
          <a
            href="/inventory?needsrepair=true"
            class="inline-flex items-center justify-center gap-2 px-3 md:px-2 lg:px-3 py-2.5 min-h-11 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-600 transition-colors text-sm md:text-xs lg:text-sm font-medium"
          >
            <span class="md:hidden lg:inline">🔧</span>
            <span>Needs Repair</span>
          </a>
          {canViewNeckers && (
            <a
              href="/neckers"
              class="inline-flex items-center justify-center gap-2 px-3 md:px-2 lg:px-3 py-2.5 min-h-11 bg-purple-700 text-white rounded-md hover:bg-purple-800 transition-colors text-sm md:text-xs lg:text-sm font-medium"
            >
              <span class="md:hidden lg:inline">🧣</span>
              <span>Neckers</span>
            </a>
          )}
          <a
            href="/first-aid"
            class="inline-flex items-center justify-center gap-2 px-3 md:px-2 lg:px-3 py-2.5 min-h-11 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm md:text-xs lg:text-sm font-medium"
          >
            <span class="md:hidden lg:inline">🩹</span>
            <span>First Aid</span>
          </a>
          <a
            href="/risk-assessments"
            class="col-span-1 inline-flex items-center justify-center gap-2 px-3 md:px-2 lg:px-3 py-2.5 min-h-11 bg-red-700 text-white rounded-md hover:bg-red-800 transition-colors text-sm md:text-xs lg:text-sm font-medium"
          >
            <span class="md:hidden lg:inline">📝</span>
            <span class="text-center leading-tight">Risk Assessments</span>
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
              {hasExpiringSoonIssue && (
                <a
                  href="/reports/expiring"
                  class="block hover:shadow-lg transition-shadow"
                >
                  <StatCard
                    title="Expiring Soon"
                    value={stats.expiringFood.expiringSoon}
                    icon="⏰"
                    color="red"
                    subtitle="Within 7 days"
                  />
                </a>
              )}
              {hasExpiringWarningIssue && (
                <a
                  href="/reports/expiring"
                  class="block hover:shadow-lg transition-shadow"
                >
                  <StatCard
                    title="Expiring (30d)"
                    value={stats.expiringFood.expiringWarning}
                    icon="⏳"
                    color="yellow"
                    subtitle="Within 30 days"
                  />
                </a>
              )}
              {hasFirstAidDue && (
                <a
                  href="/first-aid"
                  class="block hover:shadow-lg transition-shadow"
                >
                  <StatCard
                    title="First Aid Due"
                    value={firstAid.dueKitCount + (firstAid.overallDue ? 1 : 0)}
                    icon="🩹"
                    color="red"
                    subtitle={firstAid.overallDue
                      ? "Incl. overall check"
                      : "Kit checks pending"}
                  />
                </a>
              )}
              {hasRiskAssessmentDue && (
                <a
                  href="/risk-assessments"
                  class="block hover:shadow-lg transition-shadow"
                >
                  <StatCard
                    title="Risk Review Due"
                    value={riskAssessments.annualDueCount}
                    icon="📝"
                    color="red"
                    subtitle="Annual reviews due"
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
                  ? "blue"
                  : "green"}
                subtitle={stats.overdueLoans > 0
                  ? `${stats.overdueLoans} overdue`
                  : "Items out on loan"}
              />
            </a>
            {stats.itemsAtCamp > 0 && (
              <a
                href="/inventory?atcamp=true"
                class="block hover:shadow-lg transition-shadow"
              >
                <StatCard
                  title="At Camp"
                  value={stats.itemsAtCamp}
                  icon="🏕️"
                  color="blue"
                  subtitle="Items packed for camp"
                />
              </a>
            )}
            <NeckerCounter
              csrfToken={session?.csrfToken ?? ""}
              canIncrease={session?.role !== "viewer"}
              canDecrease={session?.role !== "viewer"}
            />
          </div>
        </div>

        {session?.role === "admin" && recentActivity.length > 0 && (
          <div class="mb-6 space-y-3 sm:space-y-4">
            <div class="flex items-center justify-between pt-1">
              <h2 class="text-lg sm:text-xl font-bold text-gray-800 dark:text-purple-100">
                Recent Activity
              </h2>
              <a
                href="/admin/activity"
                class="text-sm text-purple-600 dark:text-purple-400 hover:underline"
              >
                View all →
              </a>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {recentActivity.map((entry) => (
                <div
                  key={entry.id}
                  class="flex items-start gap-3 px-4 py-3"
                >
                  <span class="shrink-0 text-base mt-0.5">
                    {actionIcon(entry.action)}
                  </span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-gray-800 dark:text-gray-100">
                      <span class="font-medium">{entry.username}</span>
                      {" "}
                      <span class="text-gray-500 dark:text-gray-400">
                        {entry.action.replace(/_/g, " ").replace(/\./g, " › ")}
                      </span>
                      {entry.resource && (
                        <span class="text-gray-700 dark:text-gray-200">
                          {" — "}{entry.resource}
                        </span>
                      )}
                    </p>
                    {entry.details && (
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {entry.details}
                      </p>
                    )}
                  </div>
                  <span class="shrink-0 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap mt-0.5">
                    {timeAgo(entry.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
