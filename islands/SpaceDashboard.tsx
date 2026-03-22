// Interactive space switcher for the dashboard category breakdown
import { useSignal } from "@preact/signals";
import { getCategoryEmoji, getCategoryLabel } from "../types/inventory.ts";

interface CategoryBreakdown {
  tent: { count: number; quantity: number };
  cooking: { count: number; quantity: number };
  food: { count: number; quantity: number };
  fuel: { count: number; quantity: number };
  "camping-tools": { count: number; quantity: number };
  games: { count: number; quantity: number };
}

interface SpaceBreakdown {
  "camp-store": { count: number; quantity: number };
  "scout-post-loft": { count: number; quantity: number };
  "gas-storage-box": { count: number; quantity: number };
}

interface SpaceDashboardProps {
  categoryBreakdown: CategoryBreakdown;
  spaceBreakdown: SpaceBreakdown;
  expiringFood: { expired: number; expiringSoon: number; expiringWarning: number };
}

type Space = "all" | "camp-store" | "scout-post-loft" | "gas-storage-box";

function CategoryCard({ title, value, color, href }: { title: string; value: number; color: string; href: string }) {
  // Top-border accent + neutral card background — works in both light and dark mode
  // without relying on dynamically-constructed dark: classes that Tailwind JIT can miss
  const accentMap: Record<string, string> = {
    blue:   "border-t-4 border-blue-500",
    green:  "border-t-4 border-green-500",
    yellow: "border-t-4 border-yellow-500",
    red:    "border-t-4 border-red-500",
    purple: "border-t-4 border-purple-500",
    indigo: "border-t-4 border-indigo-500",
    orange: "border-t-4 border-orange-500",
  };
  return (
    <a
      href={href}
      class="block rounded-lg hover:shadow-lg transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500"
    >
      <div class={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 h-full ${accentMap[color] ?? accentMap.blue}`}>
        <p class="text-sm font-semibold text-gray-600 dark:text-gray-300">{title}</p>
        <p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
        <p class="text-xs text-gray-400 dark:text-gray-400 mt-1">units</p>
      </div>
    </a>
  );
}

export default function SpaceDashboard({ categoryBreakdown: c, spaceBreakdown: sb, expiringFood }: SpaceDashboardProps) {
  const space = useSignal<Space>("all");
  const campStore = sb["camp-store"] ?? { count: 0, quantity: 0 };
  const scoutPostLoft = sb["scout-post-loft"] ?? { count: 0, quantity: 0 };
  const gasStorageBox = sb["gas-storage-box"] ?? { count: 0, quantity: 0 };

  const totalCount = campStore.count + scoutPostLoft.count + gasStorageBox.count;
  const totalQty   = campStore.quantity + scoutPostLoft.quantity + gasStorageBox.quantity;

  const spaces: { value: Space; icon: string; label: string; count: number; qty: number; activeClass: string }[] = [
    {
      value: "all",
      icon: "📦",
      label: "All Spaces",
      count: totalCount,
      qty: totalQty,
      activeClass: "border-purple-500 bg-purple-50 dark:bg-purple-800 ring-2 ring-purple-400",
    },
    {
      value: "camp-store",
      icon: "🏪",
      label: "Camp Store",
      count: campStore.count,
      qty: campStore.quantity,
      activeClass: "border-blue-500 bg-blue-50 dark:bg-blue-800 ring-2 ring-blue-400",
    },
    {
      value: "scout-post-loft",
      icon: "🏠",
      label: "Scout Post Loft",
      count: scoutPostLoft.count,
      qty: scoutPostLoft.quantity,
      activeClass: "border-indigo-500 bg-indigo-50 dark:bg-indigo-800 ring-2 ring-indigo-400",
    },
    {
      value: "gas-storage-box",
      icon: "🛢️",
      label: "Gas Storage Box",
      count: gasStorageBox.count,
      qty: gasStorageBox.quantity,
      activeClass: "border-orange-500 bg-orange-50 dark:bg-orange-900/40 ring-2 ring-orange-400",
    },
  ];

  return (
    <div class="mb-8">
      <h2 class="text-2xl font-bold text-gray-800 dark:text-purple-100 mb-4">Inventory by Space</h2>

      {/* Space selector cards */}
      <div role="group" aria-label="Filter by space" class="flex gap-4 mb-8">
        {spaces.map((s) => {
          const isActive = space.value === s.value;
          return (
            <button
              key={s.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => space.value = s.value}
              class={`flex-1 text-left rounded-xl p-4 border-2 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 ${
                isActive
                  ? s.activeClass
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-500"
              }`}
            >
              <div class="text-3xl mb-2" aria-hidden="true">{s.icon}</div>
              <div class={`font-semibold text-base ${
                isActive ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-200"
              }`}>{s.label}</div>
              <div class="text-sm text-gray-500 dark:text-gray-300 mt-1">
                {s.count} item{s.count !== 1 ? "s" : ""} &middot; {s.qty} units
              </div>
              {isActive && (
                <div class="mt-2 text-xs font-medium text-purple-600 dark:text-purple-300" aria-hidden="true">▼ Viewing below</div>
              )}
            </button>
          );
        })}
      </div>

      <div class="flex flex-col gap-10">

      {/* Camp Store categories */}
      {(space.value === "all" || space.value === "camp-store") && (
        <div>
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">🏪 Camp Store — Categories</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CategoryCard title={`${getCategoryEmoji("tent")} ${getCategoryLabel("tent")}`} value={c.tent.quantity} color="blue" href="/inventory?category=tent" />
            <CategoryCard title={`${getCategoryEmoji("cooking")} ${getCategoryLabel("cooking")}`} value={c.cooking.quantity} color="purple" href="/inventory?category=cooking" />
            <CategoryCard title={`${getCategoryEmoji("food")} ${getCategoryLabel("food")}`} value={c.food.quantity} color="green" href="/inventory?category=food" />
            <CategoryCard title={`${getCategoryEmoji("camping-tools")} ${getCategoryLabel("camping-tools")}`} value={c["camping-tools"].quantity} color="yellow" href="/inventory?category=camping-tools" />
          </div>
        </div>
      )}

      {/* Food Expiry — Camp Store only */}
      {(space.value === "all" || space.value === "camp-store") &&
        (expiringFood.expired + expiringFood.expiringSoon + expiringFood.expiringWarning) > 0 && (
        <div>
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">🏪 Camp Store — Food Expiry</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            {expiringFood.expired > 0 && (
              <a href="/reports/expiring" class="block rounded-lg hover:shadow-lg transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500">
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-t-4 border-red-500 rounded-lg p-5">
                  <p class="text-sm font-semibold text-gray-600 dark:text-gray-300">❌ Expired</p>
                  <p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{expiringFood.expired}</p>
                  <p class="text-xs text-gray-400 dark:text-gray-400 mt-1">Remove from inventory</p>
                </div>
              </a>
            )}
            {expiringFood.expiringSoon > 0 && (
              <a href="/reports/expiring" class="block rounded-lg hover:shadow-lg transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500">
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-t-4 border-orange-500 rounded-lg p-5">
                  <p class="text-sm font-semibold text-gray-600 dark:text-gray-300">🔴 Expiring Soon</p>
                  <p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{expiringFood.expiringSoon}</p>
                  <p class="text-xs text-gray-400 dark:text-gray-400 mt-1">Within 7 days</p>
                </div>
              </a>
            )}
            {expiringFood.expiringWarning > 0 && (
              <a href="/reports/expiring" class="block rounded-lg hover:shadow-lg transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500">
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-t-4 border-yellow-500 rounded-lg p-5">
                  <p class="text-sm font-semibold text-gray-600 dark:text-gray-300">🟡 Expiring Warning</p>
                  <p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{expiringFood.expiringWarning}</p>
                  <p class="text-xs text-gray-400 dark:text-gray-400 mt-1">Within 30 days</p>
                </div>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Scout Post Loft categories */}
      {(space.value === "all" || space.value === "scout-post-loft") && (
        <div>
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">🏠 Scout Post Loft — Categories</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CategoryCard title="⚽ Games" value={c.games.quantity} color="indigo" href="/inventory?category=games" />
          </div>
        </div>
      )}

      {/* Gas Storage summary */}
      {(space.value === "all" || space.value === "gas-storage-box") && (
        <div>
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">🛢️ Gas Storage Box</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CategoryCard title={`${getCategoryEmoji("fuel")} ${getCategoryLabel("fuel")}`} value={c.fuel.quantity} color="orange" href="/inventory?category=fuel" />
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
