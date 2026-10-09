import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // Tests always run in Demo data mode: unconfigured env means repositories
    // fall back to Phase 1 fixtures and never touch the network.
    env: {
      NEXT_PUBLIC_RECALLRELAY_ENV: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
    },
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
