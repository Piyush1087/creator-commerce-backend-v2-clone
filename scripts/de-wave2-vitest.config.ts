import { resolve } from "node:path";
import { mergeConfig } from "vitest/config";
import base from "../vitest.config";

export default mergeConfig(base, {
  test: {
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    setupFiles: [resolve(__dirname, "de-wave2-test-isolation.ts")],
  },
});
