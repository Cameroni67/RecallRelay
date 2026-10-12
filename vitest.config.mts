import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // The LiteSVM suite exercises the compiled .so over native bindings and
    // runs under `npm run test:sbf` in WSL; exclude it (and its emit output)
    // from the default jsdom run, which cannot load native Solana modules.
    exclude: ["**/node_modules/**", ".sbf-test-build/**", ".sbf-test-run/**", "src/lib/solana/**"],
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
