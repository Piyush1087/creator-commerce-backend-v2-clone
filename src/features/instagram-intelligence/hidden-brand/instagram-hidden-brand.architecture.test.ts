import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (name: string) => readFileSync(resolve(__dirname, name), "utf8");

describe("D_COMBINED generation-only architecture", () => {
  it("has no public controller and fixes source scope to Instagram-owned", () => {
    const moduleSource = source("../instagram-intelligence.module.ts");
    const reader = source("instagram-hidden-brand.reader.ts");
    expect(moduleSource).not.toContain("InstagramHiddenBrandController");
    expect(reader).toContain('equals: "INSTAGRAM_OWNED"');
    expect(reader).not.toMatch(/intelligence(Current|Candidate)/u);
  });

  it("uses shared generation persistence without current, candidate or transition writes", () => {
    const persistence = source("instagram-hidden-brand.persistence.ts");
    expect(persistence).toContain("IntelligenceGenerationRepository");
    expect(persistence).toContain("persistInTransaction");
    expect(persistence).not.toMatch(
      /Intelligence(CurrentState|Candidate)Repository|IntelligenceTransitionService|applyCurrent/iu,
    );
    expect(persistence).toContain("supersedesObjectGenerationId: null");
    expect(persistence).toContain("supersedesComponentGenerationId: null");
  });

  it("registers only the exact RUN processors and no parallel Instagram processor family", () => {
    const runtime = source("instagram-hidden-brand.runtime.ts");
    expect(runtime).toContain('processorId: "brand_character"');
    expect(runtime).toContain('processorId: "brand_communication"');
    expect(runtime).toContain('processorId: "visual_style_synthesis"');
    expect(runtime).not.toMatch(/processorId:\s*"instagram_brand_/u);
    expect(runtime).not.toContain("serviceability_synthesis");
  });
});
