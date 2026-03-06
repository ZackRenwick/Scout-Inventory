import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    fresh(),
    tailwindcss(),
  ],
  resolve: {
    // Single copy of Preact in client bundles — avoids duplicate hooks context in browser.
    dedupe: ["preact", "preact/hooks", "preact/jsx-runtime", "@preact/signals"],
  },
  ssr: {
    // Let Deno resolve all npm packages (including Preact) at runtime so every
    // module shares the same instance. The @fresh/plugin-vite server-entry uses
    // `npm:preact@^10.27.2` specifiers directly — if we also bundle a separate
    // Preact copy via noExternal, two instances exist and `options.__H` is
    // undefined on the Fresh copy → "__H" crash in production.
    external: true,
  },
  build: {
    rollupOptions: {
      // Externalize Deno-native specifiers and CJS packages that break when bundled into ESM
      external: (id: string) =>
        id.startsWith("$std/") ||
        id.startsWith("jsr:") ||
        id.startsWith("npm:") ||
        id === "bcryptjs" ||
        id.startsWith("bcryptjs/"),
    },
  },
});
