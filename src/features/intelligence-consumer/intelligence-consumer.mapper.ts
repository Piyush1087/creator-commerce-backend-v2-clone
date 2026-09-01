import type {
  IntelligenceConsumerAuthority,
  IntelligenceConsumerCandidateMeta,
  IntelligenceConsumerCurrentKind,
  IntelligenceConsumerFreshness,
  IntelligenceConsumerObjectMeta,
  IntelligenceConsumerReadiness,
  IntelligenceConsumerRuntimeActivity,
} from "./intelligence-consumer.contract";

interface DomainConsumerObjectMeta {
  readonly current: { readonly kind: IntelligenceConsumerCurrentKind };
  readonly readiness: IntelligenceConsumerReadiness;
  readonly freshness: IntelligenceConsumerFreshness;
  readonly authority: IntelligenceConsumerAuthority;
  readonly candidate?: IntelligenceConsumerCandidateMeta & {
    readonly rawCandidateVisible?: false;
  };
}

export function normalizeRuntimeActivity(
  activity: string | undefined,
): IntelligenceConsumerRuntimeActivity | undefined {
  switch (activity) {
    case "LEARNING":
    case "REFRESHING":
    case "TEMPORARILY_UNAVAILABLE":
      return activity;
    case "IDLE":
    case "WAITING_FOR_EVIDENCE":
    case "WAITING_FOR_DEPENDENCY":
    case "READY_TO_RUN":
    case "RETRY_SCHEDULED":
      return "NONE";
    default:
      return undefined;
  }
}

export function toIntelligenceConsumerObjectMeta(
  objectId: string,
  source: DomainConsumerObjectMeta,
  resultRef: string,
  runtimeActivity?: IntelligenceConsumerRuntimeActivity,
): IntelligenceConsumerObjectMeta {
  return {
    objectId,
    current:
      source.current.kind === "VALUE"
        ? { kind: "VALUE", resultRef }
        : { kind: source.current.kind },
    readiness: source.readiness,
    freshness: source.freshness,
    authority: source.authority,
    ...(source.candidate
      ? {
          candidate: {
            status: source.candidate.status,
            count: source.candidate.count,
            currentPreserved: source.candidate.currentPreserved,
            summaryAvailable: source.candidate.summaryAvailable,
          },
        }
      : {}),
    ...(runtimeActivity ? { runtimeActivity } : {}),
  };
}
