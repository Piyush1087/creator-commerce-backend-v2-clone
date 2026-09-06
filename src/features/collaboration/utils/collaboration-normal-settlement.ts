import {
  CollaborationActorClass,
  CollaborationDeliverableState,
  CollaborationFinancialOutcome,
  CollaborationLifecycle,
  CollaborationPublishingState,
  CollaborationSettlementLegState,
  CollaborationSettlementState,
  CollaborationStage,
  CollaborationStageStatus,
  Prisma,
} from "@prisma/client";

import { commandConflict } from "../errors/collaboration-command.error";
import {
  appendCommandEvent,
  assertExpectedVersion,
  replayOrThrow,
  requestFingerprint,
} from "./collaboration-command-support";
import { resolveFinancialOutcome } from "./collaboration-financial-resolution.policy";

type FinalGateInput = {
  collaborationId: string;
  sourceCommandId: string;
  expectedAggregateVersion: number;
};

export async function establishNormalSettlementEligibilityFromFinalGate(
  tx: Prisma.TransactionClient,
  input: FinalGateInput,
) {
  const commandId = `normal-settlement:${input.sourceCommandId}`;
  const fingerprint = requestFingerprint({
    collaborationId: input.collaborationId,
    commandId,
    expectedAggregateVersion: input.expectedAggregateVersion,
  });
  if (
    await replayOrThrow(
      tx,
      input.collaborationId,
      commandId,
      "NORMAL_SETTLEMENT_ELIGIBILITY_ESTABLISHED",
      fingerprint,
    )
  )
    return;

  const row = await tx.collaboration.findUniqueOrThrow({
    where: { id: input.collaborationId },
    include: {
      commercialAgreement: true,
      deliverables: { include: { publishing: true } },
      financialResolution: true,
      settlement: true,
    },
  });
  assertExpectedVersion(row.aggregateVersion, input.expectedAggregateVersion);
  if (
    !row.sourceApplicationId ||
    row.lifecycle !== CollaborationLifecycle.ACTIVE ||
    row.canonicalStage !== CollaborationStage.PUBLISHING_SETTLEMENT ||
    row.currentStageStatus === CollaborationStageStatus.BLOCKED
  )
    commandConflict(
      "INVALID_STATE",
      "Active canonical Publishing/Settlement Collaboration required",
      row.aggregateVersion,
    );

  const executionComplete = row.deliverables.every(
    (deliverable) =>
      (deliverable.state === CollaborationDeliverableState.APPROVED ||
        deliverable.state === CollaborationDeliverableState.AUTO_APPROVED) &&
      ((!deliverable.publishingRequired &&
        deliverable.publishing?.state ===
          CollaborationPublishingState.PUBLISHING_NOT_REQUIRED) ||
        (deliverable.publishingRequired &&
          deliverable.publishing?.state ===
            CollaborationPublishingState.COMPLIANCE_VERIFIED)),
  );
  if (!executionComplete)
    commandConflict(
      "INVALID_STATE",
      "All execution and Publishing obligations must be complete",
      row.aggregateVersion,
    );
  if (
    row.financialResolution &&
    row.financialResolution.outcome !==
      CollaborationFinancialOutcome.NORMAL_SUCCESS
  )
    commandConflict(
      "INVALID_STATE",
      "Existing financial resolution is incompatible with normal success",
      row.aggregateVersion,
    );
  if (
    row.settlement &&
    row.settlement.state !== CollaborationSettlementState.NOT_ELIGIBLE &&
    row.settlement.state !== CollaborationSettlementState.ELIGIBLE
  )
    commandConflict(
      "INVALID_STATE",
      "Settlement eligibility cannot overwrite execution state",
      row.aggregateVersion,
    );

  const terms = row.commercialAgreement;
  if (
    !terms?.agreedCreatorFee ||
    terms.platformCommissionRateSnapshot === null ||
    terms.platformCommissionAmount === null ||
    terms.platformCommissionGstRateSnapshot === null ||
    terms.platformCommissionGstAmount === null
  )
    commandConflict(
      "INVALID_STATE",
      "Complete locked commercial terms are required",
      row.aggregateVersion,
    );

  const resolution = resolveFinancialOutcome(
    {
      agreedCreatorFee: terms.agreedCreatorFee,
      currency: terms.currency,
      platformCommissionRateSnapshot: terms.platformCommissionRateSnapshot,
      platformCommissionAmount: terms.platformCommissionAmount,
      platformCommissionGstRateSnapshot:
        terms.platformCommissionGstRateSnapshot,
      platformCommissionGstAmount: terms.platformCommissionGstAmount,
    },
    terms.agreedCreatorFee,
    CollaborationFinancialOutcome.NORMAL_SUCCESS,
    "NORMAL_SUCCESS",
  );
  const now = new Date();
  await tx.collaborationFinancialResolution.upsert({
    where: { collaborationId: row.id },
    create: {
      collaborationId: row.id,
      ...resolution,
      decidedAt: now,
      resolvedAt: now,
    },
    update: { ...resolution, decidedAt: now, resolvedAt: now },
  });
  const initialLeg = (amount: Prisma.Decimal) =>
    amount.equals(0)
      ? CollaborationSettlementLegState.NOT_REQUIRED
      : CollaborationSettlementLegState.PENDING;
  await tx.collaborationSettlement.upsert({
    where: { collaborationId: row.id },
    create: {
      collaborationId: row.id,
      state: CollaborationSettlementState.ELIGIBLE,
      creatorPayoutState: initialLeg(resolution.creatorGrossEntitlementAmount),
      brandRefundState: initialLeg(
        resolution.brandCommercialRefundEntitlementAmount,
      ),
      creatorSettlementAmount: resolution.creatorGrossEntitlementAmount,
      brandRefundAmount: resolution.brandCommercialRefundEntitlementAmount,
      currency: resolution.currency,
      eligibleAt: now,
    },
    update: {
      state: CollaborationSettlementState.ELIGIBLE,
      creatorPayoutState: initialLeg(resolution.creatorGrossEntitlementAmount),
      brandRefundState: initialLeg(
        resolution.brandCommercialRefundEntitlementAmount,
      ),
      creatorSettlementAmount: resolution.creatorGrossEntitlementAmount,
      brandRefundAmount: resolution.brandCommercialRefundEntitlementAmount,
      currency: resolution.currency,
      eligibleAt: now,
    },
  });
  const updated = await tx.collaboration.updateMany({
    where: { id: row.id, aggregateVersion: row.aggregateVersion },
    data: { aggregateVersion: { increment: 1 } },
  });
  if (updated.count !== 1)
    commandConflict(
      "STALE_AGGREGATE_VERSION",
      "Collaboration changed while normal Settlement eligibility was established",
      row.aggregateVersion,
    );
  await appendCommandEvent(tx, {
    collaborationId: row.id,
    eventType: "NORMAL_SETTLEMENT_ELIGIBILITY_ESTABLISHED",
    actorClass: CollaborationActorClass.SYSTEM,
    commandId,
    aggregateVersion: row.aggregateVersion + 1,
    requestFingerprint: fingerprint,
    payload: {
      triggeredByCommandId: input.sourceCommandId,
      creatorSettlementAmount:
        resolution.creatorGrossEntitlementAmount.toString(),
      brandRefundAmount:
        resolution.brandCommercialRefundEntitlementAmount.toString(),
      currency: resolution.currency,
    },
  });
}
