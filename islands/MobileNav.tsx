// Mobile navigation menu toggle
import { useSignal } from "@preact/signals";
import ThemeToggle from "./ThemeToggle.tsx";

interface MobileNavProps {
  username?: string;
  role?: "admin" | "manager" | "editor" | "viewer";
}

export default function MobileNav({ username, role }: MobileNavProps) {
  const open = useSignal(false);

  return (
    <div>
      {/* Hamburger button — only shown on small/tablet screens */}
      <button
        onClick={() => open.value = !open.value}
        class="lg:hidden flex items-center px-2 py-1 rounded text-white hover:bg-white/20 transition-colors"
        aria-label="Toggle menu"
      >
        <span class="text-xl">{open.value ? "✕" : "☰"}</span>
      </button>

      {/* Desktop nav links — hidden on mobile/tablet */}
      <div class="hidden lg:flex items-center space-x-4">
        <a href="/" class="hover:text-purple-200 transition-colors">Dashboard</a>
        <a href="/inventory" class="hover:text-purple-200 transition-colors">Inventory</a>
        <a href="/camps" class="hover:text-purple-200 transition-colors">Camp Planning</a>
        <a href="/meals" class="hover:text-purple-200 transition-colors">Meal Planner</a>
        <a href="/loans" class="hover:text-purple-200 transition-colors">Loans</a>
        {(role === "admin" || role === "manager") && (
          <a href="/admin/admin-panel" class="hover:text-purple-200 transition-colors">Admin</a>
        )}
        <ThemeToggle />
        {username && (
          <div class="flex items-center space-x-2 border-l border-purple-500 pl-4">
            <a href="/account/settings" class="text-sm text-purple-200 hover:text-white transition-colors">👤 {username}</a>
            <form method="POST" action="/api/logout">
              <button type="submit" class="text-sm text-purple-300 hover:text-white underline transition-colors">
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Mobile dropdown */}
      {open.value && (
        <div class="lg:hidden absolute top-full left-0 right-0 bg-purple-900 dark:bg-purple-950 shadow-lg z-50 py-2">
          <a href="/" class="block px-6 py-3 hover:bg-purple-800 transition-colors">🏠 Dashboard</a>
          <a href="/inventory" class="block px-6 py-3 hover:bg-purple-800 transition-colors">📋 Inventory</a>
          <a href="/camps" class="block px-6 py-3 hover:bg-purple-800 transition-colors">🏕️ Camp Planning</a>
          <a href="/meals" class="block px-6 py-3 hover:bg-purple-800 transition-colors">🍽️ Meal Planner</a>
          <a href="/loans" class="block px-6 py-3 hover:bg-purple-800 transition-colors">📤 Loans</a>
          {(role === "admin" || role === "manager") && (
            <a href="/admin/admin-panel" class="block px-6 py-3 hover:bg-purple-800 transition-colors">⚙️ Admin</a>
          )}
          {username && (
            <div class="border-t border-purple-700 mt-1">
              <a href="/account/settings" class="block px-6 py-3 text-sm hover:bg-purple-800 transition-colors">⚙️ Account Settings ({username})</a>
              <form method="POST" action="/api/logout" class="px-6 pb-3">
                <button type="submit" class="text-sm text-purple-300 hover:text-white underline transition-colors">
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
