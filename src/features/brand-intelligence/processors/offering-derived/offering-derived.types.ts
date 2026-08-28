import type { PreparedProcessorDependencies } from "../../input/dependency/processor-dependency-preparation.service";

export const OFFERING_CREATOR_PROCESSOR_ID =
  "offering_creator_communication" as const;
export const OFFERING_CREATOR_OBJECT =
  "offering_creator_communication_profile" as const;
export const OFFERING_ACTIONABILITY_PROCESSOR_ID =
  "offering_actionability_synthesis" as const;
export const OFFERING_ACTIONABILITY_OBJECT =
  "offering_actionability_profile" as const;

export interface OfferingDerivedProcessorConfig {
  readonly processorId:
    | typeof OFFERING_CREATOR_PROCESSOR_ID
    | typeof OFFERING_ACTIONABILITY_PROCESSOR_ID;
  readonly objectSemanticId:
    | typeof OFFERING_CREATOR_OBJECT
    | typeof OFFERING_ACTIONABILITY_OBJECT;
  readonly profileField:
    | typeof OFFERING_CREATOR_OBJECT
    | typeof OFFERING_ACTIONABILITY_OBJECT;
  readonly families: readonly string[];
  readonly payloadKind:
    | "OFFERING_CREATOR_COMMUNICATION_V1"
    | "OFFERING_ACTIONABILITY_V1";
  readonly promptVersion: string;
  readonly instruction: string;
}

export const OFFERING_CREATOR_CONFIG: OfferingDerivedProcessorConfig = {
  processorId: OFFERING_CREATOR_PROCESSOR_ID,
  objectSemanticId: OFFERING_CREATOR_OBJECT,
  profileField: OFFERING_CREATOR_OBJECT,
  families: ["creator_talking_points", "communication_constraints"],
  payloadKind: "OFFERING_CREATOR_COMMUNICATION_V1",
  promptVersion: "offering_creator_communication@1.0",
  instruction:
    "Produce only reusable, grounded exact-Offering creator talking-point ingredients and explicit communication constraints matching the strict schema. Never write final campaign copy, scripts, captions, CTA, audience, timing, platform instructions, urgency, discounts, or unsupported claims. Use the supplied current factual profile; fail closed on claim-sensitive language without same-Offering proof. Brand-level constraints apply only when explicitly applicable. Preserve null for unsupported families and durable meaning-based semantic IDs.",
};

export const OFFERING_ACTIONABILITY_CONFIG: OfferingDerivedProcessorConfig = {
  processorId: OFFERING_ACTIONABILITY_PROCESSOR_ID,
  objectSemanticId: OFFERING_ACTIONABILITY_OBJECT,
  profileField: OFFERING_ACTIONABILITY_OBJECT,
  families: ["customer_action", "commercial_context"],
  payloadKind: "OFFERING_ACTIONABILITY_V1",
  promptVersion: "offering_actionability_synthesis@1.0",
  instruction:
    "Produce only defensible exact-Offering customer actions and commercial context matching the strict schema. Canonical lifecycle, destination, current price tuple, exact Offer applicability, and exact Offering-to-Location relations are primary truth. Never use legacy price fields, invent availability, inventory, checkout, delivery, slots, discounts, geography, fulfilment, or currency conversion. Optional serviceability/location Evidence is interpretation context and never canonical availability. Preserve null commercial context when canonical commercial truth is absent and use durable meaning-based semantic IDs.",
};

export interface OfferingDerivedPersistencePayload {
  readonly kind: OfferingDerivedProcessorConfig["payloadKind"];
  readonly output: Readonly<Record<string, unknown>>;
  readonly prepared: PreparedProcessorDependencies;
  readonly offeringRef: string;
}

export function derivedConfigForProcessor(
  processorId: string,
): OfferingDerivedProcessorConfig | undefined {
  return [OFFERING_CREATOR_CONFIG, OFFERING_ACTIONABILITY_CONFIG].find(
    (config) => config.processorId === processorId,
  );
}
