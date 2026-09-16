import { z } from "zod";

import type { ContractRegistryKey } from "../../brand-intelligence/contracts/bundle/contract-bundle.types";
import { InstagramIntelligenceObjectSchema } from "../contracts/instagram-intelligence.schemas";
import { INSTAGRAM_INTELLIGENCE_OBJECT_REGISTRY } from "../contracts/instagram-intelligence.registry";

export const INSTAGRAM_C4_AUTHORITY_COMMIT =
  "a7c691047ab6802098d3c4a84e73cc3fe95d753a" as const;

export const INSTAGRAM_C4_PROCESSORS = [
  {
    processorId: "instagram_content_behavior",
    processorVersion: "1.1",
    outputContractId: "instagram_content_behavior_output_contract",
    outputContractVersion: "1.1",
    objectId: "instagram_content_behavior",
  },
  {
    processorId: "instagram_audience_profile",
    processorVersion: "1.0",
    outputContractId: "instagram_audience_profile_output_contract",
    outputContractVersion: "1.0",
    objectId: "instagram_audience_profile",
  },
  {
    processorId: "instagram_organic_performance_profile",
    processorVersion: "1.0",
    outputContractId: "instagram_organic_performance_profile_output_contract",
    outputContractVersion: "1.0",
    objectId: "instagram_organic_performance_profile",
  },
] as const;

export type InstagramC4ProcessorId =
  (typeof INSTAGRAM_C4_PROCESSORS)[number]["processorId"];

export function instagramC4Definition(processorId: string) {
  const definition = INSTAGRAM_C4_PROCESSORS.find(
    (candidate) => candidate.processorId === processorId,
  );
  if (!definition) throw new Error("Unknown Instagram C4 processor");
  return definition;
}

export function instagramC4RegistryKey(
  processorId: InstagramC4ProcessorId,
): ContractRegistryKey {
  const definition = instagramC4Definition(processorId);
  return {
    processorId: definition.processorId,
    processorVersion: definition.processorVersion,
    outputContractId: definition.outputContractId,
    outputContractVersion: definition.outputContractVersion,
  };
}

export function instagramC4Components(objectId: string): readonly string[] {
  const definition = INSTAGRAM_INTELLIGENCE_OBJECT_REGISTRY.find(
    (candidate) => candidate.semanticId === objectId,
  );
  if (!definition) throw new Error("Unknown Instagram Object");
  return definition.components;
}

export function instagramC4Paths(objectId: string): readonly string[] {
  return [
    "$",
    ...instagramC4Components(objectId).map(
      (component) => `$/f/components/f/${component}`,
    ),
  ];
}

export const InstagramC4EvidenceManifestSchema = z
  .object({
    kind: z.literal("INSTAGRAM_C4_INPUT_V1"),
    brandProfileId: z.string().uuid(),
    integrationId: z.string().uuid(),
    providerAccountId: z.string().min(1).max(100),
    authorizationGeneration: z.number().int().positive(),
    windowEnd: z.string().datetime(),
  })
  .strict();

const persistedEvidenceSchema = z
  .object({
    evidenceRef: z.string().min(1),
    capabilityId: z.string().min(1),
    captureRef: z.string().min(1),
    captureVersion: z.string().min(1),
    capturedAt: z.string().datetime(),
    observedFreshness: z.enum(["CURRENT", "POSSIBLY_STALE", "UNKNOWN"]),
  })
  .strict();

export const InstagramC4PersistencePayloadSchema = z
  .object({
    kind: z.literal("INSTAGRAM_C4_PERSISTENCE_V1"),
    processorId: z.enum([
      "instagram_content_behavior",
      "instagram_audience_profile",
      "instagram_organic_performance_profile",
    ]),
    value: InstagramIntelligenceObjectSchema,
    evidence: z.array(persistedEvidenceSchema).min(1),
    account: z
      .object({
        integrationId: z.string().uuid(),
        providerAccountId: z.string().min(1),
        authorizationGeneration: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();

export type InstagramC4PersistencePayload = z.infer<
  typeof InstagramC4PersistencePayloadSchema
>;
