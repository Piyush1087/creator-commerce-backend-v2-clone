import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("shared Intelligence owner-scope architecture", () => {
  it("keeps Settings lifecycle adapters domain-isolated", () => {
    const brand = readFileSync(
      resolve("src/features/brand-settings/brand-settings.module.ts"),
      "utf8",
    );
    const creator = readFileSync(
      resolve("src/features/creator-settings/creator-settings.module.ts"),
      "utf8",
    );
    expect(brand).not.toContain("features/creator-settings");
    expect(creator).not.toContain("features/brand-settings");
  });

  it("uses one shared owner-scope repository and no Creator-only DE/current store", () => {
    const source = readFileSync(
      resolve(
        "src/features/data-extraction/evidence/ownership/intelligence-owner-scope.repository.ts",
      ),
      "utf8",
    );
    expect(source).toContain("IntelligenceOwnerScopeRepository");
    expect(source).toContain("intelligenceOwnerScope");
    expect(source).not.toContain("CreatorDataExtraction");
    expect(source).not.toContain("CreatorIntelligenceCurrent");
  });
});
