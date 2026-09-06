import type { AuthUser } from "../auth/types/auth-user";

export const INTELLIGENCE_CONSUMER_CONTRACT_VERSION = "1.0" as const;
export const INTELLIGENCE_DOMAIN_PAYLOAD_VERSION = "1.0" as const;
export const ENGINE_REGISTRATION_VERSION = "1.0" as const;

export const INTELLIGENCE_ENGINE_IDS = [
  "brand_intelligence",
  "product_intelligence",
] as const;

export type IntelligenceEngineId = (typeof INTELLIGENCE_ENGINE_IDS)[number];

export const INTELLIGENCE_CONSUMER_SUBJECT_TYPES = [
  "BRAND",
  "OFFERING",
] as const;

export type IntelligenceConsumerSubject =
  | { readonly type: "BRAND"; readonly id: string }
  | { readonly type: "OFFERING"; readonly id: string };

export type IntelligenceConsumerCurrentKind =
  | "VALUE"
  | "EXPLICIT_NULL"
  | "INTENTIONALLY_ABSENT"
  | "NO_CURRENT"
  | "NOT_EVALUATED"
  | "NOT_OWNED";

export type IntelligenceConsumerReadiness = "READY" | "PARTIAL" | "NOT_READY";

export type IntelligenceConsumerFreshness = "CURRENT" | "STALE" | "UNKNOWN";

export type IntelligenceConsumerAuthority =
  | "observed"
  | "creator_shop"
  | "confirmed"
  | "protected"
  | "system_managed"
  | "mixed";

export type IntelligenceConsumerRuntimeActivity =
  | "NONE"
  | "LEARNING"
  | "REFRESHING"
  | "TEMPORARILY_UNAVAILABLE";

export interface IntelligenceConsumerCandidateMeta {
  readonly status: "NONE" | "AVAILABLE" | "CONFLICT";
  readonly count: number;
  readonly currentPreserved: boolean;
  readonly summaryAvailable: boolean;
}

export interface IntelligenceConsumerObjectMeta {
  readonly objectId: string;
  readonly objectState: "NO_CURRENT" | "PARTIAL_CURRENT" | "CURRENT";
  readonly current:
    | { readonly kind: "VALUE"; readonly resultRef: string }
    | {
        readonly kind: Exclude<IntelligenceConsumerCurrentKind, "VALUE">;
      };
  readonly readiness: IntelligenceConsumerReadiness;
  readonly resultReadiness: IntelligenceConsumerReadiness;
  readonly freshness: IntelligenceConsumerFreshness;
  readonly changedAt: string | null;
  readonly authority: IntelligenceConsumerAuthority;
  readonly candidate?: IntelligenceConsumerCandidateMeta;
  readonly runtimeActivity?: IntelligenceConsumerRuntimeActivity;
  readonly updatedAt?: string | null;
  readonly provenanceRefs?: readonly string[];
}

export interface IntelligenceConsumerCapabilityAvailability {
  readonly status: "AVAILABLE" | "UNAVAILABLE";
  readonly reasonCode?: string;
}

export interface IntelligenceConsumerResult<TDomainPayload = unknown> {
  readonly contractVersion: typeof INTELLIGENCE_CONSUMER_CONTRACT_VERSION;
  readonly engineId: IntelligenceEngineId;
  readonly subject: IntelligenceConsumerSubject;
  readonly objects: readonly IntelligenceConsumerObjectMeta[];
  readonly capabilityAvailability: IntelligenceConsumerCapabilityAvailability;
  readonly domainPayloadVersion: typeof INTELLIGENCE_DOMAIN_PAYLOAD_VERSION;
  readonly domainPayload: TDomainPayload;
}

export interface EngineConsumerRegistration<TPayload = unknown> {
  readonly registrationVersion: typeof ENGINE_REGISTRATION_VERSION;
  readonly engineId: IntelligenceEngineId;
  readonly supportedSubjectTypes: readonly IntelligenceConsumerSubject["type"][];
  readonly objectIds: readonly string[];
  readonly domainPayloadVersion: typeof INTELLIGENCE_DOMAIN_PAYLOAD_VERSION;
  read(
    actor: AuthUser,
    subject: IntelligenceConsumerSubject,
  ): Promise<IntelligenceConsumerResult<TPayload>>;
  resolveAvailability(
    actor: AuthUser,
    subject: IntelligenceConsumerSubject,
  ): Promise<IntelligenceConsumerCapabilityAvailability>;
}
