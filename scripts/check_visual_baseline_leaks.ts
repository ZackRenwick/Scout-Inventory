const baselineDir = "tests/visual/baselines";
const staticDir = "static";

const runtimeCodeRoots = [
  "routes",
  "islands",
  "components",
  "lib",
  "db",
];

const runtimeCodeFiles = [
  "main.ts",
  "dev.ts",
  "fresh.config.ts",
  "fresh.gen.ts",
];

function fail(message: string): never {
  console.error(`\n[check:visual-baselines] ${message}`);
  Deno.exit(1);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  if (!await pathExists(root)) {
    return files;
  }

  const queue: string[] = [root];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for await (const entry of Deno.readDir(current)) {
      const path = `${current}/${entry.name}`;
      if (entry.isDirectory) {
        queue.push(path);
        continue;
      }
      files.push(path);
    }
  }
  return files;
}

function isTypeScriptRuntimeFile(path: string): boolean {
  return path.endsWith(".ts") || path.endsWith(".tsx");
}

function isStaticAsset(path: string): boolean {
  return path.startsWith(`${staticDir}/`);
}

function basename(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash >= 0 ? path.slice(slash + 1) : path;
}

async function collectBaselineFileNames(): Promise<Set<string>> {
  if (!await pathExists(baselineDir)) {
    return new Set();
  }

  const names = new Set<string>();
  for await (const entry of Deno.readDir(baselineDir)) {
    if (!entry.isFile || !entry.name.endsWith(".png")) {
      continue;
    }
    names.add(entry.name);
  }
  return names;
}

function scanForBaselineImportLeak(content: string): boolean {
  const patterns = [
    /tests\/visual\/baselines\//,
    /\.\.\/tests\/visual\/baselines\//,
    /\.\/tests\/visual\/baselines\//,
  ];
  return patterns.some((pattern) => pattern.test(content));
}

async function run(): Promise<void> {
  const baselineNames = await collectBaselineFileNames();
  if (baselineNames.size === 0) {
    console.log(
      "[check:visual-baselines] No baseline PNGs found; nothing to validate.",
    );
    return;
  }

  const staticFiles = await collectFiles(staticDir);
  const collidingStaticAssets: string[] = [];
  for (const file of staticFiles) {
    if (!isStaticAsset(file)) continue;
    const name = basename(file);
    if (baselineNames.has(name)) {
      collidingStaticAssets.push(file);
    }
  }

  const codeFiles: string[] = [];
  for (const root of runtimeCodeRoots) {
    const files = await collectFiles(root);
    for (const file of files) {
      if (isTypeScriptRuntimeFile(file)) {
        codeFiles.push(file);
      }
    }
  }
  for (const file of runtimeCodeFiles) {
    if (await pathExists(file) && isTypeScriptRuntimeFile(file)) {
      codeFiles.push(file);
    }
  }

  const baselineImportLeaks: string[] = [];
  for (const file of codeFiles) {
    const text = await Deno.readTextFile(file);
    if (scanForBaselineImportLeak(text)) {
      baselineImportLeaks.push(file);
    }
  }

  if (collidingStaticAssets.length > 0 || baselineImportLeaks.length > 0) {
    const problems: string[] = [];
    if (collidingStaticAssets.length > 0) {
      problems.push(
        "Baseline filenames were found under static/:\n" +
          collidingStaticAssets.map((p) => `  - ${p}`).join("\n"),
      );
    }
    if (baselineImportLeaks.length > 0) {
      problems.push(
        "Runtime TS/TSX files reference tests/visual/baselines/:\n" +
          baselineImportLeaks.map((p) => `  - ${p}`).join("\n"),
      );
    }
    fail(problems.join("\n\n"));
  }

  console.log(
    "[check:visual-baselines] OK: no baseline leakage into runtime assets/code.",
  );
}

await run();
