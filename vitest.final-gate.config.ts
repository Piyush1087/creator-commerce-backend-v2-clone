import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "scripts/canonical-reconciliation/final-gate/**/*.fixture.test.ts",
    ],
  },
});
