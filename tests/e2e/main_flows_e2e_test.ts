import { chromium } from "npm:playwright";

const baseUrl = Deno.env.get("E2E_BASE_URL")?.trim() || "http://127.0.0.1:8000";
const username = Deno.env.get("E2E_USERNAME")?.trim() || "admin";
const password = Deno.env.get("E2E_PASSWORD")?.trim() || "changeme";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function login(page: import("npm:playwright").Page): Promise<void> {
  await page.goto(new URL("/login", baseUrl).toString(), { waitUntil: "networkidle" });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 }),
    page.click('button[type="submit"]'),
  ]);
}

Deno.test({
  name: "e2e: unauthenticated users are redirected to login",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(new URL("/inventory", baseUrl).toString(), {
        waitUntil: "networkidle",
      });
      const url = new URL(page.url());
      assert(url.pathname === "/login", `Expected /login redirect, got ${url.pathname}`);
      assert(
        (url.searchParams.get("redirect") ?? "").startsWith("/inventory"),
        "Expected redirect query param for protected path",
      );
    } finally {
      await context.close();
      await browser.close();
    }
  },
});

Deno.test({
  name: "e2e: authenticated user can access core app flows",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await login(page);

      const routes = [
        "/",
        "/inventory",
        "/camps",
        "/loans",
        "/first-aid",
        "/admin/admin-panel",
      ];

      for (const route of routes) {
        await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "networkidle" });
        const finalUrl = new URL(page.url());
        assert(
          !finalUrl.pathname.startsWith("/login"),
          `Expected authenticated route ${route} not to redirect to /login`,
        );
      }

      await page.goto(new URL("/meals", baseUrl).toString(), { waitUntil: "networkidle" });
      const mealsUrl = new URL(page.url());
      assert(mealsUrl.pathname === "/meals", `Expected /meals access, got ${mealsUrl.pathname}`);
    } finally {
      await context.close();
      await browser.close();
    }
  },
});

Deno.test({
  name: "e2e: logout invalidates protected access",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await login(page);

      await page.request.post(new URL("/api/logout", baseUrl).toString());

      await page.goto(new URL("/inventory", baseUrl).toString(), {
        waitUntil: "networkidle",
      });
      const url = new URL(page.url());
      assert(url.pathname === "/login", `Expected /login after logout, got ${url.pathname}`);
    } finally {
      await context.close();
      await browser.close();
    }
  },
});
