export const BRAND_PAYOUTS_VIEWER_ROLES = [
  "BRAND_OWNER",
  "FINANCE_ADMIN",
  "CAMPAIGN_MANAGER",
] as const;

export type BrandPayoutsViewerRole =
  (typeof BRAND_PAYOUTS_VIEWER_ROLES)[number];

export type BrandPayoutsFullFinancialRole = Extract<
  BrandPayoutsViewerRole,
  "BRAND_OWNER" | "FINANCE_ADMIN"
>;

export type BrandPayoutsProjectionScope =
  | "FULL_FINANCIAL"
  | "AUTHORIZED_CAMPAIGN_COLLABORATION_ONLY"
  | "NO_FINANCIAL_ROWS";

interface BrandPayoutsAuthorizationScopeBaseV1 {
  readonly brandProfileId: string;
  readonly membershipId: string;
  readonly authorizedAsOf: Date;
  readonly authorizationVersion: string;
}

export interface BrandPayoutsFullFinancialAuthorizationScopeV1 extends BrandPayoutsAuthorizationScopeBaseV1 {
  readonly kind: "FULL_FINANCIAL";
  readonly role: BrandPayoutsFullFinancialRole;
}

/** P0/P1 fail-closed scope while no canonical entity predicate is accepted. */
export interface BrandPayoutsCampaignManagerNoRowsAuthorizationScopeV1 extends BrandPayoutsAuthorizationScopeBaseV1 {
  readonly kind: "NO_FINANCIAL_ROWS";
  readonly role: "CAMPAIGN_MANAGER";
  readonly reason: "CANONICAL_ENTITY_SCOPE_UNAVAILABLE";
}

export type BrandPayoutsAuthorizationScopeV1 =
  | BrandPayoutsFullFinancialAuthorizationScopeV1
  | BrandPayoutsCampaignManagerNoRowsAuthorizationScopeV1;

export interface BrandPayoutsViewerProjectionV2 {
  readonly role: BrandPayoutsViewerRole;
  readonly projection_scope: BrandPayoutsProjectionScope;
}

export interface BrandPayoutsRedactionPolicyV1 {
  readonly includeExactTreasuryAmounts: boolean;
  readonly includeOriginalFundingSourceDetails: false;
  readonly includeProviderIdentifiers: false;
  readonly includeCreatorSensitiveDetails: false;
  readonly allowActivityCsv: boolean;
}

export function projectBrandPayoutsViewerV2(
  scope: BrandPayoutsAuthorizationScopeV1,
): BrandPayoutsViewerProjectionV2 {
  return {
    role: scope.role,
    projection_scope: scope.kind,
  };
}

export function resolveBrandPayoutsRedactionPolicyV1(
  scope: BrandPayoutsAuthorizationScopeV1,
): BrandPayoutsRedactionPolicyV1 {
  const hasFullFinancialProjection = scope.kind === "FULL_FINANCIAL";

  return {
    includeExactTreasuryAmounts: hasFullFinancialProjection,
    includeOriginalFundingSourceDetails: false,
    includeProviderIdentifiers: false,
    includeCreatorSensitiveDetails: false,
    allowActivityCsv: hasFullFinancialProjection,
  };
}
