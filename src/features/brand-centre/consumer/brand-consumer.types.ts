import type {
  IntelligenceProjectionReadiness,
  IntelligenceProjectionValueState,
} from "../../brand-intelligence/projection/intelligence-current-projection.types";

export type ConsumerAuthority =
  | "observed"
  | "creator_shop"
  | "confirmed"
  | "protected"
  | "system_managed"
  | "mixed";
export type ConsumerCurrent<T> =
  | { kind: "VALUE"; value: T }
  | { kind: Exclude<IntelligenceProjectionValueState, "VALUE"> };
export interface ConsumerField<T = unknown> {
  semanticId: string;
  current: ConsumerCurrent<T>;
  readiness: IntelligenceProjectionReadiness;
  resultReadiness: IntelligenceProjectionReadiness;
  freshness: "CURRENT" | "STALE" | "UNKNOWN";
  authority: ConsumerAuthority;
  editability: "READ_ONLY" | "POLICY_PENDING";
  candidate?: {
    status: "NONE" | "AVAILABLE" | "CONFLICT";
    count: number;
    currentPreserved: boolean;
    summaryAvailable: boolean;
    rawCandidateVisible: false;
  };
}
export interface ConsumerIntelligenceField extends ConsumerField {
  objectState: "NO_CURRENT" | "PARTIAL_CURRENT" | "CURRENT";
  changedAt: string | null;
  mixedGeneration: boolean;
  componentMeta: Record<string, Omit<ConsumerField, "current">>;
}
export type ConsumerRuntimeActivity =
  | "NONE"
  | "LEARNING"
  | "REFRESHING"
  | "TEMPORARILY_UNAVAILABLE";
