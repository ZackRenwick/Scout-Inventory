// Login page
import { Handlers, PageProps } from "$fresh/server.ts";
import {
  getUserByUsername,
  verifyPassword,
  createSession,
  makeSessionCookie,
  getSessionCookie,
  getSession,
  ensureDefaultAdmin,
} from "../lib/auth.ts";

interface LoginData {
  error?: string;
}

export const handler: Handlers<LoginData> = {
  async GET(req, ctx) {
    // Already logged in? Redirect to dashboard
    const sessionId = getSessionCookie(req);
    if (sessionId) {
      const session = await getSession(sessionId);
      if (session) {
        return new Response(null, { status: 302, headers: { location: "/" } });
      }
    }
    return ctx.render({});
  },

  async POST(req, ctx) {
    await ensureDefaultAdmin();
    const form = await req.formData();
    const username = (form.get("username") as string ?? "").trim();
    const password = form.get("password") as string ?? "";

    if (!username || !password) {
      return ctx.render({ error: "Please enter your username and password." });
    }

    const user = await getUserByUsername(username);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return ctx.render({ error: "Invalid username or password." });
    }

    const session = await createSession(user);
    const redirectTo = new URL(req.url).searchParams.get("redirect") ?? "/";

    return new Response(null, {
      status: 302,
      headers: {
        location: redirectTo,
        "set-cookie": makeSessionCookie(session.id),
      },
    });
  },
};

export default function LoginPage({ data }: PageProps<LoginData>) {
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Sign In · Scout Camp Loft</title>
        <link rel="stylesheet" href="/styles.css" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const saved = localStorage.getItem('theme');
                if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: `
          function togglePassword() {
            var input = document.getElementById('password');
            var icon = document.getElementById('pwToggle');
            if (input.type === 'password') {
              input.type = 'text';
              icon.textContent = '\uD83D\uDE48';
            } else {
              input.type = 'password';
              icon.textContent = '\uD83D\uDC41';
            }
          }
        ` }} />
      </head>
      <body class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div class="w-full max-w-sm">
          <div class="text-center mb-8">
            <span class="text-5xl">⛺</span>
            <h1 class="mt-4 text-2xl font-bold text-gray-800 dark:text-purple-100">Scout Camp Loft</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Inventory Management</p>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
            <h2 class="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-6">Sign in to continue</h2>

            {data?.error && (
              <div class="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
                {data.error}
              </div>
            )}

            <form method="POST">
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="username">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  name="username"
                  required
                  autocomplete="username"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                />
              </div>

              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="password">
                  Password
                </label>
                <div class="relative">
                  <input
                    id="password"
                    type="password"
                    name="password"
                    required
                    autocomplete="current-password"
                    class="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                  <button
                    type="button"
                    onclick="togglePassword()"
                    class="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label="Toggle password visibility"
                  >
                    <span id="pwToggle">👁</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                class="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              >
                Sign In
              </button>
            </form>
          </div>
        </div>
      </body>
    </html>
  );
}
