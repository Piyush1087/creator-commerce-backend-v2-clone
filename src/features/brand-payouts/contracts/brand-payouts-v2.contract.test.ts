import { describe, expect, it } from "vitest";

import {
  projectBrandPayoutsViewerV2,
  resolveBrandPayoutsRedactionPolicyV1,
  type BrandPayoutsAuthorizationScopeV1,
} from "./brand-payouts-authorization.contract";
import {
  BRAND_PAYOUTS_V2_MEDIA_TYPE,
  negotiateBrandPayoutsRepresentation,
  type BrandPayoutsActivityResponseV2,
  type BrandPayoutsObligationItemV2,
  type BrandPayoutsOverviewResponseV2,
} from "./brand-payouts-v2.contract";

const authorizedAt = new Date("2026-09-04T12:00:00.000Z");

function scope(
  input:
    | { role: "BRAND_OWNER" | "FINANCE_ADMIN" }
    | { role: "CAMPAIGN_MANAGER" },
): BrandPayoutsAuthorizationScopeV1 {
  const common = {
    brandProfileId: "brand-1",
    membershipId: "membership-1",
    authorizedAsOf: authorizedAt,
    authorizationVersion: "membership:7",
  } as const;

  if (input.role === "CAMPAIGN_MANAGER") {
    return {
      ...common,
      kind: "NO_FINANCIAL_ROWS",
      role: input.role,
      reason: "CANONICAL_ENTITY_SCOPE_UNAVAILABLE",
    };
  }

  return { ...common, kind: "FULL_FINANCIAL", role: input.role };
}

describe("Brand Payouts V2 contract", () => {
  it("selects V2 only when its exact media type is explicitly acceptable", () => {
    expect(
      negotiateBrandPayoutsRepresentation(BRAND_PAYOUTS_V2_MEDIA_TYPE),
    ).toBe("V2");
    expect(
      negotiateBrandPayoutsRepresentation(
        `application/json, ${BRAND_PAYOUTS_V2_MEDIA_TYPE}; q=0.8`,
      ),
    ).toBe("V2");
    expect(
      negotiateBrandPayoutsRepresentation([
        "application/json",
        BRAND_PAYOUTS_V2_MEDIA_TYPE.toUpperCase(),
      ]),
    ).toBe("V2");
  });

  it("preserves the legacy representation without an accepted V2 request", () => {
    expect(negotiateBrandPayoutsRepresentation(undefined)).toBe("LEGACY");
    expect(negotiateBrandPayoutsRepresentation("*/*")).toBe("LEGACY");
    expect(negotiateBrandPayoutsRepresentation("application/json")).toBe(
      "LEGACY",
    );
    expect(
      negotiateBrandPayoutsRepresentation(`${BRAND_PAYOUTS_V2_MEDIA_TYPE};q=0`),
    ).toBe("LEGACY");
  });

  it.each(["BRAND_OWNER", "FINANCE_ADMIN"] as const)(
    "permits the %s full projection while retaining universal redaction",
    (role) => {
      const authorization = scope({ role });
      expect(projectBrandPayoutsViewerV2(authorization)).toEqual({
        role,
        projection_scope: "FULL_FINANCIAL",
      });
      expect(resolveBrandPayoutsRedactionPolicyV1(authorization)).toEqual({
        includeExactTreasuryAmounts: true,
        includeOriginalFundingSourceDetails: false,
        includeProviderIdentifiers: false,
        includeCreatorSensitiveDetails: false,
        allowActivityCsv: true,
      });
    },
  );

  it("fails Campaign Manager scope closed without a canonical entity predicate", () => {
    const authorization = scope({ role: "CAMPAIGN_MANAGER" });
    expect(projectBrandPayoutsViewerV2(authorization)).toEqual({
      role: "CAMPAIGN_MANAGER",
      projection_scope: "NO_FINANCIAL_ROWS",
    });
    expect(resolveBrandPayoutsRedactionPolicyV1(authorization)).toEqual({
      includeExactTreasuryAmounts: false,
      includeOriginalFundingSourceDetails: false,
      includeProviderIdentifiers: false,
      includeCreatorSensitiveDetails: false,
      allowActivityCsv: false,
    });
  });

  it("keeps obligation lifecycle distinct from the current execution gate", () => {
    const obligation: BrandPayoutsObligationItemV2 = {
      obligation_id: "obligation-1",
      public_reference: "TCS-PO-0001",
      resource_version: "1",
      campaign_id: "campaign-1",
      collaboration_id: "collaboration-1",
      creator_reference: "creator-1",
      lifecycle: "SCHEDULED",
      current_gate: "CREATOR_SETUP_REQUIRED",
      blocking_reason_code: "CREATOR_SETUP_REQUIRED",
      recovery_reference: "creator-settings:payouts",
      entitlement_value: { amount: "800.00", currency: "INR" },
      settled_value: { amount: "0.00", currency: "INR" },
      reversed_value: { amount: "0.00", currency: "INR" },
      outstanding_value: { amount: "800.00", currency: "INR" },
      payment_due_at: "2026-09-11T10:00:00.000Z",
      last_observed_at: "2026-09-04T12:00:00.000Z",
      legacy: null,
    };

    expect(obligation.lifecycle).toBe("SCHEDULED");
    expect(obligation.current_gate).toBe("CREATOR_SETUP_REQUIRED");
  });

  it("represents unknown historical truth as a limitation instead of inventing it", () => {
    const obligation: BrandPayoutsObligationItemV2 = {
      obligation_id: "legacy-obligation-1",
      public_reference: "TCS-PO-LEGACY-1",
      resource_version: "legacy:1",
      campaign_id: "campaign-legacy",
      collaboration_id: "collaboration-legacy",
      creator_reference: "creator-legacy",
      lifecycle: "LEGACY_UNRECONCILED",
      current_gate: "DEPENDENCY_UNAVAILABLE",
      blocking_reason_code: "HISTORICAL_DUE_EVIDENCE_UNAVAILABLE",
      recovery_reference: null,
      entitlement_value: null,
      settled_value: null,
      reversed_value: null,
      outstanding_value: null,
      payment_due_at: null,
      last_observed_at: "2026-09-04T12:00:00.000Z",
      legacy: {
        classification: "LEGACY_UNRECONCILED",
        limitation_reason_code: "HISTORICAL_DUE_EVIDENCE_UNAVAILABLE",
      },
    };

    expect(obligation.payment_due_at).toBeNull();
    expect(obligation.legacy?.classification).toBe("LEGACY_UNRECONCILED");
  });

  it("keeps overview buckets separate and backend authoritative", () => {
    const unavailable = {
      status: "UNAVAILABLE",
      value: null,
      limitation_reason_code: "SOURCE_NOT_READY",
    } as const;
    const response: BrandPayoutsOverviewResponseV2 = {
      schema_version: "brand-payouts.v2",
      as_of: "2026-09-04T12:00:00.000Z",
      viewer: {
        role: "BRAND_OWNER",
        projection_scope: "FULL_FINANCIAL",
      },
      sections: [
        {
          section_id: "OVERVIEW",
          coverage: "PARTIAL",
          freshness: "CURRENT",
          source_observed_at: "2026-09-04T12:00:00.000Z",
          source_coverage: [
            {
              source: "VAULT",
              status: "AVAILABLE",
              limitation_reason_code: null,
              recovery_hint: null,
            },
            {
              source: "PAYOUT_OBLIGATIONS",
              status: "UNAVAILABLE",
              limitation_reason_code: "CANONICAL_HANDOFF_NOT_READY",
              recovery_hint: null,
            },
          ],
          legacy_limitations: [],
          available_actions: [],
          payload: {
            projection: "FULL_FINANCIAL",
            available_funds: {
              status: "AUTHORITATIVE",
              value: { amount: "1250.00", currency: "INR" },
            },
            pending_funding: unavailable,
            committed_protected_funds: unavailable,
            active_brand_return_commitment: unavailable,
            scheduled_creator_obligations: unavailable,
            processing_creator_obligations: unavailable,
            settled_activity: { ...unavailable, basis: "LIFETIME" },
            action_required_count: unavailable,
          },
        },
      ],
    };

    expect(response.sections[0]?.payload?.projection).toBe("FULL_FINANCIAL");
    expect(response.sections[0]?.coverage).toBe("PARTIAL");
  });

  it("distinguishes activity lifecycle rows from financial movements and page completeness from source completeness", () => {
    const response: BrandPayoutsActivityResponseV2 = {
      schema_version: "brand-payouts.v2",
      as_of: "2026-09-04T12:00:00.000Z",
      viewer: {
        role: "FINANCE_ADMIN",
        projection_scope: "FULL_FINANCIAL",
      },
      sections: [
        {
          section_id: "ACTIVITY",
          coverage: "PARTIAL",
          freshness: "CURRENT",
          source_observed_at: "2026-09-04T11:59:59.000Z",
          source_coverage: [
            {
              source: "FINANCIAL_LEDGER",
              status: "AVAILABLE",
              limitation_reason_code: null,
              recovery_hint: null,
            },
          ],
          legacy_limitations: [],
          available_actions: [],
          payload: [
            {
              activity_id: "obligation:obligation-1:scheduled",
              public_reference: "TCS-PA-0001",
              resource_version: "1",
              source_owner: "PAYOUT_EXECUTION",
              source_reference: "obligation-1",
              category: "BUSINESS_OBLIGATION",
              is_financial_movement: false,
              financial_value: { amount: "800.00", currency: "INR" },
              recorded_at: "2026-09-04T10:00:00.000Z",
              occurred_at: "2026-09-04T10:00:00.000Z",
              source_observed_at: "2026-09-04T10:00:00.000Z",
              normalized_status: "SCHEDULED",
              actor_source: "COLLABORATION_INSTRUCTION",
              references: {
                campaign_id: "campaign-1",
                collaboration_id: "collaboration-1",
                creator_reference: "creator-1",
                obligation_id: "obligation-1",
                brand_return_id: null,
              },
              legacy: null,
            },
          ],
          page: {
            next_cursor: null,
            page_complete: true,
            source_complete: false,
          },
        },
      ],
    };

    const section = response.sections[0];
    expect(section?.payload?.[0]?.is_financial_movement).toBe(false);
    expect(section?.page).toEqual({
      next_cursor: null,
      page_complete: true,
      source_complete: false,
    });
  });
});
