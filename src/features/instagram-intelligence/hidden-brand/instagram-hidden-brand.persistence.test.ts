import { IntelligenceReadiness } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { ComponentPathCodec } from "../../brand-intelligence/semantic-path/component-path.codec";
import { InstagramHiddenBrandPersistenceHook } from "./instagram-hidden-brand.persistence";

function fixture() {
  const evidence = {
    brandId: "brand-1",
    evidenceRef: "evidence:caption:1",
    capabilityId: "instagram.caption_context",
    captureRef: "capture-1",
    captureVersion: "capture-1",
    sourceClass: "INSTAGRAM_OWNED",
    capturedAt: "2026-09-11T00:00:00.000Z",
    freshness: { state: "CURRENT" },
  };
  const metadata = {
    authority: "CREATOR_SHOP_DERIVED",
    source_class: "INSTAGRAM_OWNED",
    freshness: "CURRENT",
    evidence_refs: [evidence.evidenceRef],
  };
  const execution = {
    id: "processor-1",
    brandId: "brand-1",
    processorId: "brand_communication",
    processorVersion: "1.0",
    outputContractId: "brand_communication_output_contract",
    outputContractVersion: "1.0",
    bundleId: "brand_intelligence.brand_communication",
    bundleVersion: "1.0",
    bundleHash: "b".repeat(64),
    dependencyManifestHash: "dependency-hash",
    evidenceManifestHash: "evidence-hash",
    evidenceManifest: {
      sourceProfile: {
        sourceProfileVersion: "1.1",
        sourceScope: "INSTAGRAM_OWNED",
        providerAccountId: "account-1",
        authorizationGeneration: 7,
        windowStart: "2026-08-13T00:00:00.000Z",
        windowEnd: "2026-09-12T00:00:00.000Z",
      },
    },
    activeScope: [
      {
        brandId: "brand-1",
        objectSemanticId: "communication_profile",
        pathSchemeVersion: 1,
        componentSemanticPath: "$",
      },
      {
        brandId: "brand-1",
        objectSemanticId: "communication_profile",
        pathSchemeVersion: 1,
        componentSemanticPath: "$/f/free_text_guidance",
      },
    ],
    activeScopeHash: "scope-hash",
  };
  const result = {
    readiness: IntelligenceReadiness.PARTIAL,
    telemetry: {},
    persistencePayload: {
      kind: "BRAND_COMMUNICATION_V1",
      output: {
        communication_profile: {
          tone_traits: null,
          free_text_guidance: "Use concise captions.",
          communication_constraints: null,
          primary_language: null,
        },
        output_metadata: {
          tone_traits: null,
          free_text_guidance: metadata,
          communication_constraints: null,
          primary_language: null,
        },
      },
      prepared: {
        dependencyManifestHash: "dependency-hash",
        evidenceManifestHash: "evidence-hash",
        evidence: {
          capabilityResults: [{ evidence: [evidence] }],
        },
      },
    },
  };
  return {
    claim: { processorExecution: execution, attempt: { id: "attempt-1" } },
    result,
  };
}

describe("Instagram hidden Brand generation persistence", () => {
  it("writes deterministic immutable generations and exact component Evidence refs", async () => {
    const persistInTransaction = vi.fn(async () => undefined);
    const hook = new InstagramHiddenBrandPersistenceHook(
      { persistInTransaction } as never,
      new ComponentPathCodec(),
    );
    const { claim, result } = fixture();
    await hook.persistBeforeCompletion({} as never, claim as never, result);
    await hook.persistBeforeCompletion({} as never, claim as never, result);
    expect(persistInTransaction).toHaveBeenCalledTimes(2);
    const first = persistInTransaction.mock.calls[0][1];
    const replay = persistInTransaction.mock.calls[1][1];
    expect(replay).toEqual(first);
    expect(first.object).toMatchObject({
      brandId: "brand-1",
      objectSemanticId: "communication_profile",
      basedOnObjectGenerationId: null,
      supersedesObjectGenerationId: null,
      objectMetadataPayload: expect.objectContaining({
        sourceScope: "INSTAGRAM_OWNED",
        sourceProfileVersion: "1.1",
        providerAccountId: "account-1",
        authorizationGeneration: 7,
      }),
    });
    expect(first.components).toHaveLength(2);
    expect(first.evidenceReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          componentSemanticPath: "$/f/free_text_guidance",
          evidenceRef: "evidence:caption:1",
          capabilityId: "instagram.caption_context",
          sourceClass: "INSTAGRAM_OWNED",
        }),
      ]),
    );
  });

  it("fails closed before publication for an unknown field Evidence reference", async () => {
    const hook = new InstagramHiddenBrandPersistenceHook(
      { persistInTransaction: vi.fn() } as never,
      new ComponentPathCodec(),
    );
    const { claim, result } = fixture();
    const payload = result.persistencePayload.output.output_metadata;
    payload.free_text_guidance.evidence_refs = ["evidence:other"];
    await expect(
      hook.persistBeforeCompletion({} as never, claim as never, result),
    ).rejects.toThrow("INSTAGRAM_HIDDEN_BRAND_UNKNOWN_EVIDENCE_REF");
  });
});
