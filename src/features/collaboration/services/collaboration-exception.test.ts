import assert from "node:assert/strict";
import test from "node:test";

import {
  CollaborationDeliverableState,
  CollaborationFinancialOutcome,
  CollaborationLifecycle,
  CollaborationPublicationAuthorizationState,
  CollaborationPublishingState,
  CollaborationSecurementState,
  Prisma,
} from "@prisma/client";

import { applyAdminResolutionSchema } from "../schemas/collaboration-exception-command.schema";
import {
  resolveDeterministicExceptionPolicy,
  validateAdminEconomicAllocation,
} from "../utils/collaboration-exception.policy";
import { resolveFinancialOutcome } from "../utils/collaboration-financial-resolution.policy";

const d = (value: number) => new Prisma.Decimal(value);
const row = (secured: boolean) =>
  ({
    aggregateVersion: 4,
    commercialAgreement: {
      securementState: secured
        ? CollaborationSecurementState.COMPLETED
        : CollaborationSecurementState.AWAITING_ESCROW_FUNDING,
      advanceAmount: d(250),
    },
    deliverables: [],
  }) as any;

test("deterministic exits preserve the frozen economic policies", () => {
  const brand = resolveDeterministicExceptionPolicy(row(true), "BRAND_END");
  assert.equal(brand.lifecycle, CollaborationLifecycle.CANCELLED);
  assert.equal(
    brand.financialOutcome,
    CollaborationFinancialOutcome.BRAND_PROTECTED_POST_SECUREMENT_EXIT,
  );
  assert.equal(brand.entitlement, "ADVANCE");

  const creator = resolveDeterministicExceptionPolicy(
    row(true),
    "CREATOR_CANCEL",
  );
  assert.equal(creator.lifecycle, CollaborationLifecycle.CANCELLED);
  assert.equal(creator.entitlement, "ZERO");

  const nonPerformance = resolveDeterministicExceptionPolicy(
    row(true),
    "CREATOR_NON_PERFORMANCE",
  );
  assert.equal(nonPerformance.lifecycle, CollaborationLifecycle.TERMINATED);
  assert.equal(nonPerformance.entitlement, "ZERO");
});

test("publishing non-performance requires an authorized publishing obligation", () => {
  const subject = row(true);
  subject.deliverables = [
    {
      publishingRequired: true,
      state: CollaborationDeliverableState.AUTO_APPROVED,
      publishing: {
        state: CollaborationPublishingState.AWAITING_PUBLISHING,
        authorizationState:
          CollaborationPublicationAuthorizationState.NOT_AUTHORIZED,
      },
    },
  ];
  assert.throws(() =>
    resolveDeterministicExceptionPolicy(
      subject,
      "CREATOR_PUBLISHING_NON_PERFORMANCE",
    ),
  );
  subject.deliverables[0].publishing.authorizationState =
    CollaborationPublicationAuthorizationState.AUTHORIZED;
  assert.equal(
    resolveDeterministicExceptionPolicy(
      subject,
      "CREATOR_PUBLISHING_NON_PERFORMANCE",
    ).financialOutcome,
    CollaborationFinancialOutcome.CREATOR_PUBLISHING_NON_PERFORMANCE,
  );
});

test("ApplyAdminResolution accepts only frozen economic inputs", () => {
  const input = {
    collaborationId: "10000000-0000-4000-8000-000000000001",
    commandId: "20000000-0000-4000-8000-000000000001",
    expectedAggregateVersion: 4,
    creatorEntitlementAmount: "600.00",
    brandRefundEntitlementAmount: "400.00",
    currency: "inr",
    reasonCode: "ADMIN_RESOLUTION",
    reasonText: "Evidence reviewed",
    resolutionEvidence: { caseRef: "CASE-9" },
    residualObligations: { takedown: true },
  };
  assert.equal(applyAdminResolutionSchema.parse(input).currency, "INR");
  assert.throws(() =>
    applyAdminResolutionSchema.parse({
      ...input,
      platformCommissionRetainedAmount: 10,
    }),
  );
});

test("Admin allocation cannot exceed or create the locked Creator fee", () => {
  const valid = {
    agreedCreatorFee: d(1000),
    creatorEntitlementAmount: d(600),
    brandRefundEntitlementAmount: d(400),
    aggregateVersion: 4,
  };
  assert.doesNotThrow(() => validateAdminEconomicAllocation(valid));
  assert.throws(() =>
    validateAdminEconomicAllocation({
      ...valid,
      creatorEntitlementAmount: d(1001),
      brandRefundEntitlementAmount: d(0),
    }),
  );
  assert.throws(() =>
    validateAdminEconomicAllocation({
      ...valid,
      brandRefundEntitlementAmount: d(399),
    }),
  );
});

test("backend derives commission and GST from the Admin economic allocation", () => {
  const result = resolveFinancialOutcome(
    {
      agreedCreatorFee: d(1000),
      platformCommissionRateSnapshot: d(10),
      platformCommissionAmount: d(100),
      platformCommissionGstRateSnapshot: d(18),
      platformCommissionGstAmount: d(18),
      currency: "INR",
    } as any,
    d(600),
    CollaborationFinancialOutcome.ADMIN_RESOLUTION,
    "ADMIN_RESOLUTION",
  );
  assert.equal(result.creatorGrossEntitlementAmount.toString(), "600");
  assert.equal(result.creatorCommercialRefundAmount.toString(), "400");
  assert.equal(result.platformCommissionRetainedAmount.toString(), "60");
  assert.equal(result.platformCommissionRefundAmount.toString(), "40");
  assert.equal(result.platformCommissionGstRetainedAmount.toString(), "10.8");
  assert.equal(result.platformCommissionGstRefundAmount.toString(), "7.2");
  assert.equal(
    result.brandCommercialRefundEntitlementAmount.toString(),
    "447.2",
  );
});
