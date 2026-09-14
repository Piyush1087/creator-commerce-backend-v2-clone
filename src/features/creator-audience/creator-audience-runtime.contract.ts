import { z } from "zod";

import type {
  ContractRegistryKey,
  VerifiedContractBundle,
} from "../brand-intelligence/contracts/bundle/contract-bundle.types";
import { sha256Canonical } from "../brand-intelligence/contracts/bundle/canonical-json";
import type { GeneratedContractRegistration } from "../brand-intelligence/contracts/bundle/contract-bundle.integrity";
import {
  CREATOR_AUDIENCE_V0_COMPONENTS,
  CREATOR_AUDIENCE_V0_CONTRACT_VERSION,
  CREATOR_AUDIENCE_V0_OBJECT_ID,
  CreatorAudienceConsumerSchema,
} from "./contracts/creator-audience-v0.contract";

export const CREATOR_AUDIENCE_PROCESSOR_ID = "creator_audience_v0" as const;
export const CREATOR_AUDIENCE_PROCESSOR_VERSION = "1.0" as const;
export const CREATOR_AUDIENCE_OUTPUT_CONTRACT_ID =
  "creator_audience_v0_output_contract" as const;
export const CREATOR_AUDIENCE_OUTPUT_CONTRACT_VERSION = "1.0" as const;
export const CREATOR_AUDIENCE_BUNDLE_ID =
  "creator_intelligence.creator_audience_v0" as const;
export const CREATOR_AUDIENCE_BUNDLE_VERSION = "1.0" as const;
export const CREATOR_AUDIENCE_BUNDLE_HASH =
  "09afa9bb9370747938d79ea4fba197070359e13c9fa19fca3cfbfa75bb34ee27" as const;

export const CREATOR_AUDIENCE_REGISTRY_KEY = Object.freeze({
  processorId: CREATOR_AUDIENCE_PROCESSOR_ID,
  processorVersion: CREATOR_AUDIENCE_PROCESSOR_VERSION,
  outputContractId: CREATOR_AUDIENCE_OUTPUT_CONTRACT_ID,
  outputContractVersion: CREATOR_AUDIENCE_OUTPUT_CONTRACT_VERSION,
}) satisfies ContractRegistryKey;

export const CREATOR_AUDIENCE_COMPONENT_PATHS =
  CREATOR_AUDIENCE_V0_COMPONENTS.map((component) => `$/f/${component}`);

const identitySchema = z
  .object({
    ownerScopeId: z.string().uuid(),
    creatorProfileId: z.string().uuid(),
    creatorWorkspaceId: z.string().uuid(),
    integrationId: z.string().uuid(),
    providerAccountId: z.string().trim().min(1).max(100),
    authorizationGeneration: z.number().int().nonnegative(),
    requestIdentity: z.string().trim().min(1).max(255),
    captureRef: z.string().trim().min(1).max(255),
    resourceRef: z.string().trim().min(1).max(255),
  })
  .strict();

export const CreatorAudienceEvidenceManifestSchema = z
  .object({
    kind: z.literal("CREATOR_AUDIENCE_EVIDENCE_MANIFEST_V1"),
    identity: identitySchema,
    evidence: z
      .array(
        z
          .object({
            evidenceRef: z.string().trim().min(1).max(255),
            capabilityId: z.enum([
              "instagram.audience_followers",
              "instagram.audience_engaged",
            ]),
            population: z.enum(["FOLLOWERS", "ENGAGED_AUDIENCE"]),
            breakdown: z.enum(["AGE", "GENDER", "COUNTRY", "CITY"]),
            capturedAt: z.string().datetime(),
            contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict();

export const CreatorAudienceProcessorInputSchema = z
  .object({
    kind: z.literal("CREATOR_AUDIENCE_PROCESSOR_INPUT_V1"),
    value: CreatorAudienceConsumerSchema,
  })
  .strict();

export const CreatorAudiencePersistencePayloadSchema = z
  .object({
    kind: z.literal("CREATOR_AUDIENCE_PERSISTENCE_V1"),
    identity: identitySchema,
    value: CreatorAudienceConsumerSchema,
    evidence: CreatorAudienceEvidenceManifestSchema.shape.evidence,
  })
  .strict();

export type CreatorAudienceEvidenceManifest = z.infer<
  typeof CreatorAudienceEvidenceManifestSchema
>;
export type CreatorAudiencePersistencePayload = z.infer<
  typeof CreatorAudiencePersistencePayloadSchema
>;

export function creatorAudienceComponentValue(
  value: z.infer<typeof CreatorAudienceConsumerSchema>,
  path: string,
): unknown {
  const component = path.slice("$/f/".length);
  if (component === "source_status") return value.sourceStatus;
  if (component === "audience_highlights") return value.highlights;
  if (component === "follower_audience")
    return value.cohorts.find((item) => item.id === "FOLLOWERS") ?? null;
  if (component === "engaged_audience")
    return value.cohorts.find((item) => item.id === "ENGAGED") ?? null;
  if (component === "freshness") return value.freshness;
  if (component === "limitations") return value.limitations;
  throw new Error("CREATOR_AUDIENCE_UNKNOWN_COMPONENT_PATH");
}

export const CREATOR_AUDIENCE_RUNTIME_IDENTITY = Object.freeze({
  objectId: CREATOR_AUDIENCE_V0_OBJECT_ID,
  consumerContractVersion: CREATOR_AUDIENCE_V0_CONTRACT_VERSION,
  processorId: CREATOR_AUDIENCE_PROCESSOR_ID,
  processorVersion: CREATOR_AUDIENCE_PROCESSOR_VERSION,
  outputContractId: CREATOR_AUDIENCE_OUTPUT_CONTRACT_ID,
  outputContractVersion: CREATOR_AUDIENCE_OUTPUT_CONTRACT_VERSION,
  bundleId: CREATOR_AUDIENCE_BUNDLE_ID,
  bundleVersion: CREATOR_AUDIENCE_BUNDLE_VERSION,
});

const ownedPathPatterns = CREATOR_AUDIENCE_COMPONENT_PATHS.map(
  (componentPathPattern) => ({
    objectSemanticId: CREATOR_AUDIENCE_V0_OBJECT_ID,
    componentPathPattern,
  }),
);

/** Compiled deterministic contract, pinned to the accepted P0 authority. */
export function creatorAudienceVerifiedContract(): Readonly<{
  registration: GeneratedContractRegistration;
  bundle: VerifiedContractBundle;
}> {
  const registration: GeneratedContractRegistration = {
    ...CREATOR_AUDIENCE_REGISTRY_KEY,
    bundleId: CREATOR_AUDIENCE_BUNDLE_ID,
    bundleVersion: CREATOR_AUDIENCE_BUNDLE_VERSION,
    bundleContentHash: CREATOR_AUDIENCE_BUNDLE_HASH,
    ownedObjectSemanticIds: [CREATOR_AUDIENCE_V0_OBJECT_ID],
    ownedPathPatterns,
    structuralValidatorId: "contract_output_schema_v1",
    semanticValidatorId: CREATOR_AUDIENCE_PROCESSOR_ID,
    persistenceValidatorId: "intelligence_persistence_transition_v1",
    bundled: true,
    registered: true,
    executionEnabled: true,
  };
  const artifacts = {
    processorDefinition: {
      id: CREATOR_AUDIENCE_PROCESSOR_ID,
      version: CREATOR_AUDIENCE_PROCESSOR_VERSION,
      status: "FROZEN",
      owner_engine: "creator_intelligence",
      owning_branch: "audience",
      deterministic: true,
      model_calls: false,
    },
    reasoningContract: {
      id: "creator_audience_v0_reasoning",
      version: "1.0",
      status: "FROZEN",
      processor: CREATOR_AUDIENCE_PROCESSOR_ID,
      missing_is_zero: false,
      percentages_require_denominator: true,
    },
    outputContract: {
      id: CREATOR_AUDIENCE_OUTPUT_CONTRACT_ID,
      version: CREATOR_AUDIENCE_OUTPUT_CONTRACT_VERSION,
      status: "FROZEN",
      processor: CREATOR_AUDIENCE_PROCESSOR_ID,
      response: { type: "object" },
      shared_generated_metadata: {
        fields: {
          authority: { type: "enum", values: ["CREATOR_SHOP_DERIVED"] },
        },
      },
    },
    evidenceContract: {
      id: "creator_audience_v0_evidence",
      version: "1.0",
      status: "FROZEN",
      processor: CREATOR_AUDIENCE_PROCESSOR_ID,
      capabilities: {
        "instagram.audience_followers": {},
        "instagram.audience_engaged": {},
      },
    },
    objectContract: {
      contract: "creator_audience_v0_object",
      version: "1.0",
      status: "FROZEN",
      objects: [{ id: CREATOR_AUDIENCE_V0_OBJECT_ID }],
    },
    sharedMetadataContract: {
      contract: "shared_intelligence_metadata",
      version: "1.0",
      status: "FROZEN",
    },
  };
  const identity = {
    manifestSchemaVersion: 1 as const,
    bundleId: CREATOR_AUDIENCE_BUNDLE_ID,
    bundleVersion: CREATOR_AUDIENCE_BUNDLE_VERSION,
    ownerEngine: "creator_intelligence",
    owningBranch: "audience",
    architectureRepository: "Piyush1087/dummy_tcs",
    architectureCommitSha: "d39cb576b7c1473cbe3d602a5d7c2197f3132913",
    processorId: CREATOR_AUDIENCE_PROCESSOR_ID,
    processorVersion: CREATOR_AUDIENCE_PROCESSOR_VERSION,
    outputContractId: CREATOR_AUDIENCE_OUTPUT_CONTRACT_ID,
    outputContractVersion: CREATOR_AUDIENCE_OUTPUT_CONTRACT_VERSION,
    evidenceContractId: "creator_audience_v0_evidence",
    evidenceContractVersion: "1.0",
    ownedObjectSemanticIds: [CREATOR_AUDIENCE_V0_OBJECT_ID],
    ownedPathPatterns,
    generatedNotice: "GENERATED — DO NOT EDIT" as const,
    generatorVersion: "1.0.0" as const,
  };
  const calculatedHash = sha256Canonical({ identity, artifacts });
  if (calculatedHash !== CREATOR_AUDIENCE_BUNDLE_HASH) {
    throw new Error("CREATOR_AUDIENCE_BUNDLE_HASH_MISMATCH");
  }
  return {
    registration,
    bundle: {
      manifest: {
        ...identity,
        artifacts: [],
        bundleContentHash: CREATOR_AUDIENCE_BUNDLE_HASH,
      },
      artifacts,
    },
  };
}
