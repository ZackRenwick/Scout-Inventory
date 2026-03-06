import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    fresh(),
    tailwindcss(),
  ],
  resolve: {
    // Ensure only one copy of Preact is bundled — avoids `__H` / hooks context errors
    // when @preact/signals and preact-render-to-string each try to bring their own copy.
    dedupe: ["preact", "preact/hooks", "preact/jsx-runtime", "@preact/signals"],
  },
  ssr: {
    // Force Preact + signals to bundle together so there's only one shared
    // options/hooks object — prevents the `__H` undefined crash on SSR.
    noExternal: ["preact", "preact/hooks", "preact/jsx-runtime", "preact-render-to-string", "@preact/signals"],
    // Let Deno handle all jsr:, npm:, and mapped specifiers at runtime
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
