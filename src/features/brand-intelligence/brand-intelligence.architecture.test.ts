import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { IntelligenceGenerationRepository } from "./persistence/intelligence-generation.repository";

describe("Brand Intelligence module boundary", () => {
  it("does not expose update or delete APIs for immutable history", () => {
    expect(IntelligenceGenerationRepository.prototype).not.toHaveProperty(
      "update",
    );
    expect(IntelligenceGenerationRepository.prototype).not.toHaveProperty(
      "delete",
    );
    expect(IntelligenceGenerationRepository.prototype).not.toHaveProperty(
      "remove",
    );
  });

  it("contains no legacy semantic dual-write dependency", () => {
    const root = join(process.cwd(), "src", "features", "brand-intelligence");
    const files = [
      "brand-intelligence.module.ts",
      "persistence/intelligence-generation.repository.ts",
      "persistence/intelligence-current-state.repository.ts",
      "persistence/intelligence-candidate.repository.ts",
      "persistence/intelligence-action.repository.ts",
      "transitions/intelligence-transition.service.ts",
    ];
    const source = files
      .map((file) => readFileSync(join(root, file), "utf8"))
      .join("\n");
    for (const forbidden of [
      ".brandProfile.update",
      ".brandProfile.upsert",
      ".brandPreviewRun.",
      ".brandIntelligenceScan.",
      "strategicDna",
      "visualIdentity",
      "targetAudience",
      "brandValues",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
