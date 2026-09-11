import { GoneException } from "@nestjs/common";

export const LEGACY_COLLABORATION_AGGREGATE_WRITE_RETIRED =
  "LEGACY_COLLABORATION_AGGREGATE_WRITE_RETIRED" as const;

export function retiredLegacyCollaborationAggregateWrite(): void {
  throw new GoneException({
    code: LEGACY_COLLABORATION_AGGREGATE_WRITE_RETIRED,
    message:
      "CollaborationCommercial/Logistics/Media/Finalization are retained schema; use canonical C-04 Collaboration APIs",
  });
}
