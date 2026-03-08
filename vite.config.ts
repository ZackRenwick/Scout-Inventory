import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin } from "vite";

// Vite plugin that externalizes preact and @preact/signals ONLY for the SSR
// (server) environment build. The Fresh plugin builds two environments:
//   - client: must bundle these packages so the browser has the code
//   - ssr:    must keep them external so Deno resolves them via deno.json's
//             import map at runtime → single shared instance → no __H crash
//
// Without this, the SSR bundle gets a bundled preact/hooks wired to a local
// `l$2` options object while the Fresh renderer uses the externally-resolved
// options$1 from `npm:preact@^10.27.2` — two separate instances — causing
// "Cannot read properties of undefined (reading '__H')".
const ssrPreactExternalPlugin: Plugin = {
  name: "ssr-externalize-preact",
  applyToEnvironment(env) {
    return env.name === "ssr";
  },
  options(opts) {
    const prev = opts.external;
    opts.external = (id: string, importer: string | undefined, isResolved: boolean) => {
      if (
        // Preact must be external so Deno resolves it → single shared instance → no __H crash
        id === "preact" ||
        id.startsWith("preact/") ||
        id === "@preact/signals" ||
        id.startsWith("@preact/signals/") ||
        // Deno-native specifiers that cannot be bundled (server-only)
        id.startsWith("$std/") ||
        id.startsWith("jsr:") ||
        id.startsWith("npm:") ||
        id === "bcryptjs" ||
        id.startsWith("bcryptjs/")
      ) {
        return true;
      }
      if (typeof prev === "function") { 
        return prev(id, importer, isResolved); 
      }
      if (Array.isArray(prev)) { 
        return prev.includes(id); 
      }
      return false;
    };
    return opts;
  },
};

export default defineConfig({
  plugins: [
    fresh(),
    tailwindcss(),
    ssrPreactExternalPlugin,
  ],
  resolve: {
    // Single copy of Preact in client bundles — avoids duplicate hooks context in browser.
    dedupe: ["preact", "preact/hooks", "preact/jsx-runtime", "@preact/signals"],
  },
});
