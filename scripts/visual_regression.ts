import { chromium } from "npm:playwright";
import pixelmatch from "npm:pixelmatch";
import { PNG } from "npm:pngjs";
import { Buffer } from "node:buffer";

interface VisualViewport {
  name: string;
  viewport: { width: number; height: number };
  userAgent?: string;
}

interface DynamicResolver {
  prefix: string;
  listPath: string;
  matcher: RegExp;
  disallowedIds?: Set<string>;
}

interface CaptureResult {
  bytes: Uint8Array;
  finalPathname: string;
}

const baseUrl = Deno.env.get("VISUAL_BASE_URL") ?? "http://127.0.0.1:8001";
const maxDiffRatio = Number(Deno.env.get("VISUAL_MAX_DIFF_RATIO") ?? "0.01");
const updateSnapshots = Deno.args.includes("--update");
const strictMode = Deno.env.get("VISUAL_STRICT") === "true";
const visualUsername = Deno.env.get("VISUAL_USERNAME")?.trim() ?? "";
const visualPassword = Deno.env.get("VISUAL_PASSWORD")?.trim() ?? "";

const baselineDir = "tests/visual/baselines";
const diffDir = "tests/visual/diffs";
const manifestPath = "fresh.gen.ts";

const viewports: VisualViewport[] = [
  {
    name: "desktop",
    viewport: { width: 1366, height: 900 },
  },
  {
    name: "mobile",
    viewport: { width: 393, height: 851 },
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  },
];

const dynamicResolvers: DynamicResolver[] = [
  {
    prefix: "/inventory/edit/[id]",
    listPath: "/inventory",
    matcher: /^\/inventory\/edit\/([^/]+)$/,
    disallowedIds: new Set(["add", "edit"]),
  },
  {
    prefix: "/inventory/[id]",
    listPath: "/inventory",
    matcher: /^\/inventory\/([^/]+)(?:\/maintenance|\/qr|\/scan)?$/,
    disallowedIds: new Set(["add", "edit"]),
  },
  {
    prefix: "/camps/[id]",
    listPath: "/camps",
    matcher: /^\/camps\/([^/]+)(?:\/edit|\/print)?$/,
    disallowedIds: new Set(["new", "templates"]),
  },
  {
    prefix: "/meals/[id]/edit",
    listPath: "/meals",
    matcher: /^\/meals\/([^/]+)\/edit$/,
    disallowedIds: new Set(["new"]),
  },
  {
    prefix: "/risk-assessments/[id]/edit",
    listPath: "/risk-assessments",
    matcher: /^\/risk-assessments\/([^/]+)\/edit$/,
    disallowedIds: new Set(["print"]),
  },
];

function fail(message: string): never {
  console.error(message);
  Deno.exit(1);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirs(): Promise<void> {
  await Deno.mkdir(baselineDir, { recursive: true });
  await Deno.mkdir(diffDir, { recursive: true });
}

function normalizeRoutePath(routeFilePath: string): string | null {
  if (!routeFilePath.endsWith(".tsx")) return null;
  const raw = routeFilePath
    .replace(/^\.\/routes/, "")
    .replace(/\.tsx$/, "")
    .replace(/\/index$/, "")
    .replace(/\/+/g, "/");

  if (!raw || raw === "/_app" || raw === "/_404" || raw.endsWith("/_middleware")) {
    return null;
  }

  return raw;
}

async function loadManifestPageRoutes(): Promise<string[]> {
  const content = await Deno.readTextFile(manifestPath);
  const routes = new Set<string>();
  const pattern = /"(\.\/routes\/[^"]+)":/g;
  let match: RegExpExecArray | null = null;

  while ((match = pattern.exec(content)) !== null) {
    const route = normalizeRoutePath(match[1]);
    if (route) {
      routes.add(route);
    }
  }

  return Array.from(routes).sort();
}

function slugifyPath(pathname: string): string {
  if (pathname === "/") return "home";
  return pathname
    .replace(/^\//, "")
    .replace(/\//g, "--")
    .replace(/\[|\]/g, "")
    .replace(/[^a-zA-Z0-9\-_.]/g, "_");
}

async function maybeLogin(page: import("npm:playwright").Page): Promise<void> {
  if (!visualUsername || !visualPassword) {
    return;
  }

  await page.goto(new URL("/login", baseUrl).toString(), { waitUntil: "networkidle" });
  await page.fill('input[name="username"]', visualUsername);
  await page.fill('input[name="password"]', visualPassword);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function resolveDynamicRoute(
  page: import("npm:playwright").Page,
  route: string,
): Promise<string | null> {
  if (!route.includes("[")) {
    return route;
  }

  if (route.includes("[name]")) {
    const name = Deno.env.get("VISUAL_GREET_NAME")?.trim() || "scout";
    return route.replace("[name]", encodeURIComponent(name));
  }

  for (const resolver of dynamicResolvers) {
    if (!route.startsWith(resolver.prefix)) {
      continue;
    }

    await page.goto(new URL(resolver.listPath, baseUrl).toString(), { waitUntil: "networkidle" });
    const hrefs = await page.$$eval("a[href]", (anchors) =>
      anchors
        .map((a) => a.getAttribute("href") ?? "")
        .filter((href) => href.startsWith("/"))
    );

    for (const href of hrefs) {
      const matched = href.match(resolver.matcher);
      if (!matched || !matched[1]) {
        continue;
      }
      if (resolver.disallowedIds?.has(matched[1])) {
        continue;
      }
      return route.replace("[id]", matched[1]);
    }

    return null;
  }

  return null;
}

async function capturePath(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  viewportConfig: VisualViewport,
  pathname: string,
): Promise<CaptureResult> {
  const context = await browser.newContext({
    viewport: viewportConfig.viewport,
    colorScheme: "light",
    locale: "en-GB",
    timezoneId: "Europe/London",
    userAgent: viewportConfig.userAgent,
  });

  const page = await context.newPage();
  await maybeLogin(page);
  const url = new URL(pathname, baseUrl).toString();
  await page.goto(url, { waitUntil: "networkidle" });
  const finalPathname = new URL(page.url()).pathname;
  const buffer = await page.screenshot({
    fullPage: true,
    type: "png",
    animations: "disabled",
  });
  await context.close();
  return {
    bytes: new Uint8Array(buffer),
    finalPathname,
  };
}

function comparePngs(actualBytes: Uint8Array, baselineBytes: Uint8Array): { diffRatio: number; diffPngBytes: Uint8Array } {
  const actual = PNG.sync.read(Buffer.from(actualBytes));
  const baseline = PNG.sync.read(Buffer.from(baselineBytes));

  if (actual.width !== baseline.width || actual.height !== baseline.height) {
    fail(
      `Snapshot dimensions differ. actual=${actual.width}x${actual.height}, baseline=${baseline.width}x${baseline.height}`,
    );
  }

  const diff = new PNG({ width: actual.width, height: actual.height });
  const diffPixels = pixelmatch(
    actual.data,
    baseline.data,
    diff.data,
    actual.width,
    actual.height,
    { threshold: 0.1 },
  );

  const totalPixels = actual.width * actual.height;
  const diffRatio = totalPixels > 0 ? diffPixels / totalPixels : 0;
  const diffPngBytes = new Uint8Array(PNG.sync.write(diff));
  return { diffRatio, diffPngBytes };
}

async function run(): Promise<void> {
  await ensureDirs();

  const browser = await chromium.launch({ headless: true });
  const failures: string[] = [];
  const warnings: string[] = [];
  const skipped: string[] = [];
  const discoveredRoutes = await loadManifestPageRoutes();

  try {
    // Use one authenticated page session for dynamic route discovery.
    const discoveryContext = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      colorScheme: "light",
      locale: "en-GB",
      timezoneId: "Europe/London",
    });
    const discoveryPage = await discoveryContext.newPage();
    await maybeLogin(discoveryPage);

    const resolvedRoutes: string[] = [];
    for (const route of discoveredRoutes) {
      const resolved = await resolveDynamicRoute(discoveryPage, route);
      if (resolved) {
        resolvedRoutes.push(resolved);
      } else {
        skipped.push(route);
      }
    }
    await discoveryContext.close();

    if (resolvedRoutes.length === 0) {
      fail("No page routes were resolved for visual regression.");
    }

    for (const routePath of resolvedRoutes) {
      for (const viewport of viewports) {
        const testName = `${slugifyPath(routePath)}--${viewport.name}`;
        const baselinePath = `${baselineDir}/${testName}.png`;
        const diffPath = `${diffDir}/${testName}.diff.png`;

        const { bytes: actual, finalPathname } = await capturePath(browser, viewport, routePath);
        if (routePath !== "/login" && finalPathname.startsWith("/login")) {
          failures.push(
            `${testName}: redirected to /login while capturing ${routePath}. Provide VISUAL_USERNAME/VISUAL_PASSWORD or run local server with DEV_BYPASS=true.`,
          );
          continue;
        }

        const hasBaseline = await fileExists(baselinePath);
        if (updateSnapshots || !hasBaseline) {
          await Deno.writeFile(baselinePath, actual);
          console.log(`${hasBaseline ? "Updated" : "Created"} baseline: ${baselinePath}`);
          continue;
        }

        const baseline = await Deno.readFile(baselinePath);
        const { diffRatio, diffPngBytes } = comparePngs(actual, baseline);
        if (diffRatio > maxDiffRatio) {
          await Deno.writeFile(diffPath, diffPngBytes);
          failures.push(
            `${testName}: diff ratio ${(diffRatio * 100).toFixed(2)}% exceeds ${(maxDiffRatio * 100).toFixed(2)}% (diff: ${diffPath})`,
          );
        } else if (await fileExists(diffPath)) {
          await Deno.remove(diffPath);
        }
      }
    }

    if (skipped.length > 0) {
      const message = `Skipped unresolved dynamic routes: ${skipped.join(", ")}`;
      if (strictMode) {
        failures.push(message);
      } else {
        warnings.push(message);
      }
    }
  } finally {
    await browser.close();
  }

  if (warnings.length > 0) {
    console.warn("Visual regression warnings:");
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }

  if (failures.length > 0) {
    console.error("Visual regressions detected:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    Deno.exit(1);
  }

  console.log("Visual regression check passed.");
}

await run();
