import { GUARDS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it, vi } from "vitest";

import { ContractBundleIntegrityVerifier } from "../brand-intelligence/contracts/bundle/contract-bundle.integrity";
import { ContractRuntimeRegistry } from "../brand-intelligence/contracts/registry/contract-runtime.registry";
import { SemanticValidator } from "../brand-intelligence/contracts/validation/semantic.validator";
import { StructuralValidator } from "../brand-intelligence/contracts/validation/structural.validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { InstagramB4ConsumerController } from "./consumer/instagram-b4-consumer.controller";
import { INSTAGRAM_CONTENT_BEHAVIOR_REGISTRY_KEY } from "./runtime/instagram-content-behavior.contract";

function validationContext(
  bundle: ReturnType<ContractRuntimeRegistry["getVerifiedBundle"]>,
) {
  return {
    bundle,
    evidenceManifest: [
      {
        evidenceRef: "evidence:one",
        capabilityId: "instagram.media_visual_observations",
        semanticId: "instagram.media_visual_observations",
        revisionIdentity: "capture:one:1",
        sourceClass: "INSTAGRAM_OWNED",
      },
    ],
    businessStateManifest: [],
  };
}

describe("Instagram Intelligence B4 admission and consumer controller", () => {
  it("admits only the exact 1.0 root contract without mutating generated bundles", () => {
    const registry = new ContractRuntimeRegistry(
      new ContractBundleIntegrityVerifier(),
      new SemanticValidator(),
    );
    registry.verifyAtRoot(
      `${process.cwd()}/src/features/brand-intelligence/generated/contract-bundles`,
    );
    const bundle = registry.getVerifiedBundle(
      INSTAGRAM_CONTENT_BEHAVIOR_REGISTRY_KEY,
    );
    expect(bundle.manifest).toMatchObject({
      processorId: "instagram_content_behavior",
      processorVersion: "1.0",
      outputContractId: "instagram_content_behavior_output_contract",
      outputContractVersion: "1.0",
      ownedObjectSemanticIds: ["instagram_content_behavior"],
      ownedPathPatterns: [
        {
          objectSemanticId: "instagram_content_behavior",
          componentPathPattern: "$",
        },
      ],
    });
    expect(
      registry
        .registrations()
        .filter((entry) => entry.processorId === "instagram_content_behavior"),
    ).toHaveLength(1);
  });

  it("resolves the active Brand server-side and never accepts a Brand selector", async () => {
    const auth = {
      resolveBrandProfileId: vi.fn().mockResolvedValue("server-brand"),
    };
    const consumer = {
      read: vi.fn().mockResolvedValue({ contractVersion: "b4-proof-1.0" }),
    };
    const controller = new InstagramB4ConsumerController(
      auth as never,
      consumer as never,
    );
    const user = { id: "user", role: "BRAND", sessionId: "session" };
    await expect(controller.read({ user } as never)).resolves.toEqual({
      contractVersion: "b4-proof-1.0",
    });
    expect(auth.resolveBrandProfileId).toHaveBeenCalledWith(user);
    expect(consumer.read).toHaveBeenCalledWith("server-brand");
    expect(controller.read.length).toBe(1);
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      InstagramB4ConsumerController,
    ) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
  });

  it("runs registered structural and Instagram semantic validation", () => {
    const semantic = new SemanticValidator();
    const registry = new ContractRuntimeRegistry(
      new ContractBundleIntegrityVerifier(),
      semantic,
    );
    registry.verifyAtRoot(
      `${process.cwd()}/src/features/brand-intelligence/generated/contract-bundles`,
    );
    const bundle = registry.getVerifiedBundle(
      INSTAGRAM_CONTENT_BEHAVIOR_REGISTRY_KEY,
    );
    expect(semantic.registeredValidatorIds()).toContain(
      "instagram_content_behavior",
    );
    expect(new StructuralValidator().validate(bundle, {}).valid).toBe(false);
    const valid = {
      semanticId: "instagram_content_behavior",
      objectContractVersion: "1.0",
      outputContractVersion: "1.0",
      sourceScope: "INSTAGRAM_OWNED",
      state: "PARTIAL_CURRENT",
      readiness: "PARTIAL",
      freshness: "CURRENT",
      currentPreserved: false,
      generatedAt: "2026-09-11T10:00:01.000Z",
      window: {
        start: "2026-08-12T10:00:01.000Z",
        end: "2026-09-11T10:00:01.000Z",
        days: 30,
      },
      results: [],
      signals: [],
      learnings: [],
      components: {
        window: {
          state: "AVAILABLE",
          value: {
            start: "2026-08-12T10:00:01.000Z",
            end: "2026-09-11T10:00:01.000Z",
            days: 30,
          },
        },
        corpus_summary: {
          state: "AVAILABLE",
          value: {
            eligiblePostCount: 1,
            observedPostCount: 1,
            deepInspectedImageCount: 1,
          },
        },
        posting_cadence: {
          state: "UNKNOWN",
          reasonCode: "INSUFFICIENT_EVIDENCE",
        },
        format_mix: {
          state: "AVAILABLE",
          value: {
            observedCounts: { IMAGE: 1 },
            broaderMix: {
              state: "UNKNOWN",
              reasonCode: "INSUFFICIENT_EVIDENCE",
            },
          },
        },
        theme_patterns: {
          state: "UNKNOWN",
          reasonCode: "INSUFFICIENT_EVIDENCE",
        },
        caption_patterns: {
          state: "UNKNOWN",
          reasonCode: "INSUFFICIENT_EVIDENCE",
        },
        creative_structure_patterns: {
          state: "UNKNOWN",
          reasonCode: "INSUFFICIENT_EVIDENCE",
        },
        offering_presence_patterns: {
          state: "UNKNOWN",
          reasonCode: "INSUFFICIENT_EVIDENCE",
        },
        creator_presence_patterns: {
          state: "UNKNOWN",
          reasonCode: "INSUFFICIENT_EVIDENCE",
        },
        representative_media_refs: {
          state: "AVAILABLE",
          value: [
            {
              mediaType: "IMAGE",
              resourceRef: "resource",
              captureRef: "capture",
              evidenceRefs: ["evidence:one"],
              visualObservation: {
                description: "blue object",
                visibleElements: [],
                dominantColors: ["blue"],
                composition: "centered",
              },
            },
          ],
        },
        bounded_learnings: {
          state: "INTENTIONALLY_ABSENT",
          reasonCode: "INSUFFICIENT_SAMPLE",
        },
        coverage: {
          state: "AVAILABLE",
          value: {
            eligibleCount: 1,
            observedCount: 1,
            deepInspectedCount: 1,
            unavailableCount: 0,
            notInspectedCount: 0,
          },
        },
      },
      coverage: {
        state: "COMPLETE",
        eligibleCount: 1,
        observedCount: 1,
        coveragePercent: 100,
        reasonCodes: [],
      },
      evidenceRefs: ["evidence:one"],
    };
    const context = validationContext(bundle);
    expect(new StructuralValidator().validate(bundle, valid).valid).toBe(true);
    expect(semantic.validate(valid, context).valid).toBe(true);
    expect(
      semantic.validate(
        {
          ...valid,
          components: {
            ...valid.components,
            theme_patterns: { state: "AVAILABLE", value: ["unsupported"] },
          },
        },
        context,
      ).valid,
    ).toBe(false);
    expect(
      semantic.validate(
        {
          ...valid,
          components: {
            ...valid.components,
            bounded_learnings: {
              state: "AVAILABLE",
              value: ["unsupported"],
            },
          },
        },
        context,
      ).valid,
    ).toBe(false);
    for (const invalid of [
      { ...valid, sourceScope: "OWNED_WEBSITE" },
      { ...valid, signals: [{}] },
      { ...valid, learnings: [{}] },
    ]) {
      expect(semantic.validate(invalid, context).valid).toBe(false);
    }
  });
});
