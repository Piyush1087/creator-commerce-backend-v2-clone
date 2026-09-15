import type {
  ContractRegistryKey,
  VerifiedContractBundle,
} from "../brand-intelligence/contracts/bundle/contract-bundle.types";
import type { GeneratedContractRegistration } from "../brand-intelligence/contracts/bundle/contract-bundle.integrity";
import { sha256Canonical } from "../brand-intelligence/contracts/bundle/canonical-json";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  AUDIENCE_V1_PATHS,
  AUDIENCE_V1_PROCESSOR,
  AUDIENCE_V1_PRODUCT_BLOB,
  AudienceV1ConsumerSchema,
} from "./creator-audience-v1.contract";
export const AUDIENCE_V1_REGISTRY_KEY = Object.freeze({
  processorId: AUDIENCE_V1_PROCESSOR,
  processorVersion: "1.0",
  outputContractId: "creator_audience_v1_output_contract",
  outputContractVersion: "1.0",
}) satisfies ContractRegistryKey;
export const AUDIENCE_V1_BUNDLE_HASH =
  "8133a8200f12113ada993f934dbcd40ef1a57c254ed4eb9372c36ed1b4e8c70d";
const ownedPathPatterns = AUDIENCE_V1_PATHS.map((componentPathPattern) => ({
  objectSemanticId: "creator_audience",
  componentPathPattern,
}));

/** Compiled deterministic contract, pinned to the accepted P0 authority. */
export function audienceV1VerifiedContract(): Readonly<{
  registration: GeneratedContractRegistration;
  bundle: VerifiedContractBundle;
}> {
  const registration: GeneratedContractRegistration = {
    ...AUDIENCE_V1_REGISTRY_KEY,
    bundleId: "creator_intelligence.creator_audience_v1",
    bundleVersion: "1.0",
    bundleContentHash: AUDIENCE_V1_BUNDLE_HASH,
    ownedObjectSemanticIds: ["creator_audience"],
    ownedPathPatterns,
    structuralValidatorId: "contract_output_schema_v1",
    semanticValidatorId: AUDIENCE_V1_PROCESSOR,
    persistenceValidatorId: "intelligence_persistence_transition_v1",
    bundled: true,
    registered: true,
    executionEnabled: true,
  };
  const artifacts = {
    processorDefinition: {
      id: AUDIENCE_V1_PROCESSOR,
      version: "1.0",
      status: "FROZEN",
      owner_engine: "creator_intelligence",
      owning_branch: "audience",
      deterministic: true,
      model_calls: false,
    },
    reasoningContract: {
      id: "creator_audience_v1_reasoning",
      version: "1.0",
      status: "FROZEN",
      processor: AUDIENCE_V1_PROCESSOR,
      missing_is_zero: false,
      percentages_require_denominator: true,
      productBlob: AUDIENCE_V1_PRODUCT_BLOB,
      brandInput: false,
      historyMinimumSnapshots: 3,
      historyMinimumElapsedDays: 14,
      contentFreshnessHours: 48,
      contextInterpretation: "SEPARATE_SOURCE_FACTS_NOT_AUDIENCE_PREFERENCE",
    },
    outputContract: {
      id: "creator_audience_v1_output_contract",
      version: "1.0",
      status: "FROZEN",
      processor: AUDIENCE_V1_PROCESSOR,
      response: sharedSchema(
        zodToJsonSchema(AudienceV1ConsumerSchema, { $refStrategy: "none" }),
      ),
      shared_generated_metadata: {
        fields: {
          authority: { type: "enum", values: ["CREATOR_SHOP_DERIVED"] },
        },
      },
    },
    evidenceContract: {
      id: "creator_audience_v1_evidence",
      version: "1.0",
      status: "FROZEN",
      processor: AUDIENCE_V1_PROCESSOR,
      capabilities: {
        "instagram.audience_followers": {},
        "instagram.audience_engaged": {},
        "instagram.media_insights": {},
      },
    },
    objectContract: {
      contract: "creator_audience_v1_object",
      version: "1.0",
      status: "FROZEN",
      objects: [{ id: "creator_audience" }],
    },
    sharedMetadataContract: {
      contract: "shared_intelligence_metadata",
      version: "1.0",
      status: "FROZEN",
    },
  };
  const identity = {
    manifestSchemaVersion: 1 as const,
    bundleId: "creator_intelligence.creator_audience_v1",
    bundleVersion: "1.0",
    ownerEngine: "creator_intelligence",
    owningBranch: "audience",
    architectureRepository: "Piyush1087/dummy_tcs",
    architectureCommitSha: "cb92615cc53d34f63936cfcfadc70aae74a943da",
    processorId: AUDIENCE_V1_PROCESSOR,
    processorVersion: "1.0",
    outputContractId: "creator_audience_v1_output_contract",
    outputContractVersion: "1.0",
    evidenceContractId: "creator_audience_v1_evidence",
    evidenceContractVersion: "1.0",
    ownedObjectSemanticIds: ["creator_audience"],
    ownedPathPatterns,
    generatedNotice: "GENERATED — DO NOT EDIT" as const,
    generatorVersion: "1.0.0" as const,
  };
  const calculatedHash = sha256Canonical({ identity, artifacts });
  if (calculatedHash !== AUDIENCE_V1_BUNDLE_HASH) {
    throw new Error("AUDIENCE_V1_BUNDLE_HASH_MISMATCH:" + calculatedHash);
  }
  return {
    registration,
    bundle: {
      manifest: {
        ...identity,
        artifacts: [],
        bundleContentHash: AUDIENCE_V1_BUNDLE_HASH,
      },
      artifacts,
    },
  };
}

/** Adapt the existing strict schema to the shared structural validator's vocabulary. */
function sharedSchema(value: unknown): Record<string, unknown> {
  const node = value as Record<string, unknown>;
  if (Array.isArray(node.anyOf)) {
    const nullable = node.anyOf.some(
      (item) => (item as Record<string, unknown>).type === "null",
    );
    const actual = node.anyOf.find(
      (item) => (item as Record<string, unknown>).type !== "null",
    );
    return actual ? { ...sharedSchema(actual), nullable } : { type: "null" };
  }
  const result: Record<string, unknown> = {
    type: Array.isArray(node.type)
      ? node.type.map((type) => (type === "integer" ? "number" : type))
      : node.type === "integer"
        ? "number"
        : node.type,
  };
  if (node.enum) {
    result.type = "enum";
    result.values = node.enum;
  }
  if ("const" in node) {
    result.type = "enum";
    result.values = [node.const];
  }
  if (node.properties) {
    result.fields = Object.fromEntries(
      Object.entries(node.properties as Record<string, unknown>).map(
        ([key, child]) => [key, sharedSchema(child)],
      ),
    );
    result.required = node.required;
    result.additional_properties = node.additionalProperties;
  }
  if (node.items) result.item = sharedSchema(node.items);
  if (node.minItems !== undefined) result.min_items = node.minItems;
  if (node.maxItems !== undefined) result.max_items = node.maxItems;
  if (node.minLength !== undefined) result.min_length = node.minLength;
  return result;
}
