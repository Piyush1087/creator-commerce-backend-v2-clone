import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("brand_communication architecture boundary", () => {
  it("keeps executor and persistence code outside acquisition, normalization, Preview, API and legacy boundaries", () => {
    const root = resolve(
      process.cwd(),
      "src/features/brand-intelligence/processors/brand-communication",
    );
    for (const file of [
      "brand-communication-processor.executor.ts",
      "brand-communication-persistence.hook.ts",
    ]) {
      const source = readFileSync(resolve(root, file), "utf8");
      expect(source).not.toMatch(
        /data-extraction\/(evidence\/)?(acquisition|normalization)|brand-preview|stage1b|controller|resolver|legacy[\/_-]?identity|frontend/iu,
      );
    }
  });
});
