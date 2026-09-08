export const CREATOR_PAYOUTS_SCHEMA_VERSION = "C06_CREATOR_PAYOUTS_V1" as const;

export type CreatorPayoutsCoverage = "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
export type CreatorPayoutsFreshness = "CURRENT" | "STALE" | "UNKNOWN";

export type CreatorPayoutsAuthorizationScope = {
  readonly workspaceId: string;
  readonly organizationId: string;
  readonly subjectCreatorProfileId: string;
  readonly subjectOwnerUserId: string;
  readonly membershipId: string;
  readonly actorRole: "OWNER" | "MANAGER";
  readonly authorizationVersion: string;
};

export function creatorPayoutsEnvelope(
  authorization: CreatorPayoutsAuthorizationScope,
  asOf: Date,
) {
  return {
    schema_version: CREATOR_PAYOUTS_SCHEMA_VERSION,
    as_of: asOf.toISOString(),
    viewer: {
      actor_role: authorization.actorRole,
      workspace_reference: authorization.workspaceId,
    },
  } as const;
}

export function unavailableSection() {
  return {
    coverage: "UNAVAILABLE" as const,
    freshness: "UNKNOWN" as const,
    source_coverage: [] as string[],
    available_actions: [] as string[],
  };
}
