import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CollaborationFulfillmentState,
  CollaborationStage,
  Prisma,
} from "@prisma/client";

import {
  provideFulfillmentSchema,
  reportFulfillmentIssueSchema,
} from "../schemas/collaboration-fulfillment-command.schema";
import { resolveFulfillmentHardStopFinancialOutcome } from "../utils/collaboration-financial-resolution.policy";
import { afterSecurementProgression } from "../utils/collaboration-stage-progression";
import {
  deriveActionRequiredBy,
  deriveAvailableActions,
} from "../utils/collaboration-thread.mapper";

const d = (value: number) => new Prisma.Decimal(value);

function fulfillmentRow(state: CollaborationFulfillmentState): any {
  return {
    sourceApplicationId: "application-1",
    lifecycle: "ACTIVE",
    canonicalStage: "FULFILLMENT",
    fulfillment: { state },
  };
}

test("Fulfillment applicability uses only the locked support flag/state", () => {
  assert.equal(
    afterSecurementProgression(CollaborationFulfillmentState.SKIPPED)
      .canonicalStage,
    CollaborationStage.PRODUCTION,
  );
  assert.equal(
    afterSecurementProgression(CollaborationFulfillmentState.NOT_STARTED)
      .canonicalStage,
    CollaborationStage.FULFILLMENT,
  );
  // No industry input exists: industry cannot affect routing.
  assert.equal(afterSecurementProgression.length, 1);
});

test("Fulfillment action ownership exposes only Phase 4.1 commands", () => {
  const awaitingBrand = fulfillmentRow(
    CollaborationFulfillmentState.AWAITING_BRAND_FULFILLMENT,
  );
  assert.equal(deriveActionRequiredBy(awaitingBrand), "BRAND");
  assert.deepEqual(deriveAvailableActions(awaitingBrand, "BRAND"), [
    "PostCollaborationMessage",
    "ProvideFulfillment",
  ]);

  const awaitingCreator = fulfillmentRow(
    CollaborationFulfillmentState.AWAITING_CREATOR_CONFIRMATION,
  );
  assert.equal(deriveActionRequiredBy(awaitingCreator), "CREATOR");
  assert.deepEqual(deriveAvailableActions(awaitingCreator, "CREATOR"), [
    "PostCollaborationMessage",
    "ConfirmFulfillment",
    "ReportFulfillmentIssue",
  ]);

  const remediation = fulfillmentRow(
    CollaborationFulfillmentState.REMEDIATION_REQUIRED,
  );
  assert.equal(deriveActionRequiredBy(remediation), "BRAND");
  assert.deepEqual(deriveAvailableActions(remediation, "BRAND"), [
    "PostCollaborationMessage",
    "ProvideFulfillmentRemediation",
  ]);
});

test("action-specific validation remains provider neutral", () => {
  assert.equal(
    provideFulfillmentSchema.safeParse({
      commandId: "command-1",
      expectedAggregateVersion: 1,
      genericFulfillmentEvidence: { description: "Delivered in person" },
    }).success,
    true,
  );
  assert.equal(
    reportFulfillmentIssueSchema.safeParse({
      commandId: "command-2",
      expectedAggregateVersion: 2,
      issueCode: "NOT_AS_DESCRIBED",
      description: "The supplied support does not match the brief",
      lifecycle: "TERMINATED",
    }).success,
    false,
  );
});

test("Fulfillment hard-stop refunds the full commercial reserve but excludes charges", () => {
  const result = resolveFulfillmentHardStopFinancialOutcome({
    agreedCreatorFee: d(10_000),
    currency: "INR",
    platformCommissionRateSnapshot: d(7),
    platformCommissionAmount: d(700),
    platformCommissionGstRateSnapshot: d(18),
    platformCommissionGstAmount: d(126),
  });
  assert.equal(result.status, "RESOLVED");
  assert.equal(result.outcome, "FULFILLMENT_HARD_STOP");
  assert.equal(result.creatorGrossEntitlementAmount.toNumber(), 0);
  assert.equal(result.creatorCommercialRefundAmount.toNumber(), 10_000);
  assert.equal(result.platformCommissionRefundAmount.toNumber(), 700);
  assert.equal(result.platformCommissionGstRefundAmount.toNumber(), 126);
  assert.equal(
    result.brandCommercialRefundEntitlementAmount.toNumber(),
    10_826,
  );
  assert.equal(
    result.creatorEntitlementAmount.equals(
      result.creatorGrossEntitlementAmount,
    ),
    true,
  );
  assert.equal(
    result.brandRefundEntitlementAmount.equals(
      result.brandCommercialRefundEntitlementAmount,
    ),
    true,
  );
  assert.ok(!("gatewayProcessingCharge" in result));
  assert.ok(!("tds" in result));
});

test("second issue keeps Creator reporting evidence but attributes the automatic hard-stop to SYSTEM", () => {
  const serviceSource = readFileSync(
    require.resolve("./collaboration-fulfillment.service"),
    "utf8",
  );
  assert.match(serviceSource, /reportedByUserId:\s*user\.id/);
  assert.match(
    serviceSource,
    /endedByActorClass:\s*CollaborationActorClass\.SYSTEM/,
  );
  assert.match(serviceSource, /endedByUserId:\s*null/);
  assert.match(serviceSource, /eventType,\s*actorClass:/);
  assert.doesNotMatch(
    serviceSource,
    /endedByActorClass:\s*CollaborationActorClass\.CREATOR/,
  );

  const resolution = resolveFulfillmentHardStopFinancialOutcome({
    agreedCreatorFee: d(10_000),
    currency: "INR",
    platformCommissionRateSnapshot: d(7),
    platformCommissionAmount: d(700),
    platformCommissionGstRateSnapshot: d(18),
    platformCommissionGstAmount: d(126),
  });
  assert.equal(resolution.decidedByActorClass, "SYSTEM");
  assert.equal(resolution.outcome, "FULFILLMENT_HARD_STOP");
  assert.notEqual(resolution.outcome, "CREATOR_NON_PERFORMANCE");
  assert.notEqual(resolution.outcome, "CREATOR_CANCELLED");
});
