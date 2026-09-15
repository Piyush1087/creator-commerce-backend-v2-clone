import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUDIENCE_V1_PATHS,
  AudienceV1ConsumerSchema,
} from "./creator-audience-v1.contract";
import { CREATOR_AUDIENCE_COMPONENT_PATHS } from "../creator-audience/creator-audience-runtime.contract";
import { audienceV1VerifiedContract } from "./creator-audience-v1.runtime";
import { ContractRuntimeRegistry } from "../brand-intelligence/contracts/registry/contract-runtime.registry";
import { ContractBundleIntegrityVerifier } from "../brand-intelligence/contracts/bundle/contract-bundle.integrity";
import { SemanticValidator } from "../brand-intelligence/contracts/validation/semantic.validator";

const source = (name: string) =>
  readFileSync(resolve(__dirname, `creator-audience-v1.${name}.ts`), "utf8");
describe("Audience V1 shared lifecycle and domain boundaries", () => {
  it("owns only four disjoint paths on the existing Audience Object", () => {
    expect(
      AUDIENCE_V1_PATHS.some((path) =>
        CREATOR_AUDIENCE_COMPONENT_PATHS.includes(path),
      ),
    ).toBe(false);
    expect(
      audienceV1VerifiedContract().registration.ownedObjectSemanticIds,
    ).toEqual(["creator_audience"]);
  });
  it("registers a verified executable bundle without changing frozen donor bundles", () => {
    const registry = new ContractRuntimeRegistry(
      new ContractBundleIntegrityVerifier(),
      new SemanticValidator(),
    );
    registry.onModuleInit();
    expect(registry.isReady()).toBe(true);
    expect(
      registry.getVerifiedBundle(audienceV1VerifiedContract().registration)
        .manifest.bundleContentHash,
    ).toBe("8133a8200f12113ada993f934dbcd40ef1a57c254ed4eb9372c36ed1b4e8c70d");
  });
  it("admits no Creator Brand or commercial inputs, credentials or provider calls", () => {
    const reader = source("source");
    expect(reader).not.toMatch(
      /creator-brand|creator-commercial|decryptField|oauthAccessTokenEncrypted|readAudienceInsights\(|readMediaInventory\(/u,
    );
    expect(reader).toContain("contentSource.readInTransaction");
    expect(reader).toContain("select:");
    expect(reader).toContain("SETTINGS_FENCE_REJECTED");
    expect(reader).toContain("AUDIENCE_REFERENCE_LINEAGE_INVALID");
  });
  it("does not directly write shared current, generation, transitions or DE rows", () => {
    const code = ["source", "pipeline", "processor", "persistence"]
      .map(source)
      .join("\n");
    expect(code).not.toMatch(
      /(?:INSERT INTO|UPDATE|DELETE FROM)\s+(?:intelligence_|data_extraction_)/iu,
    );
    expect(source("persistence")).toContain("IntelligenceGenerationRepository");
    expect(source("persistence")).toContain("IntelligenceTransitionService");
    expect(source("persistence")).toContain(
      "SOURCE_CHANGED_BEFORE_FINALIZATION",
    );
  });
  it("does not add a model, acquisition, scheduler or parallel aggregate", () => {
    const code = ["source", "pipeline", "processor"].map(source).join("\n");
    expect(code).not.toMatch(
      /\.acquire\(|\.observe\(|\.classify\(|fetch\(|Scheduler|createCapture|createEvidence/u,
    );
    expect(source("processor")).toContain("modelCalls: 0");
    expect(source("pipeline")).toContain("createOrReturnOwnerScoped");
    expect(source("pipeline")).toContain("CURRENT_PRESERVED");
  });
  it("keeps history and context bounded and fail-closed in the consumer schema", () => {
    expect(
      AudienceV1ConsumerSchema.safeParse({ persona: "invented" }).success,
    ).toBe(false);
    expect(source("source")).toContain("LIMIT 63");
    expect(source("calculator")).toContain("trendInterpretationEligible");
    expect(source("calculator")).toContain(
      "SEPARATE_SOURCE_FACTS_NOT_AUDIENCE_PREFERENCE",
    );
  });
});
