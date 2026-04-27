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

type TestStatus = "pass" | "fail" | "new" | "updated" | "error";

interface TestResult {
  name: string;
  routePath: string;
  viewport: string;
  status: TestStatus;
  diffRatio?: number;
  maxDiffRatio?: number;
  errorMessage?: string;
  baselinePath?: string;
  actualPath?: string;
  diffPath?: string;
}

const baseUrl = Deno.env.get("VISUAL_BASE_URL") ?? "http://127.0.0.1:8001";
const maxDiffRatio = Number(Deno.env.get("VISUAL_MAX_DIFF_RATIO") ?? "0.01");
const updateSnapshots = Deno.args.includes("--update");
const strictMode = Deno.env.get("VISUAL_STRICT") === "true";
const openReport = Deno.args.includes("--open");
const visualUsername = Deno.env.get("VISUAL_USERNAME")?.trim() ?? "";
const visualPassword = Deno.env.get("VISUAL_PASSWORD")?.trim() ?? "";

const baselineDir = "tests/visual/baselines";
const actualsDir = "tests/visual/actuals";
const diffDir = "tests/visual/diffs";
const reportPath = "tests/visual/report.html";
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
  await Deno.mkdir(actualsDir, { recursive: true });
  await Deno.mkdir(diffDir, { recursive: true });
}

function normalizeRoutePath(routeFilePath: string): string | null {
  if (!routeFilePath.endsWith(".tsx")) return null;
  const raw = routeFilePath
    .replace(/^\.\/routes/, "")
    .replace(/\.tsx$/, "")
    .replace(/\/index$/, "")
    .replace(/\/+/g, "/");

  if (
    !raw || raw === "/_app" || raw === "/_404" || raw.endsWith("/_middleware")
  ) {
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

  await page.goto(new URL("/login", baseUrl).toString(), {
    waitUntil: "networkidle",
  });
  await page.fill('input[name="username"]', visualUsername);
  await page.fill('input[name="password"]', visualPassword);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 15_000,
    }),
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

    await page.goto(new URL(resolver.listPath, baseUrl).toString(), {
      waitUntil: "networkidle",
    });
    const hrefs = await page.$$eval("a[href]", (anchors) =>
      anchors
        .map((a) => a.getAttribute("href") ?? "")
        .filter((href) => href.startsWith("/")));

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

function comparePngs(
  actualBytes: Uint8Array,
  baselineBytes: Uint8Array,
): { diffRatio: number; diffPngBytes: Uint8Array } | { error: string } {
  const actual = PNG.sync.read(Buffer.from(actualBytes));
  const baseline = PNG.sync.read(Buffer.from(baselineBytes));

  if (actual.width !== baseline.width || actual.height !== baseline.height) {
    return {
      error:
        `Snapshot dimensions differ. actual=${actual.width}x${actual.height}, baseline=${baseline.width}x${baseline.height}`,
    };
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

  console.log(
    `\n🔍 Visual regression starting — ${
      updateSnapshots ? "UPDATE mode" : "COMPARE mode"
    }`,
  );
  console.log(`   Base URL : ${baseUrl}`);
  console.log(`   Threshold: ${(maxDiffRatio * 100).toFixed(1)}%\n`);

  const browser = await chromium.launch({ headless: true });
  const results: TestResult[] = [];
  const failures: string[] = [];
  const warnings: string[] = [];
  const skipped: string[] = [];
  const discoveredRoutes = await loadManifestPageRoutes();

  try {
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

    const totalTests = resolvedRoutes.length * viewports.length;
    console.log(
      `📋 Discovered ${resolvedRoutes.length} routes × ${viewports.length} viewports = ${totalTests} screenshots\n`,
    );

    let done = 0;
    for (const routePath of resolvedRoutes) {
      for (const viewport of viewports) {
        const testName = `${slugifyPath(routePath)}--${viewport.name}`;
        const baselinePath = `${baselineDir}/${testName}.png`;
        const actualPath = `${actualsDir}/${testName}.png`;
        const diffPath = `${diffDir}/${testName}.diff.png`;

        done++;
        const progress = `[${
          String(done).padStart(String(totalTests).length)
        }/${totalTests}]`;
        process.stdout.write(`${progress} 📸 ${testName} … `);

        const { bytes: actual, finalPathname } = await capturePath(
          browser,
          viewport,
          routePath,
        );

        // Always save the actual so the report can show it
        await Deno.writeFile(actualPath, actual);

        if (routePath !== "/login" && finalPathname.startsWith("/login")) {
          const msg =
            `${testName}: redirected to /login while capturing ${routePath}. Provide VISUAL_USERNAME/VISUAL_PASSWORD or run local server with DEV_BYPASS=true.`;
          console.log("⚠️  auth redirect");
          failures.push(msg);
          results.push({
            name: testName,
            routePath,
            viewport: viewport.name,
            status: "error",
            errorMessage: msg,
            actualPath,
          });
          continue;
        }

        const hasBaseline = await fileExists(baselinePath);
        if (updateSnapshots || !hasBaseline) {
          await Deno.writeFile(baselinePath, actual);
          console.log(hasBaseline ? "✏️  updated" : "🆕 created");
          results.push({
            name: testName,
            routePath,
            viewport: viewport.name,
            status: hasBaseline ? "updated" : "new",
            baselinePath,
            actualPath,
          });
          continue;
        }

        const baseline = await Deno.readFile(baselinePath);
        const comparison = comparePngs(actual, baseline);

        if ("error" in comparison) {
          console.log("❌ error");
          failures.push(`${testName}: ${comparison.error}`);
          results.push({
            name: testName,
            routePath,
            viewport: viewport.name,
            status: "error",
            errorMessage: comparison.error,
            baselinePath,
            actualPath,
          });
          continue;
        }

        const { diffRatio, diffPngBytes } = comparison;
        if (diffRatio > maxDiffRatio) {
          console.log(`❌ FAIL ${(diffRatio * 100).toFixed(2)}%`);
          await Deno.writeFile(diffPath, diffPngBytes);
          failures.push(
            `${testName}: diff ratio ${(diffRatio * 100).toFixed(2)}% exceeds ${
              (maxDiffRatio * 100).toFixed(2)
            }% (diff: ${diffPath})`,
          );
          results.push({
            name: testName,
            routePath,
            viewport: viewport.name,
            status: "fail",
            diffRatio,
            maxDiffRatio,
            baselinePath,
            actualPath,
            diffPath,
          });
        } else {
          console.log(`✅ pass ${(diffRatio * 100).toFixed(2)}%`);
          if (await fileExists(diffPath)) {
            await Deno.remove(diffPath);
          }
          results.push({
            name: testName,
            routePath,
            viewport: viewport.name,
            status: "pass",
            diffRatio,
            maxDiffRatio,
            baselinePath,
            actualPath,
          });
        }
      }
    }

    if (skipped.length > 0) {
      const message = `Skipped unresolved dynamic routes: ${
        skipped.join(", ")
      }`;
      if (strictMode) {
        failures.push(message);
      } else {
        warnings.push(message);
      }
    }
  } finally {
    await browser.close();
  }

  await generateHtmlReport(results);
  console.log(`\nReport: ${reportPath}`);

  if (openReport || failures.length > 0) {
    const opener = Deno.build.os === "darwin" ? "open" : "xdg-open";
    const cmd = new Deno.Command(opener, { args: [reportPath] });
    cmd.spawn();
  }

  if (warnings.length > 0) {
    console.warn("\nVisual regression warnings:");
    for (const warning of warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  if (failures.length > 0) {
    console.error("\nVisual regressions detected:");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    Deno.exit(1);
  }

  console.log("Visual regression check passed.");
}

function statusBadge(status: TestStatus): string {
  const map: Record<TestStatus, [string, string]> = {
    pass: ["#16a34a", "PASS"],
    fail: ["#dc2626", "FAIL"],
    error: ["#d97706", "ERROR"],
    new: ["#2563eb", "NEW"],
    updated: ["#7c3aed", "UPDATED"],
  };
  const [color, label] = map[status];
  return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:.5px">${label}</span>`;
}

function imgCell(path: string | undefined, label: string): string {
  if (!path) {
    return `<div class="img-cell"><div class="img-label">${label}</div><div class="img-missing">—</div></div>`;
  }
  // path is relative to this file's dir (tests/visual/), strip leading prefix
  const rel = path.replace(/^tests\/visual\//, "");
  return `<div class="img-cell">
    <div class="img-label">${label}</div>
    <a href="${rel}" target="_blank"><img src="${rel}" loading="lazy" /></a>
  </div>`;
}

async function generateHtmlReport(results: TestResult[]): Promise<void> {
  const total = results.length;
  const failed =
    results.filter((r) => r.status === "fail" || r.status === "error").length;
  const passed = results.filter((r) => r.status === "pass").length;
  const newOrUpdated =
    results.filter((r) => r.status === "new" || r.status === "updated").length;
  const timestamp = new Date().toLocaleString("en-GB", {
    timeZone: "Europe/London",
  });

  const cards = results.map((r) => {
    const diffPct = r.diffRatio !== undefined
      ? `${(r.diffRatio * 100).toFixed(2)}%`
      : "—";
    const maxPct = r.maxDiffRatio !== undefined
      ? `${(r.maxDiffRatio * 100).toFixed(2)}%`
      : "—";
    return `<div class="card" data-status="${r.status}">
  <div class="card-header">
    <div class="card-title">
      ${statusBadge(r.status)}
      <span class="route">${r.routePath}</span>
      <span class="viewport-badge">${r.viewport}</span>
    </div>
    <div class="card-meta">${
      r.errorMessage
        ? `<span class="error-msg">${r.errorMessage}</span>`
        : r.status === "pass" || r.status === "fail"
        ? `diff: <strong>${diffPct}</strong> &nbsp;/&nbsp; threshold: ${maxPct}`
        : ""
    }</div>
  </div>
  <div class="img-row">
    ${imgCell(r.baselinePath, "Baseline")}
    ${imgCell(r.actualPath, "Actual")}
    ${imgCell(r.diffPath, "Diff")}
  </div>
</div>`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Visual Regression Report</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
  header { background: #1e293b; border-bottom: 1px solid #334155; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  header h1 { font-size: 18px; font-weight: 700; color: #f1f5f9; }
  .summary { display: flex; gap: 16px; flex-wrap: wrap; }
  .stat { background: #0f172a; border-radius: 8px; padding: 6px 14px; font-size: 13px; }
  .stat span { font-weight: 700; font-size: 16px; margin-right: 4px; }
  .stat.fail span { color: #f87171; }
  .stat.pass span { color: #4ade80; }
  .stat.new span  { color: #60a5fa; }
  .ts { font-size: 12px; color: #64748b; }
  .toolbar { padding: 16px 24px; display: flex; gap: 8px; flex-wrap: wrap; }
  .filter-btn { background: #1e293b; border: 1px solid #334155; color: #cbd5e1; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; }
  .filter-btn.active { background: #6366f1; border-color: #6366f1; color: #fff; }
  .cards { padding: 0 24px 40px; display: flex; flex-direction: column; gap: 16px; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; overflow: hidden; }
  .card[data-status="fail"] { border-color: #dc2626; }
  .card[data-status="error"] { border-color: #d97706; }
  .card[data-status="pass"] { border-color: #16a34a30; }
  .card.hidden { display: none; }
  .card-header { padding: 12px 16px; border-bottom: 1px solid #334155; display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
  .card-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .route { font-weight: 600; font-size: 14px; color: #f1f5f9; font-family: monospace; }
  .viewport-badge { background: #334155; color: #94a3b8; font-size: 11px; padding: 2px 7px; border-radius: 4px; }
  .card-meta { font-size: 13px; color: #94a3b8; }
  .error-msg { color: #fbbf24; font-size: 12px; font-family: monospace; }
  .img-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #334155; }
  .img-cell { background: #0f172a; padding: 12px; min-height: 80px; }
  .img-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: #64748b; margin-bottom: 8px; }
  .img-cell img { width: 100%; height: auto; display: block; border-radius: 4px; }
  .img-missing { color: #475569; font-size: 24px; text-align: center; padding: 16px; }
  @media (max-width: 600px) { .img-row { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<header>
  <h1>Visual Regression Report</h1>
  <div class="summary">
    <div class="stat fail"><span>${failed}</span>failed</div>
    <div class="stat pass"><span>${passed}</span>passed</div>
    <div class="stat new"><span>${newOrUpdated}</span>new/updated</div>
    <div class="stat"><span>${total}</span>total</div>
  </div>
  <div class="ts">${timestamp}</div>
</header>
<div class="toolbar">
  <button class="filter-btn active" data-filter="all">All (${total})</button>
  <button class="filter-btn" data-filter="fail">Failed (${failed})</button>
  <button class="filter-btn" data-filter="pass">Passed (${passed})</button>
  <button class="filter-btn" data-filter="new">New/Updated (${newOrUpdated})</button>
</div>
<div class="cards" id="cards">
${cards}
</div>
<script>
  const btns = document.querySelectorAll('.filter-btn');
  btns.forEach(btn => btn.addEventListener('click', () => {
    btns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const f = btn.dataset.filter;
    document.querySelectorAll('.card').forEach(card => {
      const s = card.dataset.status;
      const show = f === 'all' || s === f || (f === 'fail' && s === 'error') || (f === 'new' && (s === 'new' || s === 'updated'));
      card.classList.toggle('hidden', !show);
    });
  }));
</script>
</body>
</html>`;

  await Deno.writeTextFile(reportPath, html);
}

await run();
