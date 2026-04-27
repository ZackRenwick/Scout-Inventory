import { normalizeLocalData } from "./normalize_local_data.ts";
const repoRoot = new URL("../", import.meta.url).pathname;

const port = Deno.env.get("E2E_PORT")?.trim() || "8787";
const baseUrl = Deno.env.get("E2E_BASE_URL")?.trim() ||
  `http://127.0.0.1:${port}`;
const username = Deno.env.get("E2E_USERNAME")?.trim() || "admin";
const password = Deno.env.get("E2E_PASSWORD")?.trim() || "changeme";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(new URL("/login", url), { redirect: "manual" });
      if (res.status >= 200 && res.status < 500) {
        return;
      }
    } catch {
      // Keep retrying until timeout.
    }
    await wait(500);
  }
  throw new Error(`Timed out waiting for local app at ${url}`);
}

const envBase = Deno.env.toObject();

let exitCode = 1;
let server: Deno.ChildProcess | null = null;

try {
  await normalizeLocalData();

  server = new Deno.Command("deno", {
    cwd: repoRoot,
    args: ["run", "-A", "--unstable-kv", "main.ts"],
    env: {
      ...envBase,
      PORT: new URL(baseUrl).port || port,
      ADMIN_USERNAME: username,
      ADMIN_PASSWORD: password,
      DEV_BYPASS: "false",
    },
    stdout: "inherit",
    stderr: "inherit",
  }).spawn();

  await waitForServer(baseUrl);

  const e2eFiles = [
    "tests/e2e/main_flows_e2e_test.ts",
    "tests/e2e/mutating_flows_e2e_test.ts",
  ];

  for (const e2eFile of e2eFiles) {
    const testRun = new Deno.Command("deno", {
      cwd: repoRoot,
      args: ["test", "-A", e2eFile],
      env: {
        ...envBase,
        E2E_BASE_URL: baseUrl,
        E2E_USERNAME: username,
        E2E_PASSWORD: password,
      },
      stdout: "inherit",
      stderr: "inherit",
    }).spawn();

    const status = await testRun.status;
    if (status.code !== 0) {
      exitCode = status.code;
      break;
    }
    exitCode = 0;
  }
} finally {
  if (server) {
    server.kill("SIGTERM");
    await server.status;
  }
}

Deno.exit(exitCode);
