/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      zod: fileURLToPath(new URL("./node_modules/zod/index.js", import.meta.url)),
    },
  },
  test: {
    include: [
      "src/**/*.test.ts",
      "../../../backend/campaign/**/*.test.ts",
      "../../../backend/validation/campaign/**/*.test.ts",
    ],
  },
});
