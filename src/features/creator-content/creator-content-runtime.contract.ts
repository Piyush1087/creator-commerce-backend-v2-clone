import { z } from "zod";

import type {
  ContractRegistryKey,
  VerifiedContractBundle,
} from "../brand-intelligence/contracts/bundle/contract-bundle.types";
import { sha256Canonical } from "../brand-intelligence/contracts/bundle/canonical-json";
import type { GeneratedContractRegistration } from "../brand-intelligence/contracts/bundle/contract-bundle.integrity";
import {
  CREATOR_CONTENT_COMPONENTS,
  CREATOR_CONTENT_V0_CONTRACT_VERSION,
  CREATOR_CONTENT_V0_OBJECT_ID,
  CreatorContentConsumerSchema,
} from "./contracts/creator-content-v0.contract";

export const CREATOR_CONTENT_PROCESSOR_ID = "creator_content_v0" as const;
export const CREATOR_CONTENT_PROCESSOR_VERSION = "1.0" as const;
export const CREATOR_CONTENT_OUTPUT_CONTRACT_ID =
  "creator_content_v0_output_contract" as const;
export const CREATOR_CONTENT_OUTPUT_CONTRACT_VERSION = "1.0" as const;
export const CREATOR_CONTENT_BUNDLE_ID =
  "creator_intelligence.creator_content_v0" as const;
export const CREATOR_CONTENT_BUNDLE_VERSION = "1.0" as const;
export const CREATOR_CONTENT_COMPONENT_PATHS = CREATOR_CONTENT_COMPONENTS.map(
  (name) => `$/f/${name}`,
);

export const CREATOR_CONTENT_REGISTRY_KEY = Object.freeze({
  processorId: CREATOR_CONTENT_PROCESSOR_ID,
  processorVersion: CREATOR_CONTENT_PROCESSOR_VERSION,
  outputContractId: CREATOR_CONTENT_OUTPUT_CONTRACT_ID,
  outputContractVersion: CREATOR_CONTENT_OUTPUT_CONTRACT_VERSION,
}) satisfies ContractRegistryKey;

const identitySchema = z
  .object({
    ownerScopeId: z.string().uuid(),
    creatorProfileId: z.string().uuid(),
    creatorWorkspaceId: z.string().uuid(),
    integrationId: z.string().uuid(),
    providerAccountId: z.string().min(1).max(100),
    authorizationGeneration: z.number().int().nonnegative(),
    requestIdentity: z.string().min(1).max(255),
    captureRef: z.string().min(1).max(255),
    resourceRef: z.string().min(1).max(255),
  })
  .strict();
const evidenceSchema = z
  .object({
    evidenceRef: z.string().min(1).max(255),
    providerMediaId: z.string().min(1).max(100),
    capturedAt: z.string().datetime(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict();
export const CreatorContentEvidenceManifestSchema = z
  .object({
    kind: z.literal("CREATOR_CONTENT_EVIDENCE_MANIFEST_V1"),
    identity: identitySchema,
    evidence: z.array(evidenceSchema).min(1).max(24),
  })
  .strict();
export const CreatorContentProcessorInputSchema = z
  .object({
    kind: z.literal("CREATOR_CONTENT_PROCESSOR_INPUT_V1"),
    value: CreatorContentConsumerSchema,
  })
  .strict();
export const CreatorContentPersistencePayloadSchema = z
  .object({
    kind: z.literal("CREATOR_CONTENT_PERSISTENCE_V1"),
    identity: identitySchema,
    value: CreatorContentConsumerSchema,
    evidence: z.array(evidenceSchema).min(1).max(24),
  })
  .strict();
export type CreatorContentEvidenceManifest = z.infer<
  typeof CreatorContentEvidenceManifestSchema
>;

export function creatorContentComponentValue(
  value: z.infer<typeof CreatorContentConsumerSchema>,
  path: string,
): unknown {
  const key = path.slice(4);
  if (key === "source_status") return value.sourceStatus;
  if (key === "content_snapshot") return value.snapshot;
  if (key === "content_highlights") return value.highlights;
  if (key === "what_you_create") return value.whatYouCreate;
  if (key === "content_performance") return value.performance;
  if (key === "representative_content") return value.representatives;
  if (key === "freshness") return value.freshness;
  if (key === "limitations") return value.limitations;
  throw new Error("CREATOR_CONTENT_UNKNOWN_COMPONENT_PATH");
}

export function creatorContentVerifiedContract(): Readonly<{
  registration: GeneratedContractRegistration;
  bundle: VerifiedContractBundle;
}> {
  const ownedPathPatterns = CREATOR_CONTENT_COMPONENT_PATHS.map(
    (componentPathPattern) => ({
      objectSemanticId: CREATOR_CONTENT_V0_OBJECT_ID,
      componentPathPattern,
    }),
  );
  const artifacts = {
    processorDefinition: {
      id: CREATOR_CONTENT_PROCESSOR_ID,
      version: CREATOR_CONTENT_PROCESSOR_VERSION,
      status: "FROZEN",
      owner_engine: "creator_intelligence",
      owning_branch: "content",
      deterministic: true,
      model_calls: "BOUNDED_PER_MEDIA_SEMANTICS_ONLY",
    },
    reasoningContract: {
      id: "creator_content_v0_reasoning",
      version: "1.0",
      status: "FROZEN",
      processor: CREATOR_CONTENT_PROCESSOR_ID,
      comparison_profile: "v0.1",
      model_receives_performance_metrics: false,
      deterministic_highlights: true,
    },
    outputContract: {
      id: CREATOR_CONTENT_OUTPUT_CONTRACT_ID,
      version: CREATOR_CONTENT_OUTPUT_CONTRACT_VERSION,
      status: "FROZEN",
      processor: CREATOR_CONTENT_PROCESSOR_ID,
      response: { type: "object" },
      shared_generated_metadata: {
        fields: {
          authority: { type: "enum", values: ["CREATOR_SHOP_DERIVED"] },
        },
      },
    },
    evidenceContract: {
      id: "creator_content_v0_evidence",
      version: "1.0",
      status: "FROZEN",
      processor: CREATOR_CONTENT_PROCESSOR_ID,
      capabilities: { "instagram.media_insights": {} },
    },
    objectContract: {
      contract: "creator_content_v0_object",
      version: "1.0",
      status: "FROZEN",
      objects: [{ id: CREATOR_CONTENT_V0_OBJECT_ID }],
    },
    sharedMetadataContract: {
      contract: "shared_intelligence_metadata",
      version: "1.0",
      status: "FROZEN",
    },
  };
  const identity = {
    manifestSchemaVersion: 1 as const,
    bundleId: CREATOR_CONTENT_BUNDLE_ID,
    bundleVersion: CREATOR_CONTENT_BUNDLE_VERSION,
    ownerEngine: "creator_intelligence",
    owningBranch: "content",
    architectureRepository: "Piyush1087/dummy_tcs",
    architectureCommitSha: "36dfa86035b3637ad8d6c0825f1f8c158cd1c885",
    processorId: CREATOR_CONTENT_PROCESSOR_ID,
    processorVersion: CREATOR_CONTENT_PROCESSOR_VERSION,
    outputContractId: CREATOR_CONTENT_OUTPUT_CONTRACT_ID,
    outputContractVersion: CREATOR_CONTENT_OUTPUT_CONTRACT_VERSION,
    evidenceContractId: "creator_content_v0_evidence",
    evidenceContractVersion: "1.0",
    ownedObjectSemanticIds: [CREATOR_CONTENT_V0_OBJECT_ID],
    ownedPathPatterns,
    generatedNotice: "GENERATED — DO NOT EDIT" as const,
    generatorVersion: "1.0.0" as const,
  };
  const bundleContentHash = sha256Canonical({ identity, artifacts });
  return {
    registration: {
      ...CREATOR_CONTENT_REGISTRY_KEY,
      bundleId: CREATOR_CONTENT_BUNDLE_ID,
      bundleVersion: CREATOR_CONTENT_BUNDLE_VERSION,
      bundleContentHash,
      ownedObjectSemanticIds: [CREATOR_CONTENT_V0_OBJECT_ID],
      ownedPathPatterns,
      structuralValidatorId: "contract_output_schema_v1",
      semanticValidatorId: CREATOR_CONTENT_PROCESSOR_ID,
      persistenceValidatorId: "intelligence_persistence_transition_v1",
      bundled: true,
      registered: true,
      executionEnabled: true,
    },
    bundle: {
      manifest: { ...identity, artifacts: [], bundleContentHash },
      artifacts,
    },
  };
}
