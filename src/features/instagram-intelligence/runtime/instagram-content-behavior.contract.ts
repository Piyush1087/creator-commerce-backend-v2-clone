import { createHash } from "node:crypto";
import { z } from "zod";

import type {
  ContractRegistryKey,
  VerifiedContractBundle,
} from "../../brand-intelligence/contracts/bundle/contract-bundle.types";
import { InstagramIntelligenceObjectSchema } from "../contracts/instagram-intelligence.schemas";

export const INSTAGRAM_CONTENT_BEHAVIOR_PROCESSOR_ID =
  "instagram_content_behavior" as const;
export const INSTAGRAM_CONTENT_BEHAVIOR_PROCESSOR_VERSION = "1.0" as const;
export const INSTAGRAM_CONTENT_BEHAVIOR_OUTPUT_CONTRACT_ID =
  "instagram_content_behavior_output_contract" as const;
export const INSTAGRAM_CONTENT_BEHAVIOR_OUTPUT_CONTRACT_VERSION =
  "1.0" as const;
export const INSTAGRAM_CONTENT_BEHAVIOR_OBJECT_ID =
  "instagram_content_behavior" as const;
export const INSTAGRAM_CONTENT_BEHAVIOR_BUNDLE_ID =
  "instagram_intelligence.instagram_content_behavior" as const;
export const INSTAGRAM_CONTENT_BEHAVIOR_BUNDLE_VERSION = "1.0" as const;

export const INSTAGRAM_CONTENT_BEHAVIOR_REGISTRY_KEY: ContractRegistryKey = {
  processorId: INSTAGRAM_CONTENT_BEHAVIOR_PROCESSOR_ID,
  processorVersion: INSTAGRAM_CONTENT_BEHAVIOR_PROCESSOR_VERSION,
  outputContractId: INSTAGRAM_CONTENT_BEHAVIOR_OUTPUT_CONTRACT_ID,
  outputContractVersion: INSTAGRAM_CONTENT_BEHAVIOR_OUTPUT_CONTRACT_VERSION,
};

const contractIdentity = JSON.stringify({
  objectSemanticId: INSTAGRAM_CONTENT_BEHAVIOR_OBJECT_ID,
  objectContractVersion: "1.0",
  outputContractVersion: INSTAGRAM_CONTENT_BEHAVIOR_OUTPUT_CONTRACT_VERSION,
  sourceScope: "INSTAGRAM_OWNED",
  componentSemanticPath: "$",
});

export const INSTAGRAM_CONTENT_BEHAVIOR_BUNDLE_HASH = createHash("sha256")
  .update(contractIdentity)
  .digest("hex");

export const InstagramContentBehaviorB4ValueSchema =
  InstagramIntelligenceObjectSchema.superRefine((value, context) => {
    if (value.semanticId !== INSTAGRAM_CONTENT_BEHAVIOR_OBJECT_ID) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "B4 admits only instagram_content_behavior",
        path: ["semanticId"],
      });
    }
    if (value.state !== "PARTIAL_CURRENT" || value.readiness !== "PARTIAL") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The one-post B4 proof must remain partial",
        path: ["state"],
      });
    }
    if (value.signals.length !== 0 || value.learnings.length !== 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "One post cannot produce a Signal or Learning",
        path: ["signals"],
      });
    }
    if (value.sourceScope !== "INSTAGRAM_OWNED") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "B4 is Instagram-owned only",
        path: ["sourceScope"],
      });
    }
  });

export type InstagramContentBehaviorB4Value = z.infer<
  typeof InstagramContentBehaviorB4ValueSchema
>;

export const InstagramContentBehaviorEvidenceManifestSchema = z
  .object({
    kind: z.literal("INSTAGRAM_CONTENT_BEHAVIOR_B4_INPUT_V1"),
    brandProfileId: z.string().uuid(),
    integrationId: z.string().uuid(),
    providerAccountId: z.string().min(1).max(100),
    authorizationGeneration: z.number().int().positive(),
    evidenceRef: z.string().min(1).max(255),
    windowEnd: z.string().datetime(),
  })
  .strict();

export type InstagramContentBehaviorEvidenceManifest = z.infer<
  typeof InstagramContentBehaviorEvidenceManifestSchema
>;

export const InstagramContentBehaviorPersistencePayloadSchema = z
  .object({
    kind: z.literal("INSTAGRAM_CONTENT_BEHAVIOR_B4_PERSISTENCE_V1"),
    value: InstagramContentBehaviorB4ValueSchema,
    evidence: z
      .object({
        evidenceRef: z.string().min(1).max(255),
        capabilityId: z.literal("instagram.media_visual_observations"),
        resourceRef: z.string().min(1).max(255),
        captureRef: z.string().min(1).max(255),
        captureVersion: z.string().min(1).max(255),
        capturedAt: z.string().datetime(),
        observedFreshness: z.enum(["CURRENT", "POSSIBLY_STALE", "UNKNOWN"]),
      })
      .strict(),
    account: z
      .object({
        integrationId: z.string().uuid(),
        providerAccountId: z.string().min(1).max(100),
        authorizationGeneration: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();

export type InstagramContentBehaviorPersistencePayload = z.infer<
  typeof InstagramContentBehaviorPersistencePayloadSchema
>;

export function isInstagramContentBehaviorRegistryKey(
  key: ContractRegistryKey,
): boolean {
  return (
    key.processorId === INSTAGRAM_CONTENT_BEHAVIOR_PROCESSOR_ID &&
    key.processorVersion === INSTAGRAM_CONTENT_BEHAVIOR_PROCESSOR_VERSION &&
    key.outputContractId === INSTAGRAM_CONTENT_BEHAVIOR_OUTPUT_CONTRACT_ID &&
    key.outputContractVersion ===
      INSTAGRAM_CONTENT_BEHAVIOR_OUTPUT_CONTRACT_VERSION
  );
}

export const INSTAGRAM_CONTENT_BEHAVIOR_REGISTRATION = {
  ...INSTAGRAM_CONTENT_BEHAVIOR_REGISTRY_KEY,
  bundleId: INSTAGRAM_CONTENT_BEHAVIOR_BUNDLE_ID,
  bundleVersion: INSTAGRAM_CONTENT_BEHAVIOR_BUNDLE_VERSION,
  bundleContentHash: INSTAGRAM_CONTENT_BEHAVIOR_BUNDLE_HASH,
  ownedObjectSemanticIds: [INSTAGRAM_CONTENT_BEHAVIOR_OBJECT_ID],
  ownedPathPatterns: [
    {
      objectSemanticId: INSTAGRAM_CONTENT_BEHAVIOR_OBJECT_ID,
      componentPathPattern: "$",
    },
  ],
  structuralValidatorId: "instagram_content_behavior_b4_output_v1",
  semanticValidatorId: "instagram_content_behavior_b4_semantics_v1",
  persistenceValidatorId: "intelligence_persistence_transition_v1",
  bundled: true,
  registered: true,
  executionEnabled: true,
} as const;

export const INSTAGRAM_CONTENT_BEHAVIOR_VERIFIED_BUNDLE: VerifiedContractBundle =
  {
    manifest: {
      manifestSchemaVersion: 1,
      bundleId: INSTAGRAM_CONTENT_BEHAVIOR_BUNDLE_ID,
      bundleVersion: INSTAGRAM_CONTENT_BEHAVIOR_BUNDLE_VERSION,
      ownerEngine: "instagram_intelligence",
      owningBranch: "content_behavior",
      architectureRepository: "Piyush1087/dummy_tcs",
      architectureCommitSha: "70add5add8e600359b728d1cbb728c700f50acc2",
      processorId: INSTAGRAM_CONTENT_BEHAVIOR_PROCESSOR_ID,
      processorVersion: INSTAGRAM_CONTENT_BEHAVIOR_PROCESSOR_VERSION,
      outputContractId: INSTAGRAM_CONTENT_BEHAVIOR_OUTPUT_CONTRACT_ID,
      outputContractVersion: INSTAGRAM_CONTENT_BEHAVIOR_OUTPUT_CONTRACT_VERSION,
      evidenceContractId: "instagram_content_behavior_evidence",
      evidenceContractVersion: "1.0",
      ownedObjectSemanticIds: [INSTAGRAM_CONTENT_BEHAVIOR_OBJECT_ID],
      ownedPathPatterns: [
        {
          objectSemanticId: INSTAGRAM_CONTENT_BEHAVIOR_OBJECT_ID,
          componentPathPattern: "$",
        },
      ],
      generatedNotice: "GENERATED — DO NOT EDIT",
      generatorVersion: "1.0.0",
      artifacts: [],
      bundleContentHash: INSTAGRAM_CONTENT_BEHAVIOR_BUNDLE_HASH,
    },
    artifacts: {
      processorDefinition: {
        id: INSTAGRAM_CONTENT_BEHAVIOR_PROCESSOR_ID,
        version: INSTAGRAM_CONTENT_BEHAVIOR_PROCESSOR_VERSION,
      },
      reasoningContract: {
        id: "instagram_content_behavior_reasoning",
        version: "1.0",
      },
      outputContract: {
        id: INSTAGRAM_CONTENT_BEHAVIOR_OUTPUT_CONTRACT_ID,
        version: INSTAGRAM_CONTENT_BEHAVIOR_OUTPUT_CONTRACT_VERSION,
        shared_generated_metadata: {
          fields: {
            authority: { values: ["CREATOR_SHOP_DERIVED"] },
          },
        },
      },
      evidenceContract: {
        id: "instagram_content_behavior_evidence",
        version: "1.0",
        source_scope: "INSTAGRAM_OWNED",
        capability_id: "instagram.media_visual_observations",
      },
      objectContract: {
        engine: "instagram_intelligence",
        object: INSTAGRAM_CONTENT_BEHAVIOR_OBJECT_ID,
        component: "$",
      },
      sharedMetadataContract: { contract: "shared_intelligence_metadata" },
    },
  };
