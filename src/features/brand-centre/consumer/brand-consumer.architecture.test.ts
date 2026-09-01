import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applicationField,
  BRAND_CONSUMER_OBJECTS,
  intelligenceField,
} from "./brand-consumer.mapper";
import {
  BRAND_PROCESSOR_IDS,
  BRAND_PROCESSOR_OBJECT_OWNERSHIP,
} from "./processor-runtime-projection.types";
import type { CurrentIntelligenceObjectProjection } from "../../brand-intelligence/projection/intelligence-current-projection.types";
import {
  CURRENT_READ_AUTHORITY,
  READ_ONLY_OBJECT_CONTRACTS,
} from "../../brand-intelligence/projection/current-read-contracts.generated";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
describe("Brand consumer boundaries", () => {
  it("read route has existing auth guards and no supplied Brand-ID or mutations", () => {
    const source = read(
      "src/features/brand-centre/consumer/brand-consumer.controller.ts",
    );
    expect(source).toContain("@UseGuards(ThrottlerGuard, JwtAuthGuard)");
    expect(source).toContain('@Get("brand")');
    expect(source).not.toMatch(/@(Post|Patch|Delete|Put|Param|Query)\(/u);
  });
  it("consumer uses accepted current projection, never generation/Preview/legacy fallback reads", () => {
    const source = read(
      "src/features/brand-centre/consumer/brand-consumer.service.ts",
    );
    expect(source).toContain("this.intelligence.readObject");
    for (const forbidden of [
      "intelligenceObjectGeneration",
      "intelligenceComponentGeneration",
      "brandPreview",
      ".strategicDna",
      ".visualIdentity",
      "generateJson",
      "fetch(",
    ])
      expect(source).not.toContain(forbidden);
  });
  it("projects exactly seven processor runtimes from durable processor executions and frozen ownership", () => {
    expect(BRAND_PROCESSOR_IDS).toEqual([
      "brand_communication",
      "brand_meaning",
      "brand_character",
      "audience_persona_synthesis",
      "brand_differentiation",
      "visual_style_synthesis",
      "serviceability_synthesis",
    ]);
    expect(
      Object.values(BRAND_PROCESSOR_OBJECT_OWNERSHIP).flat().sort(),
    ).toEqual([...BRAND_CONSUMER_OBJECTS].sort());
    const source = read(
      "src/features/brand-centre/consumer/processor-runtime-projection.service.ts",
    );
    expect(source).toContain(
      "this.prisma.intelligenceProcessorExecution.findFirst",
    );
    expect(source).toContain(
      "where: { brandId, subjectId: subject.id, processorId }",
    );
    expect(source).not.toContain("synthetic_test_processor");
    expect(source).not.toContain("intelligenceExecution.findFirst");
    expect(source).not.toContain("brandCentreJob.findFirst");
  });
  it("read-only scopes are frozen/pinned and do not introduce executable registrations", () => {
    expect(CURRENT_READ_AUTHORITY).toBe(
      "a6bed1f28564c002f7d76931de0b4dd960ea5ae1",
    );
    expect(READ_ONLY_OBJECT_CONTRACTS.map((c) => c.objectSemanticId)).toEqual([
      "differentiation_and_proof",
      "audience_personas",
      "visual_style_profile",
      "serviceability_profile",
    ]);
    for (const scope of READ_ONLY_OBJECT_CONTRACTS)
      expect(scope.authoritySha256).toMatch(/^[a-f0-9]{64}$/u);
  });
  it("scan path no longer destroys Locations/Offering references or calls approval services", () => {
    const source = read(
      "src/features/brand-onboarding/surface-scan/http-brand-surface-scan.runner.ts",
    );
    expect(source).not.toMatch(/(?:location|offering)\.deleteMany/u);
    expect(source).toContain("this.locations.reconcile(");
    for (const path of [
      "src/features/brand-centre/workers/deep-scan.worker.ts",
      "src/features/brand-onboarding/surface-scan/http-brand-surface-scan.runner.ts",
      "src/features/brand-onboarding/brand-profile.service.ts",
      "src/features/brand-onboarding/surface-scan/stage1a/core-identity-confirmation.service.ts",
    ])
      expect(read(path)).not.toMatch(
        /confirmLogo|confirmLegacyIdentity|brandVisual(?:State|Asset|Color|Typography)\./u,
      );
  });
  it("missing is not null/empty and failed runtime cannot be a result readiness", () => {
    expect(applicationField("palette", null, null).current).toEqual({
      kind: "NO_CURRENT",
    });
    expect(applicationField("palette", [], "BRAND_CONFIRMED").current).toEqual({
      kind: "VALUE",
      value: [],
    });
    const object: CurrentIntelligenceObjectProjection = {
      brandId: "brand",
      objectSemanticId: "brand_description",
      objectContract: null,
      objectContractVersions: [],
      outputContract: null,
      objectState: "CURRENT",
      assembledValue: { state: "EXPLICIT_NULL" },
      consumerReadiness: "NOT_READY",
      resultReadiness: "NOT_READY",
      freshness: "UNKNOWN",
      authority: null,
      sourceClass: null,
      mixedGeneration: false,
      mixedContractVersion: false,
      components: [],
      candidateSummary: {
        status: "NONE",
        pendingCount: 0,
        currentPreserved: false,
        summaryAvailable: false,
        rawCandidateVisible: false,
      },
    };
    expect(intelligenceField(object)).toMatchObject({
      current: { kind: "EXPLICIT_NULL" },
      resultReadiness: "NOT_READY",
    });
  });
});
