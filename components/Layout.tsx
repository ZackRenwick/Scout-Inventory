// Layout component for consistent page structure
import { ComponentChildren } from "preact";
import MobileNav from "../islands/MobileNav.tsx";
import EasterEgg from "../islands/EasterEgg.tsx";

interface LayoutProps {
  children: ComponentChildren;
  title?: string;
  username?: string;
  role?: "admin" | "editor" | "viewer";
}

export default function Layout({ children, title, username, role }: LayoutProps) {
  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <nav class="bg-purple-700 dark:bg-gray-950 text-white shadow-lg border-b border-purple-600 dark:border-purple-800 relative">
        <div class="container mx-auto px-4 py-4">
          <div class="flex items-center justify-between">
            <a href="/" class="flex items-center space-x-2 shrink-0">
              <span class="text-2xl">⛺</span>
              <h1 class="text-lg sm:text-xl font-bold leading-tight">7th Whitburn Scouts</h1>
            </a>
            <MobileNav username={username} role={role} />
          </div>
        </div>
      </nav>
      
      <main class="container mx-auto px-4 py-6 sm:py-8">
        {title && (
          <h2 class="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-purple-100 mb-4 sm:mb-6">{title}</h2>
        )}
        {children}
      </main>
      
      <footer class="bg-purple-800 dark:bg-gray-950 text-purple-200 mt-16 border-t border-purple-700 dark:border-purple-900">
        <div class="container mx-auto px-4 py-6 text-center">
          <p class="text-sm flex flex-col items-center gap-1">
            7th Whitburn Scouts Inventory · Built with Fresh{" "}
            <EasterEgg />
          </p>
        </div>
      </footer>
      <script dangerouslySetInnerHTML={{ __html: `
        function togglePw(inputId, btnId) {
          var input = document.getElementById(inputId);
          var btn = document.getElementById(btnId);
          if (!input) return;
          if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = '\uD83D\uDE48';
          } else {
            input.type = 'password';
            btn.textContent = '\uD83D\uDC41';
          }
        }
      ` }} />
    </div>
  );
}
