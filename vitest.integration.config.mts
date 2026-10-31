import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    setupFiles: ["tests/integration/setup-env.ts"],
    hookTimeout: 60_000,
    testTimeout: 30_000,
    // Les suites créent leurs propres comptes et doivent s'exécuter séquentiellement.
    fileParallelism: false,
  },
});
