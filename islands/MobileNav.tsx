// Mobile navigation menu toggle
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import ThemeToggle from "./ThemeToggle.tsx";
import FeedbackPendingBadge from "./FeedbackPendingBadge.tsx";
import ComplianceBadge from "./ComplianceBadge.tsx";

interface MobileNavProps {
  username?: string;
  role?: "admin" | "manager" | "editor" | "explorer" | "viewer";
}

// Fetch compliance counts once; shared across the island.
async function fetchComplianceCounts() {
  try {
    const res = await fetch("/api/compliance/counts", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) return { firstAidDue: 0, riskDue: 0, maintenanceDue: 0 };
    return await res.json() as {
      firstAidDue: number;
      riskDue: number;
      maintenanceDue: number;
    };
  } catch {
    return { firstAidDue: 0, riskDue: 0, maintenanceDue: 0 };
  }
}

async function fetchFeedbackCount() {
  try {
    const res = await fetch("/api/feedback/pending-count", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) return 0;
    const body = await res.json();
    return typeof body?.pendingCount === "number" ? body.pendingCount : 0;
  } catch {
    return 0;
  }
}

export default function MobileNav({ username, role }: MobileNavProps) {
  const open = useSignal(false);
  const hamburgerCount = useSignal(0);

  useEffect(() => {
    if (!role || role === "explorer") return;
    let cancelled = false;

    const load = async () => {
      const [compliance, feedback] = await Promise.all([
        fetchComplianceCounts(),
        role === "admin" ? fetchFeedbackCount() : Promise.resolve(0),
      ]);
      if (!cancelled) {
        hamburgerCount.value =
          compliance.firstAidDue + compliance.riskDue + feedback;
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      {/* Hamburger button — only shown on small/tablet screens */}
      <button
        type="button"
        onClick={() => open.value = !open.value}
        class="lg:hidden relative flex items-center px-2 py-1 rounded text-white hover:bg-white/20 transition-colors"
        aria-label="Toggle menu"
      >
        <span class="text-xl">{open.value ? "✕" : "☰"}</span>
        {hamburgerCount.value > 0 && (
          <span class="absolute -top-1 -right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 py-0.5 text-[9px] font-semibold leading-none text-white">
            {hamburgerCount.value}
          </span>
        )}
      </button>

      {/* Desktop nav links — hidden on mobile/tablet */}
      <div class="hidden lg:flex items-center space-x-4">
        <a href="/" class="hover:text-purple-200 transition-colors">
          Dashboard
        </a>
        <a href="/inventory" class="hover:text-purple-200 transition-colors">
          Inventory
        </a>
        <a href="/camps" class="hover:text-purple-200 transition-colors">
          Camp Planning
        </a>
        {role === "admin" && (
          <a href="/meals" class="hover:text-purple-200 transition-colors">
            Meal Planner
          </a>
        )}
        {role !== "explorer" && (
          <a href="/first-aid" class="hover:text-purple-200 transition-colors inline-flex items-center">
            First Aid
            <ComplianceBadge type="first-aid" />
          </a>
        )}
        {role !== "explorer" && (
          <a
            href="/risk-assessments"
            class="hover:text-purple-200 transition-colors inline-flex items-center"
          >
            Risk Assessments
            <ComplianceBadge type="risk" />
          </a>
        )}
        {(role === "admin" || role === "manager") && (
          <a href="/neckers" class="hover:text-purple-200 transition-colors">
            Neckers
          </a>
        )}
        <a href="/loans" class="hover:text-purple-200 transition-colors">
          Loans
        </a>
        {(role === "admin" || role === "manager") && (
          <a
            href="/admin/admin-panel"
            class="hover:text-purple-200 transition-colors inline-flex items-center"
          >
            Admin
            {role === "admin" && <FeedbackPendingBadge />}
          </a>
        )}
        <a
          href="/account/feedback"
          class="hover:text-purple-200 transition-colors"
        >
          💡 Feedback
        </a>
        <ThemeToggle />
        {username && (
          <div class="flex items-center space-x-2 border-l border-purple-500 pl-4">
            <a
              href="/account/settings"
              class="text-sm text-purple-200 hover:text-white transition-colors"
            >
              👤 {username}
            </a>
            <form method="POST" action="/api/logout">
              <button
                type="submit"
                class="text-sm text-purple-300 hover:text-white underline transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Mobile dropdown */}
      {open.value && (
        <div class="lg:hidden absolute top-full left-0 right-0 bg-purple-900 dark:bg-purple-950 shadow-lg z-50 py-2">
          <a
            href="/"
            class="block px-6 py-3 hover:bg-purple-800 transition-colors"
          >
            🏠 Dashboard
          </a>
          <a
            href="/inventory"
            class="block px-6 py-3 hover:bg-purple-800 transition-colors"
          >
            📋 Inventory
          </a>
          <a
            href="/camps"
            class="block px-6 py-3 hover:bg-purple-800 transition-colors"
          >
            🏕️ Camp Planning
          </a>
          {role === "admin" && (
            <a
              href="/meals"
              class="block px-6 py-3 hover:bg-purple-800 transition-colors"
            >
              🍽️ Meal Planner
            </a>
          )}
          {role !== "explorer" && (
            <a
              href="/first-aid"
              class="flex items-center gap-2 px-6 py-3 hover:bg-purple-800 transition-colors"
            >
              <span>🩹 First Aid</span>
              <ComplianceBadge type="first-aid" className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white" />
            </a>
          )}
          {role !== "explorer" && (
            <a
              href="/risk-assessments"
              class="flex items-center gap-2 px-6 py-3 hover:bg-purple-800 transition-colors"
            >
              <span>📝 Risk Assessments</span>
              <ComplianceBadge type="risk" className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white" />
            </a>
          )}
          {(role === "admin" || role === "manager") && (
            <a
              href="/neckers"
              class="block px-6 py-3 hover:bg-purple-800 transition-colors"
            >
              🧣 Neckers
            </a>
          )}
          <a
            href="/loans"
            class="block px-6 py-3 hover:bg-purple-800 transition-colors"
          >
            📤 Loans
          </a>
          {(role === "admin" || role === "manager") && (
            <a
              href="/admin/admin-panel"
              class="px-6 py-3 hover:bg-purple-800 transition-colors inline-flex items-center gap-2"
            >
              <span>⚙️ Admin</span>
              {role === "admin" && (
                <FeedbackPendingBadge className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white" />
              )}
            </a>
          )}
          <a
            href="/account/feedback"
            class="block px-6 py-3 hover:bg-purple-800 transition-colors"
          >
            💡 Feedback
          </a>
          {username && (
            <div class="border-t border-purple-700 mt-1">
              <a
                href="/account/settings"
                class="block px-6 py-3 text-sm hover:bg-purple-800 transition-colors"
              >
                ⚙️ Account Settings ({username})
              </a>
              <form method="POST" action="/api/logout" class="px-6 pb-3">
                <button
                  type="submit"
                  class="text-sm text-purple-300 hover:text-white underline transition-colors"
                >
                  Sign out
                </button>
              </form>
            </div>
          )}
          <div class="px-6 py-3 border-t border-purple-700">
            <ThemeToggle />
          </div>
        </div>
      )}
    </div>
  );
}
