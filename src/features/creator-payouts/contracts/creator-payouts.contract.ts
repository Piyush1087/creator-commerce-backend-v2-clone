export const CREATOR_PAYOUTS_SCHEMA_VERSION = "C06_CREATOR_PAYOUTS_V1" as const;

export type CreatorPayoutsCoverage = "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
export type CreatorPayoutsFreshness = "CURRENT" | "STALE" | "UNKNOWN";
export type CreatorPayoutLifecycle =
  | "SCHEDULED"
  | "READY_QUEUED"
  | "PROCESSING"
  | "SETTLED"
  | "FAILED_RETRYABLE"
  | "ACTION_REQUIRED"
  | "LEGACY_UNRECONCILED";
export type CreatorPayoutGate =
  | "NOT_YET_DUE"
  | "CREATOR_SETUP_REQUIRED"
  | "UNSUPPORTED_GEOGRAPHY_OR_RAIL"
  | "FUNDING_REQUIRED"
  | "RESOLUTION_BLOCKED"
  | "PROVIDER_UNAVAILABLE"
  | "READY";
export type CreatorPayoutSummaryFamily =
  | "UPCOMING"
  | "DUE_OR_ACTION_REQUIRED"
  | "PROCESSING"
  | "PAID_TO_DATE";

export type CreatorPayoutMoney = {
  readonly amount: string;
  readonly currency: string;
};

export type CreatorPayoutObligationItem = {
  readonly obligation_id: string;
  readonly public_reference: string;
  readonly resource_version: string;
  readonly campaign_reference: string;
  readonly collaboration_reference: string;
  readonly lifecycle: CreatorPayoutLifecycle;
  readonly effective_gate: CreatorPayoutGate;
  readonly blocking_reason_code: string | null;
  readonly entitlement_value: CreatorPayoutMoney | null;
  readonly settled_value: CreatorPayoutMoney | null;
  readonly outstanding_value: CreatorPayoutMoney | null;
  readonly payment_due_at: string | null;
  readonly settlement_eligible_at: string | null;
  readonly payment_term: string | null;
  readonly last_observed_at: string;
  readonly legacy: null | {
    readonly classification: "DISPLAY_WITH_LIMITATION" | "LEGACY_UNRECONCILED";
    readonly limitation_reason_code: string;
  };
};

export type CreatorPayoutHistoryItem = {
  readonly history_id: string;
  readonly public_reference: string;
  readonly resource_version: string;
  readonly event_type:
    | "OBLIGATION_RECORDED"
    | "TRANSFER_PROCESSING"
    | "TRANSFER_FAILED"
    | "SETTLED"
    | "REVERSAL_PROCESSED";
  readonly obligation_reference: string;
  readonly collaboration_reference: string;
  readonly value: CreatorPayoutMoney | null;
  readonly recorded_at: string;
  readonly status: string;
};

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
