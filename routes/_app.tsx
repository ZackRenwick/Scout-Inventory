import { type PageProps } from "fresh";
import { APP_MODE } from "../lib/mode.ts";

const THEME_COLOR = APP_MODE === "upgrade" ? "#d97706" : "#7c3aed";

// Read the Vite client manifest once at startup to inject modulepreload hints
// for every island chunk. Fresh v2 SPA navigation dynamically imports island
// JS only after receiving the HTML response, creating a waterfall:
//   fetch HTML → parse → import island chunks → swap DOM
// By preloading all island chunks up-front the browser fetches them in parallel
// with the first page render so subsequent navigations find them already cached.
// All entries are content-hashed → safe to preload eagerly.
let _islandPreloads: string[] = [];
try {
  const raw = Deno.readTextFileSync(
    `${Deno.cwd()}/_fresh/client/.vite/manifest.json`,
  );
  const manifest = JSON.parse(raw) as Record<string, { file?: string }>;
  const seen = new Set<string>();
  for (const entry of Object.values(manifest)) {
    if (entry.file && entry.file.endsWith(".js") && !seen.has(entry.file)) {
      seen.add(entry.file);
      _islandPreloads.push(`/_fresh/client/${entry.file}`);
    }
  }
} catch {
  // graceful degradation — no preload hints if manifest unavailable (e.g. dev)
}

export default function App({ Component }: PageProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
          name="description"
          content="Scout troop inventory management — track gear, supplies, and equipment."
        />
        <meta name="theme-color" content={THEME_COLOR} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Scout Inventory" />
        <title>scout-inventory</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        {_islandPreloads.map((href) => (
          <link rel="modulepreload" href={href} />
        ))}
        <script src="/theme-init.js"></script>
        <script src="/sw-register.js" defer={true}></script>
      </head>
      <body>
        <Component />
      </body>
    </html>
  );
}
