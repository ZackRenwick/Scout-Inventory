import { chromium } from "npm:playwright";

const baseUrl = Deno.env.get("E2E_BASE_URL")?.trim() || "http://127.0.0.1:8000";
const username = Deno.env.get("E2E_USERNAME")?.trim() || "admin";
const password = Deno.env.get("E2E_PASSWORD")?.trim() || "changeme";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function login(page: import("npm:playwright").Page): Promise<void> {
  await page.goto(new URL("/login", baseUrl).toString(), {
    waitUntil: "networkidle",
  });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 15_000,
    }),
    page.click('button[type="submit"]'),
  ]);
}

function isoDateAfter(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().split("T")[0];
}

async function getCsrfToken(
  page: import("npm:playwright").Page,
): Promise<string> {
  await page.goto(new URL("/admin/admin-panel", baseUrl).toString(), {
    waitUntil: "networkidle",
  });
  const token = await page.locator('input[name="csrf_token"]').first()
    .inputValue();
  assert(token && token.length > 0, "Expected CSRF token on admin panel");
  return token;
}

Deno.test({
  name: "e2e: inventory and loan mutating flows work end-to-end",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const seed = crypto.randomUUID().slice(0, 8);
    const createdName = `E2E Tent ${seed}`;
    const updatedName = `E2E Tent Updated ${seed}`;
    const borrower = `E2E Borrower ${seed}`;

    try {
      await login(page);

      const csrfToken = await getCsrfToken(page);

      // Create inventory item via authenticated API using real browser session + CSRF.
      const createRes = await page.request.post(
        new URL("/api/items", baseUrl).toString(),
        {
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          data: {
            name: createdName,
            category: "tent",
            space: "camp-store",
            quantity: 2,
            minThreshold: 1,
            location: "Metal Shelf 1 - Slot 1",
            tentType: "dome",
            capacity: 4,
            size: "4-person",
            condition: "good",
          },
        },
      );
      assert(
        createRes.status() === 201,
        `Expected create 201, got ${createRes.status()}`,
      );
      const created = await createRes.json() as { id: string; name: string };
      assert(created.id, "Expected created item id");

      // Edit item name via API and verify persisted value.
      const updateRes = await page.request.put(
        new URL(`/api/items/${created.id}`, baseUrl).toString(),
        {
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          data: { name: updatedName },
        },
      );
      assert(updateRes.ok(), `Expected update OK, got ${updateRes.status()}`);

      const updatedRes = await page.request.get(
        new URL(`/api/items/${created.id}`, baseUrl).toString(),
      );
      assert(
        updatedRes.ok(),
        `Expected item API OK after edit, got ${updatedRes.status()}`,
      );
      const updated = await updatedRes.json() as { name: string };
      assert(
        updated.name === updatedName,
        `Expected updated name ${updatedName}, got ${updated.name}`,
      );

      // Create and return loan through API.
      const createLoanRes = await page.request.post(
        new URL("/api/loans", baseUrl).toString(),
        {
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          data: {
            itemId: created.id,
            borrower,
            quantity: 1,
            expectedReturnDate: isoDateAfter(14),
          },
        },
      );
      assert(
        createLoanRes.status() === 201,
        `Expected loan create 201, got ${createLoanRes.status()}`,
      );
      const createdLoan = await createLoanRes.json() as { id: string };
      assert(createdLoan.id, "Expected created loan id");

      const returnLoanRes = await page.request.patch(
        new URL(`/api/loans/${createdLoan.id}`, baseUrl).toString(),
        {
          headers: { "X-CSRF-Token": csrfToken },
        },
      );
      assert(
        returnLoanRes.ok(),
        `Expected loan return OK, got ${returnLoanRes.status()}`,
      );

      // Delete item and verify it is gone.
      const deleteRes = await page.request.delete(
        new URL(`/api/items/${created.id}`, baseUrl).toString(),
        {
          headers: { "X-CSRF-Token": csrfToken },
        },
      );
      assert(deleteRes.ok(), `Expected delete OK, got ${deleteRes.status()}`);

      const deletedRes = await page.request.get(
        new URL(`/api/items/${created.id}`, baseUrl).toString(),
      );
      assert(
        deletedRes.status() === 404,
        `Expected deleted item to return 404, got ${deletedRes.status()}`,
      );
    } finally {
      await context.close();
      await browser.close();
    }
  },
});
