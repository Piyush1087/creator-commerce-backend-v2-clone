import type { BrandPayoutsViewerProjectionV2 } from "./brand-payouts-authorization.contract";

export const BRAND_PAYOUTS_V2_MEDIA_TYPE =
  "application/vnd.creator-shop.brand-payouts.v2+json";
export const BRAND_PAYOUTS_V2_SCHEMA_VERSION = "brand-payouts.v2" as const;

export type BrandPayoutsRepresentation = "LEGACY" | "V2";

/**
 * P1 can wire this pure negotiation helper into the existing controller.
 * Until then, an absent or unrelated Accept header preserves the legacy shape.
 */
export function negotiateBrandPayoutsRepresentation(
  acceptHeader: string | readonly string[] | undefined,
): BrandPayoutsRepresentation {
  const values: readonly string[] =
    typeof acceptHeader === "string" ? [acceptHeader] : (acceptHeader ?? []);

  const explicitlyAcceptsV2 = values
    .flatMap((value) => value.split(","))
    .some((range) => {
      const [rawMediaType, ...rawParameters] = range
        .split(";")
        .map((part) => part.trim());
      if (rawMediaType.toLowerCase() !== BRAND_PAYOUTS_V2_MEDIA_TYPE) {
        return false;
      }

      const qualityParameter = rawParameters.find((parameter) =>
        parameter.toLowerCase().startsWith("q="),
      );
      if (!qualityParameter) return true;

      const quality = Number(qualityParameter.slice(2));
      return Number.isFinite(quality) && quality > 0 && quality <= 1;
    });

  return explicitlyAcceptsV2 ? "V2" : "LEGACY";
}

/** Exact decimal string. Consumers must not coerce this value to binary float. */
export type BrandPayoutsDecimalString = string;

/** UTC ISO-8601 string with an explicit offset. */
export type BrandPayoutsUtcInstant = string;

export interface BrandPayoutsMoneyV2 {
  readonly amount: BrandPayoutsDecimalString;
  readonly currency: string;
}

export type BrandPayoutsSectionCoverage =
  | "COMPLETE"
  | "PARTIAL"
  | "UNAVAILABLE";
export type BrandPayoutsSectionFreshness = "CURRENT" | "STALE";
export type BrandPayoutsSourceStatus = "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";

export type BrandPayoutsSectionId =
  | "OVERVIEW"
  | "OBLIGATIONS"
  | "ACTIVITY"
  | "BRAND_RETURNS"
  | "RESERVE_REQUESTS";

export type BrandPayoutsSourceId =
  | "VAULT"
  | "FUNDING"
  | "FINANCIAL_LEDGER"
  | "PAYOUT_OBLIGATIONS"
  | "BRAND_RETURNS"
  | "COLLABORATION_RESERVE_REQUESTS";

export interface BrandPayoutsSourceCoverageV2 {
  readonly source: BrandPayoutsSourceId;
  readonly status: BrandPayoutsSourceStatus;
  readonly limitation_reason_code: string | null;
  readonly recovery_hint: string | null;
}

export interface BrandPayoutsLegacyLimitationV2 {
  readonly source: BrandPayoutsSourceId;
  readonly reason_code: string;
  readonly detail: string;
}

export type BrandPayoutsReadAction =
  | "VIEW_DETAIL"
  | "OPEN_SETTINGS_ADD_FUNDS"
  | "OPEN_SETTINGS_BRAND_RETURN"
  | "DOWNLOAD_FINANCIAL_ACTIVITY_CSV";

export interface BrandPayoutsAvailableActionV2 {
  readonly action: BrandPayoutsReadAction;
  readonly resource_reference: string;
  readonly resource_version: string;
  readonly authorized_as_of: BrandPayoutsUtcInstant;
}

export interface BrandPayoutsPageMetadataV2 {
  readonly next_cursor: string | null;
  readonly page_complete: boolean;
  readonly source_complete: boolean;
}

export interface BrandPayoutsSectionV2<
  TSectionId extends BrandPayoutsSectionId,
  TPayload,
> {
  readonly section_id: TSectionId;
  readonly coverage: BrandPayoutsSectionCoverage;
  readonly freshness: BrandPayoutsSectionFreshness;
  readonly source_observed_at: BrandPayoutsUtcInstant | null;
  readonly source_coverage: readonly BrandPayoutsSourceCoverageV2[];
  readonly legacy_limitations: readonly BrandPayoutsLegacyLimitationV2[];
  readonly available_actions: readonly BrandPayoutsAvailableActionV2[];
  readonly payload: TPayload | null;
  readonly page?: BrandPayoutsPageMetadataV2;
}

export interface BrandPayoutsReadEnvelopeV2<
  TSection extends BrandPayoutsSectionV2<BrandPayoutsSectionId, unknown>,
> {
  readonly schema_version: typeof BRAND_PAYOUTS_V2_SCHEMA_VERSION;
  readonly as_of: BrandPayoutsUtcInstant;
  readonly viewer: BrandPayoutsViewerProjectionV2;
  readonly sections: readonly TSection[];
}

export interface BrandPayoutsAuthoritativeAmountBucketV2 {
  readonly status: "AUTHORITATIVE";
  readonly value: BrandPayoutsMoneyV2;
}

export interface BrandPayoutsUnavailableAmountBucketV2 {
  readonly status: "UNAVAILABLE";
  readonly value: null;
  readonly limitation_reason_code: string;
}

export type BrandPayoutsAmountBucketV2 =
  | BrandPayoutsAuthoritativeAmountBucketV2
  | BrandPayoutsUnavailableAmountBucketV2;

export interface BrandPayoutsAuthoritativeCountBucketV2 {
  readonly status: "AUTHORITATIVE";
  readonly value: number;
}

export interface BrandPayoutsUnavailableCountBucketV2 {
  readonly status: "UNAVAILABLE";
  readonly value: null;
  readonly limitation_reason_code: string;
}

export type BrandPayoutsCountBucketV2 =
  | BrandPayoutsAuthoritativeCountBucketV2
  | BrandPayoutsUnavailableCountBucketV2;

export interface BrandPayoutsFullFinancialSummaryV2 {
  readonly projection: "FULL_FINANCIAL";
  readonly available_funds: BrandPayoutsAmountBucketV2;
  readonly pending_funding: BrandPayoutsAmountBucketV2;
  readonly committed_protected_funds: BrandPayoutsAmountBucketV2;
  readonly active_brand_return_commitment: BrandPayoutsAmountBucketV2;
  readonly scheduled_creator_obligations: BrandPayoutsAmountBucketV2;
  readonly processing_creator_obligations: BrandPayoutsAmountBucketV2;
  readonly settled_activity: BrandPayoutsAmountBucketV2 & {
    readonly basis: "LIFETIME" | "REQUESTED_RANGE";
  };
  readonly action_required_count: BrandPayoutsCountBucketV2;
}

export type BrandPayoutsTreasuryCapacity =
  | "SUFFICIENT"
  | "SHORTFALL"
  | "PENDING_APPROVAL"
  | "UNAVAILABLE";

export interface BrandPayoutsCampaignOperationalSummaryV2 {
  readonly projection: "CAMPAIGN_OPERATIONAL";
  readonly treasury_capacity: BrandPayoutsTreasuryCapacity;
  readonly action_required_count: BrandPayoutsCountBucketV2;
}

export type BrandPayoutsSummaryV2 =
  | BrandPayoutsFullFinancialSummaryV2
  | BrandPayoutsCampaignOperationalSummaryV2;

export interface BrandPayoutsLegacyStateV2 {
  readonly classification:
    | "CANONICALLY_RECONCILABLE"
    | "DISPLAY_AS_LEGACY"
    | "DISPLAY_WITH_LIMITATION"
    | "LEGACY_UNRECONCILED";
  readonly limitation_reason_code: string | null;
}

export type BrandPayoutsObligationLifecycle =
  | "SCHEDULED"
  | "READY_QUEUED"
  | "PROCESSING"
  | "HELD_RELEASE_PENDING"
  | "SETTLED"
  | "FAILED_RETRYABLE"
  | "ACTION_REQUIRED"
  | "PARTIAL_REVERSAL"
  | "FULL_REVERSAL"
  | "LEGACY_UNRECONCILED";

export type BrandPayoutsObligationGate =
  | "NOT_YET_DUE"
  | "CREATOR_SETUP_REQUIRED"
  | "UNSUPPORTED_GEOGRAPHY_OR_RAIL"
  | "PROVIDER_REVIEW"
  | "PROTECTED_FUNDING_BLOCKED"
  | "RESOLUTION_BLOCKED"
  | "DEPENDENCY_UNAVAILABLE"
  | "ELIGIBLE";

export interface BrandPayoutsObligationItemV2 {
  readonly obligation_id: string;
  readonly public_reference: string;
  readonly resource_version: string;
  readonly campaign_id: string;
  readonly collaboration_id: string;
  readonly creator_reference: string;
  readonly lifecycle: BrandPayoutsObligationLifecycle;
  /** Current execution/readiness gate; it never replaces business lifecycle. */
  readonly current_gate: BrandPayoutsObligationGate;
  readonly blocking_reason_code: string | null;
  readonly recovery_reference: string | null;
  readonly entitlement_value: BrandPayoutsMoneyV2 | null;
  readonly settled_value: BrandPayoutsMoneyV2 | null;
  readonly reversed_value: BrandPayoutsMoneyV2 | null;
  readonly outstanding_value: BrandPayoutsMoneyV2 | null;
  readonly payment_due_at: BrandPayoutsUtcInstant | null;
  readonly last_observed_at: BrandPayoutsUtcInstant;
  readonly legacy: BrandPayoutsLegacyStateV2 | null;
}

export type BrandPayoutsBrandReturnStatus =
  | "REQUESTED"
  | "ALLOCATING_ORIGINAL_SOURCES"
  | "PROCESSING"
  | "PARTIAL"
  | "COMPLETED"
  | "ACTION_REQUIRED"
  | "FAILED";

export interface BrandPayoutsBrandReturnItemV2 {
  readonly brand_return_id: string;
  readonly public_reference: string;
  readonly resource_version: string;
  readonly status: BrandPayoutsBrandReturnStatus;
  readonly requested_value: BrandPayoutsMoneyV2;
  readonly completed_value: BrandPayoutsMoneyV2;
  readonly unresolved_value: BrandPayoutsMoneyV2;
  readonly requested_at: BrandPayoutsUtcInstant;
  readonly last_observed_at: BrandPayoutsUtcInstant;
  readonly action_required_reason_code: string | null;
  readonly legacy: BrandPayoutsLegacyStateV2 | null;
}

export type BrandPayoutsReserveRequestStatus =
  | "REQUESTED"
  | "APPROVAL_REQUIRED"
  | "APPROVED_AWAITING_EXECUTION"
  | "EXECUTING"
  | "AWAITING_FUNDS"
  | "COMPLETED"
  | "ACTION_REQUIRED"
  | "SUPERSEDED"
  | "LEGACY_UNRECONCILED";

export interface BrandPayoutsReserveRequestItemV2 {
  readonly reserve_request_id: string;
  readonly public_reference: string;
  readonly resource_version: string;
  readonly campaign_id: string;
  readonly collaboration_id: string;
  readonly status: BrandPayoutsReserveRequestStatus;
  /** Null when the viewer is not authorized for the exact reserve value. */
  readonly reserve_value: BrandPayoutsMoneyV2 | null;
  readonly approval_required: boolean;
  readonly requested_at: BrandPayoutsUtcInstant;
  readonly last_observed_at: BrandPayoutsUtcInstant;
  readonly action_required_reason_code: string | null;
  readonly legacy: BrandPayoutsLegacyStateV2 | null;
}

export type BrandPayoutsActivityCategory =
  | "MONEY_MOVEMENT"
  | "PROTECTED_ALLOCATION"
  | "BUSINESS_OBLIGATION"
  | "PROVIDER_EXECUTION"
  | "RETURN_REFUND_REVERSAL"
  | "INFORMATIONAL_LIFECYCLE";

export type BrandPayoutsActivitySourceOwner =
  | "FINANCIAL_LEDGER"
  | "COLLABORATION"
  | "PAYOUT_EXECUTION"
  | "BRAND_RETURN";

export interface BrandPayoutsActivityReferencesV2 {
  readonly campaign_id: string | null;
  readonly collaboration_id: string | null;
  readonly creator_reference: string | null;
  readonly obligation_id: string | null;
  readonly brand_return_id: string | null;
}

export type BrandPayoutsActivityLegacyStateV2 = BrandPayoutsLegacyStateV2;

export interface BrandPayoutsActivityItemV2 {
  readonly activity_id: string;
  readonly public_reference: string;
  readonly resource_version: string;
  readonly source_owner: BrandPayoutsActivitySourceOwner;
  readonly source_reference: string;
  readonly category: BrandPayoutsActivityCategory;
  readonly is_financial_movement: boolean;
  readonly financial_value: BrandPayoutsMoneyV2 | null;
  readonly recorded_at: BrandPayoutsUtcInstant;
  readonly occurred_at: BrandPayoutsUtcInstant | null;
  readonly source_observed_at: BrandPayoutsUtcInstant | null;
  readonly normalized_status: string;
  readonly actor_source: string | null;
  readonly references: BrandPayoutsActivityReferencesV2;
  readonly legacy: BrandPayoutsActivityLegacyStateV2 | null;
}

export type BrandPayoutsOverviewSectionV2 = BrandPayoutsSectionV2<
  "OVERVIEW",
  BrandPayoutsSummaryV2
>;

export type BrandPayoutsActivitySectionV2 = BrandPayoutsSectionV2<
  "ACTIVITY",
  readonly BrandPayoutsActivityItemV2[]
>;

export type BrandPayoutsObligationsSectionV2 = BrandPayoutsSectionV2<
  "OBLIGATIONS",
  readonly BrandPayoutsObligationItemV2[]
>;

export type BrandPayoutsObligationDetailSectionV2 = BrandPayoutsSectionV2<
  "OBLIGATIONS",
  BrandPayoutsObligationItemV2
>;

export type BrandPayoutsActivityDetailSectionV2 = BrandPayoutsSectionV2<
  "ACTIVITY",
  BrandPayoutsActivityItemV2
>;

export type BrandPayoutsBrandReturnsSectionV2 = BrandPayoutsSectionV2<
  "BRAND_RETURNS",
  readonly BrandPayoutsBrandReturnItemV2[]
>;

export type BrandPayoutsBrandReturnDetailSectionV2 = BrandPayoutsSectionV2<
  "BRAND_RETURNS",
  BrandPayoutsBrandReturnItemV2
>;

export type BrandPayoutsReserveRequestsSectionV2 = BrandPayoutsSectionV2<
  "RESERVE_REQUESTS",
  readonly BrandPayoutsReserveRequestItemV2[]
>;

export type BrandPayoutsOverviewResponseV2 =
  BrandPayoutsReadEnvelopeV2<BrandPayoutsOverviewSectionV2>;

export type BrandPayoutsActivityResponseV2 =
  BrandPayoutsReadEnvelopeV2<BrandPayoutsActivitySectionV2>;

export type BrandPayoutsObligationsResponseV2 =
  BrandPayoutsReadEnvelopeV2<BrandPayoutsObligationsSectionV2>;

export type BrandPayoutsObligationDetailResponseV2 =
  BrandPayoutsReadEnvelopeV2<BrandPayoutsObligationDetailSectionV2>;

export type BrandPayoutsActivityDetailResponseV2 =
  BrandPayoutsReadEnvelopeV2<BrandPayoutsActivityDetailSectionV2>;

export type BrandPayoutsBrandReturnsResponseV2 =
  BrandPayoutsReadEnvelopeV2<BrandPayoutsBrandReturnsSectionV2>;

export type BrandPayoutsBrandReturnDetailResponseV2 =
  BrandPayoutsReadEnvelopeV2<BrandPayoutsBrandReturnDetailSectionV2>;

export type BrandPayoutsReserveRequestsResponseV2 =
  BrandPayoutsReadEnvelopeV2<BrandPayoutsReserveRequestsSectionV2>;

export interface BrandPayoutsActivityCsvExportV2 {
  readonly contentType: "text/csv; charset=utf-8";
  readonly filename: string;
  readonly generatedAt: Date;
  readonly asOf: Date;
  /** Already encoded with RFC 4180 and spreadsheet-formula protections. */
  readonly body: AsyncIterable<Uint8Array>;
}
