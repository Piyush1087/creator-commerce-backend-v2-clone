import type { IntelligenceConsumerResult } from "../../../intelligence-consumer/intelligence-consumer.contract";
import type {
  ChatEntityRef,
  ChatGroundingRef,
} from "../../response/chat-response.contract";

export function intelligenceEvidence(
  capabilityId: string,
  result: IntelligenceConsumerResult,
  entityRef: ChatEntityRef,
): Readonly<{
  grounding: readonly ChatGroundingRef[];
  freshnessNotes: readonly string[];
  limitations: readonly string[];
}> {
  const currentObjects = result.objects.filter(
    (object) => object.current.kind === "VALUE",
  );
  const stale = currentObjects.some((object) => object.freshness === "STALE");
  const partial = result.objects.some(
    (object) => object.readiness !== "READY" || object.current.kind !== "VALUE",
  );
  const readiness = result.objects.some(
    (object) => object.readiness === "NOT_READY",
  )
    ? "NOT_READY"
    : result.objects.some((object) => object.readiness === "PARTIAL")
      ? "PARTIAL"
      : "READY";
  const freshness = result.objects.some(
    (object) => object.freshness === "STALE",
  )
    ? "STALE"
    : result.objects.some((object) => object.freshness === "UNKNOWN")
      ? "UNKNOWN"
      : "CURRENT";
  const resultRefs = currentObjects.flatMap((object) =>
    object.current.kind === "VALUE" ? [object.current.resultRef] : [],
  );
  return {
    grounding: [
      {
        sourceType: "INTELLIGENCE",
        capabilityId,
        entityRefs: [entityRef],
        readiness,
        freshness,
        ...(resultRefs.length ? { resultRefs } : {}),
      },
    ],
    freshnessNotes: stale
      ? ["Some current Intelligence used in this answer is stale."]
      : [],
    limitations: partial
      ? [
          "Some requested Intelligence is partial, not ready, or has no current value.",
        ]
      : [],
  };
}
