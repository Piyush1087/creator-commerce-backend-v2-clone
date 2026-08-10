import { Injectable } from "@nestjs/common";
import {
  CollaborationActorClass,
  CollaborationDeliverableState,
  CollaborationEventKind,
  CollaborationFinancialOutcome,
  CollaborationLifecycle,
  CollaborationPublishingState,
  CollaborationResolutionStatus,
  CollaborationSettlementLegState,
  CollaborationSettlementState,
  CollaborationStage,
  CollaborationStageStatus,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { commandConflict } from "../errors/collaboration-command.error";
import {
  confirmRefundExecutionSchema,
  confirmSettlementExecutionSchema,
  establishNormalSettlementEligibilitySchema,
  requestSettlementExecutionSchema,
} from "../schemas/collaboration-settlement-command.schema";
import {
  appendCommandEvent,
  assertExpectedVersion,
  parseCommand,
  replayOrThrow,
  requestFingerprint,
} from "../utils/collaboration-command-support";
import { resolveFinancialOutcome } from "../utils/collaboration-financial-resolution.policy";
import { COLLABORATION_THREAD_INCLUDE } from "./collaboration-access.service";
import { CollaborationRealtimeService } from "./collaboration-realtime.service";
import { CollaborationSettlementGateway } from "./collaboration-settlement.gateway";

type SettlementRow = Prisma.CollaborationGetPayload<{
  include: typeof COLLABORATION_THREAD_INCLUDE;
}>;

@Injectable()
export class CollaborationSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: CollaborationSettlementGateway,
    private readonly realtime: CollaborationRealtimeService,
  ) {}

  async establishNormalEligibility(raw: unknown) {
    const input = parseCommand(establishNormalSettlementEligibilitySchema, raw);
    const fingerprint = requestFingerprint(input);
    const result = await this.prisma.$transaction(async (tx) => {
      if (
        await replayOrThrow(
          tx,
          input.collaborationId,
          input.commandId,
          "NORMAL_SETTLEMENT_ELIGIBILITY_ESTABLISHED",
          fingerprint,
        )
      )
        return { replayed: true };
      const row = await this.load(tx, input.collaborationId);
      assertExpectedVersion(
        row.aggregateVersion,
        input.expectedAggregateVersion,
      );
      this.assertNormalSuccessGates(row);
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
      const terms = this.completeTerms(row);
      const resolution = resolveFinancialOutcome(
        terms,
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
      await tx.collaborationSettlement.upsert({
        where: { collaborationId: row.id },
        create: {
          collaborationId: row.id,
          state: CollaborationSettlementState.ELIGIBLE,
          creatorPayoutState: this.initialLeg(
            resolution.creatorGrossEntitlementAmount,
          ),
          brandRefundState: this.initialLeg(
            resolution.brandCommercialRefundEntitlementAmount,
          ),
          creatorSettlementAmount: resolution.creatorGrossEntitlementAmount,
          brandRefundAmount: resolution.brandCommercialRefundEntitlementAmount,
          currency: resolution.currency,
          eligibleAt: now,
        },
        update: {
          state: CollaborationSettlementState.ELIGIBLE,
          creatorPayoutState: this.initialLeg(
            resolution.creatorGrossEntitlementAmount,
          ),
          brandRefundState: this.initialLeg(
            resolution.brandCommercialRefundEntitlementAmount,
          ),
          creatorSettlementAmount: resolution.creatorGrossEntitlementAmount,
          brandRefundAmount: resolution.brandCommercialRefundEntitlementAmount,
          currency: resolution.currency,
          eligibleAt: now,
        },
      });
      await this.bump(tx, row);
      await appendCommandEvent(tx, {
        collaborationId: row.id,
        eventType: "NORMAL_SETTLEMENT_ELIGIBILITY_ESTABLISHED",
        actorClass: CollaborationActorClass.SYSTEM,
        commandId: input.commandId,
        aggregateVersion: row.aggregateVersion + 1,
        requestFingerprint: fingerprint,
        payload: {
          creatorSettlementAmount:
            resolution.creatorGrossEntitlementAmount.toString(),
          brandRefundAmount:
            resolution.brandCommercialRefundEntitlementAmount.toString(),
          currency: resolution.currency,
        },
      });
      return { replayed: false };
    });
    if (!result.replayed)
      void this.realtime.broadcast(input.collaborationId, "thread.updated");
    return result;
  }

  async requestExecution(raw: unknown) {
    const input = parseCommand(requestSettlementExecutionSchema, raw);
    const fingerprint = requestFingerprint(input);
    const prepared = await this.prisma.$transaction(async (tx) => {
      if (
        await replayOrThrow(
          tx,
          input.collaborationId,
          input.commandId,
          "SETTLEMENT_EXECUTION_REQUESTED",
          fingerprint,
        )
      )
        return { replayed: true as const };
      const row = await this.load(tx, input.collaborationId);
      assertExpectedVersion(
        row.aggregateVersion,
        input.expectedAggregateVersion,
      );
      const resolution = this.resolvedEntitlement(row);
      const settlement = await this.ensureEligibleSettlement(
        tx,
        row,
        resolution,
      );
      if (settlement.state !== CollaborationSettlementState.ELIGIBLE)
        commandConflict(
          "INVALID_STATE",
          "Settlement is not eligible for execution",
          row.aggregateVersion,
        );
      const payoutRequired = settlement.creatorSettlementAmount!.greaterThan(0);
      const refundRequired = settlement.brandRefundAmount!.greaterThan(0);
      const payoutInstructionRef = payoutRequired
        ? (settlement.payoutInstructionRef ??
          `collaboration:${row.id}:creator-payout`)
        : null;
      const refundInstructionRef = refundRequired
        ? (settlement.refundInstructionRef ??
          `collaboration:${row.id}:brand-refund`)
        : null;
      await tx.collaborationSettlement.update({
        where: { id: settlement.id },
        data: {
          payoutInstructionRef,
          refundInstructionRef,
          creatorPayoutState: payoutRequired
            ? CollaborationSettlementLegState.PENDING
            : CollaborationSettlementLegState.NOT_REQUIRED,
          brandRefundState: refundRequired
            ? CollaborationSettlementLegState.PENDING
            : CollaborationSettlementLegState.NOT_REQUIRED,
        },
      });
      return {
        replayed: false as const,
        version: row.aggregateVersion,
        instruction: {
          collaborationId: row.id,
          settlementId: settlement.id,
          financialResolutionId: resolution.id,
          creatorUserId: row.creatorUserId,
          brandProfileId: row.brandProfileId,
          currency: settlement.currency!,
          creatorPayoutAmount: settlement.creatorSettlementAmount!.toFixed(2),
          brandRefundAmount: settlement.brandRefundAmount!.toFixed(2),
          escrowLockRef: row.commercialAgreement?.escrowLockRef ?? null,
          payoutInstructionRef,
          refundInstructionRef,
          idempotencyKey: `collaboration-settlement:${settlement.id}`,
        },
      };
    });
    if (prepared.replayed) return { replayed: true };
    const noExternalLegs =
      prepared.instruction.creatorPayoutAmount === "0.00" &&
      prepared.instruction.brandRefundAmount === "0.00";
    const acceptance = noExternalLegs
      ? { status: "ALREADY_ACCEPTED" as const }
      : await this.gateway.requestExecution(prepared.instruction);
    if (
      acceptance.status === "REJECTED" ||
      acceptance.status === "RETRYABLE_FAILURE"
    )
      return {
        replayed: false,
        accepted: false,
        retryable: acceptance.status === "RETRYABLE_FAILURE",
      };

    const result = await this.prisma.$transaction(async (tx) => {
      const row = await this.load(tx, input.collaborationId);
      assertExpectedVersion(row.aggregateVersion, prepared.version);
      const settlement = row.settlement!;
      const now = new Date();
      const complete =
        settlement.creatorSettlementAmount!.equals(0) &&
        settlement.brandRefundAmount!.equals(0);
      await tx.collaborationSettlement.update({
        where: { id: settlement.id },
        data: {
          state: complete
            ? CollaborationSettlementState.SETTLED
            : CollaborationSettlementState.PROCESSING,
          creatorPayoutState: settlement.creatorSettlementAmount!.equals(0)
            ? CollaborationSettlementLegState.NOT_REQUIRED
            : CollaborationSettlementLegState.PROCESSING,
          brandRefundState: settlement.brandRefundAmount!.equals(0)
            ? CollaborationSettlementLegState.NOT_REQUIRED
            : CollaborationSettlementLegState.PROCESSING,
          processingAt: now,
          settledAt: complete ? now : null,
        },
      });
      if (complete && row.lifecycle === CollaborationLifecycle.ACTIVE)
        await this.initializeFeedbackWindow(tx, row.id, now);
      await this.bump(
        tx,
        row,
        complete && row.lifecycle === CollaborationLifecycle.ACTIVE
          ? {
              lifecycle: CollaborationLifecycle.COMPLETED,
              currentStageStatus: CollaborationStageStatus.COMPLETED,
              completedAt: now,
            }
          : undefined,
      );
      await appendCommandEvent(tx, {
        collaborationId: row.id,
        eventType: "SETTLEMENT_EXECUTION_REQUESTED",
        actorClass: CollaborationActorClass.SYSTEM,
        commandId: input.commandId,
        aggregateVersion: row.aggregateVersion + 1,
        requestFingerprint: fingerprint,
        payload: {
          ...prepared.instruction,
          requestStatus: acceptance.status,
          zeroCashCompleted: complete,
        },
      });
      if (complete)
        await this.appendCompletionEvents(
          tx,
          row,
          row.lifecycle === CollaborationLifecycle.ACTIVE,
          now,
        );
      return { replayed: false, accepted: true };
    });
    void this.realtime.broadcast(input.collaborationId, "thread.updated");
    return result;
  }

  confirmCreatorSettlement(raw: unknown) {
    return this.confirmLeg("CREATOR", raw);
  }

  confirmBrandRefund(raw: unknown) {
    return this.confirmLeg("BRAND", raw);
  }

  private async confirmLeg(leg: "CREATOR" | "BRAND", raw: unknown) {
    const input: any =
      leg === "CREATOR"
        ? parseCommand(confirmSettlementExecutionSchema, raw)
        : parseCommand(confirmRefundExecutionSchema, raw);
    const eventType =
      leg === "CREATOR"
        ? "CREATOR_SETTLEMENT_CONFIRMED"
        : "BRAND_REFUND_CONFIRMED";
    const fingerprint = requestFingerprint(input);
    const result = await this.prisma.$transaction(async (tx) => {
      if (
        await replayOrThrow(
          tx,
          input.collaborationId,
          input.commandId,
          eventType,
          fingerprint,
        )
      )
        return { replayed: true };
      const row = await this.load(tx, input.collaborationId);
      assertExpectedVersion(
        row.aggregateVersion,
        input.expectedAggregateVersion,
      );
      const settlement = row.settlement;
      if (
        !settlement ||
        settlement.state !== CollaborationSettlementState.PROCESSING
      )
        commandConflict(
          "INVALID_STATE",
          "Settlement is not processing",
          row.aggregateVersion,
        );
      const expectedAmount =
        leg === "CREATOR"
          ? settlement.creatorSettlementAmount!
          : settlement.brandRefundAmount!;
      const instructionRef =
        leg === "CREATOR"
          ? settlement.payoutInstructionRef
          : settlement.refundInstructionRef;
      const suppliedInstructionRef =
        leg === "CREATOR"
          ? input.payoutInstructionRef
          : input.refundInstructionRef;
      const currentState =
        leg === "CREATOR"
          ? settlement.creatorPayoutState
          : settlement.brandRefundState;
      const executionRef =
        leg === "CREATOR" ? input.payoutExecutionRef : input.refundExecutionRef;
      const existingExecutionRef =
        leg === "CREATOR"
          ? settlement.payoutExecutionRef
          : settlement.refundExecutionRef;
      const existingConfirmationRef =
        leg === "CREATOR"
          ? settlement.payoutConfirmationRef
          : settlement.refundConfirmationRef;
      if (
        !expectedAmount.equals(new Prisma.Decimal(input.amount)) ||
        settlement.currency !== input.currency ||
        instructionRef !== suppliedInstructionRef
      )
        commandConflict(
          "INVALID_STATE",
          "Confirmation does not match canonical settlement instruction",
          row.aggregateVersion,
        );
      if (currentState === CollaborationSettlementLegState.CONFIRMED) {
        if (
          existingExecutionRef === executionRef &&
          existingConfirmationRef === input.authoritativeConfirmationRef
        )
          return { replayed: true };
        commandConflict(
          "INVALID_STATE",
          "Settlement leg was already confirmed with different evidence",
          row.aggregateVersion,
        );
      }
      if (currentState !== CollaborationSettlementLegState.PROCESSING)
        commandConflict(
          "INVALID_STATE",
          "Settlement leg is not awaiting confirmation",
          row.aggregateVersion,
        );
      const otherState =
        leg === "CREATOR"
          ? settlement.brandRefundState
          : settlement.creatorPayoutState;
      const otherSatisfied =
        otherState === CollaborationSettlementLegState.CONFIRMED ||
        otherState === CollaborationSettlementLegState.NOT_REQUIRED;
      const complete = otherSatisfied;
      const now = new Date();
      await tx.collaborationSettlement.update({
        where: { id: settlement.id },
        data: {
          ...(leg === "CREATOR"
            ? {
                creatorPayoutState: CollaborationSettlementLegState.CONFIRMED,
                payoutExecutionRef: executionRef,
                payoutConfirmationRef: input.authoritativeConfirmationRef,
              }
            : {
                brandRefundState: CollaborationSettlementLegState.CONFIRMED,
                refundExecutionRef: executionRef,
                refundConfirmationRef: input.authoritativeConfirmationRef,
              }),
          authoritativeConfirmationRef: complete
            ? input.authoritativeConfirmationRef
            : settlement.authoritativeConfirmationRef,
          state: complete
            ? CollaborationSettlementState.SETTLED
            : CollaborationSettlementState.PROCESSING,
          settledAt: complete ? now : null,
        },
      });
      if (complete && row.lifecycle === CollaborationLifecycle.ACTIVE)
        await this.initializeFeedbackWindow(tx, row.id, now);
      await this.bump(
        tx,
        row,
        complete && row.lifecycle === CollaborationLifecycle.ACTIVE
          ? {
              lifecycle: CollaborationLifecycle.COMPLETED,
              currentStageStatus: CollaborationStageStatus.COMPLETED,
              completedAt: now,
            }
          : undefined,
      );
      await appendCommandEvent(tx, {
        collaborationId: row.id,
        eventType,
        actorClass: CollaborationActorClass.SYSTEM,
        commandId: input.commandId,
        aggregateVersion: row.aggregateVersion + 1,
        requestFingerprint: fingerprint,
        payload: {
          amount: expectedAmount.toString(),
          currency: settlement.currency,
          executionRef,
          settlementCompleted: complete,
        },
      });
      if (complete)
        await this.appendCompletionEvents(
          tx,
          row,
          row.lifecycle === CollaborationLifecycle.ACTIVE,
          now,
        );
      return { replayed: false, settled: complete };
    });
    if (!result.replayed)
      void this.realtime.broadcast(input.collaborationId, "thread.updated");
    return result;
  }

  private initializeFeedbackWindow(
    tx: Prisma.TransactionClient,
    collaborationId: string,
    completedAt: Date,
  ) {
    return tx.collaborationFeedbackWindow.upsert({
      where: { collaborationId },
      create: {
        collaborationId,
        openedAt: completedAt,
        closesAt: new Date(completedAt.getTime() + 48 * 60 * 60 * 1000),
      },
      update: {},
    });
  }

  private assertNormalSuccessGates(row: SettlementRow) {
    if (
      !row.sourceApplicationId ||
      row.lifecycle !== CollaborationLifecycle.ACTIVE ||
      row.canonicalStage !== CollaborationStage.PUBLISHING_SETTLEMENT
    )
      commandConflict(
        "INVALID_STATE",
        "Canonical active Publishing/Settlement Collaboration required",
        row.aggregateVersion,
      );
    if (
      row.currentStageStatus === CollaborationStageStatus.BLOCKED ||
      row.deliverables.some(
        (d) =>
          d.state === CollaborationDeliverableState.HARD_STOP ||
          d.publishing?.state === CollaborationPublishingState.BLOCKED,
      )
    )
      commandConflict(
        "INVALID_STATE",
        "Blocked Collaboration is not normally settlement eligible",
        row.aggregateVersion,
      );
    const complete = row.deliverables.every(
      (d) =>
        (d.state === CollaborationDeliverableState.APPROVED ||
          d.state === CollaborationDeliverableState.AUTO_APPROVED) &&
        ((!d.publishingRequired &&
          d.publishing?.state ===
            CollaborationPublishingState.PUBLISHING_NOT_REQUIRED) ||
          (d.publishingRequired &&
            d.publishing?.state ===
              CollaborationPublishingState.COMPLIANCE_VERIFIED)),
    );
    if (!complete)
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
  }

  private resolvedEntitlement(row: SettlementRow) {
    const resolution = row.financialResolution;
    if (
      !resolution ||
      resolution.status !== CollaborationResolutionStatus.RESOLVED ||
      !resolution.creatorGrossEntitlementAmount ||
      !resolution.brandCommercialRefundEntitlementAmount ||
      !resolution.currency
    )
      commandConflict(
        "INVALID_STATE",
        "Resolved financial entitlement is required",
        row.aggregateVersion,
      );
    return resolution;
  }

  private async ensureEligibleSettlement(
    tx: Prisma.TransactionClient,
    row: SettlementRow,
    resolution: NonNullable<SettlementRow["financialResolution"]>,
  ) {
    if (row.settlement) return row.settlement;
    if (
      row.lifecycle === CollaborationLifecycle.ACTIVE &&
      resolution.outcome !== CollaborationFinancialOutcome.NORMAL_SUCCESS
    )
      commandConflict(
        "INVALID_STATE",
        "Active Collaboration requires normal-success entitlement",
        row.aggregateVersion,
      );
    return tx.collaborationSettlement.create({
      data: {
        collaborationId: row.id,
        state: CollaborationSettlementState.ELIGIBLE,
        creatorPayoutState: this.initialLeg(
          resolution.creatorGrossEntitlementAmount!,
        ),
        brandRefundState: this.initialLeg(
          resolution.brandCommercialRefundEntitlementAmount!,
        ),
        creatorSettlementAmount: resolution.creatorGrossEntitlementAmount,
        brandRefundAmount: resolution.brandCommercialRefundEntitlementAmount,
        currency: resolution.currency,
        eligibleAt: new Date(),
      },
    });
  }

  private initialLeg(amount: Prisma.Decimal) {
    return amount.equals(0)
      ? CollaborationSettlementLegState.NOT_REQUIRED
      : CollaborationSettlementLegState.PENDING;
  }

  private completeTerms(row: SettlementRow) {
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
    return {
      agreedCreatorFee: terms.agreedCreatorFee,
      currency: terms.currency,
      platformCommissionRateSnapshot: terms.platformCommissionRateSnapshot,
      platformCommissionAmount: terms.platformCommissionAmount,
      platformCommissionGstRateSnapshot:
        terms.platformCommissionGstRateSnapshot,
      platformCommissionGstAmount: terms.platformCommissionGstAmount,
    };
  }

  private async bump(
    tx: Prisma.TransactionClient,
    row: SettlementRow,
    extra?: Prisma.CollaborationUpdateManyMutationInput,
  ) {
    const updated = await tx.collaboration.updateMany({
      where: { id: row.id, aggregateVersion: row.aggregateVersion },
      data: { aggregateVersion: { increment: 1 }, ...extra },
    });
    if (updated.count !== 1)
      commandConflict(
        "STALE_AGGREGATE_VERSION",
        "Collaboration changed while Settlement command executed",
        row.aggregateVersion,
      );
  }

  private async appendCompletionEvents(
    tx: Prisma.TransactionClient,
    row: SettlementRow,
    collaborationCompleted: boolean,
    now: Date,
  ) {
    await tx.collaborationEvent.createMany({
      data: [
        {
          collaborationId: row.id,
          kind: CollaborationEventKind.DOMAIN,
          eventType: "SETTLEMENT_COMPLETED",
          actorClass: CollaborationActorClass.SYSTEM,
          aggregateVersion: row.aggregateVersion + 1,
          occurredAt: now,
        },
        ...(collaborationCompleted
          ? [
              {
                collaborationId: row.id,
                kind: CollaborationEventKind.DOMAIN,
                eventType: "COLLABORATION_COMPLETED",
                actorClass: CollaborationActorClass.SYSTEM,
                aggregateVersion: row.aggregateVersion + 1,
                occurredAt: now,
              },
            ]
          : []),
      ],
    });
  }

  private load(tx: Prisma.TransactionClient, collaborationId: string) {
    return tx.collaboration.findUniqueOrThrow({
      where: { id: collaborationId },
      include: COLLABORATION_THREAD_INCLUDE,
    });
  }
}
