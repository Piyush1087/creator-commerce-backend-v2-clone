import { Injectable } from "@nestjs/common";
import {
  CollaborationActorClass,
  CollaborationFinancialOutcome,
  CollaborationLifecycle,
  CollaborationNegotiationState,
  CollaborationPaymentRail,
  CollaborationResolutionStatus,
  CollaborationSecurementState,
  CollaborationStage,
  CollaborationStageStatus,
  Prisma,
  UceMilestoneStage,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import {
  commandConflict,
  unauthorizedActor,
} from "../errors/collaboration-command.error";
import {
  collaborationCommandEnvelopeSchema,
  counterCreatorProposalSchema,
  declineNegotiationSchema,
  type CollaborationCommandEnvelope,
  type CounterCreatorProposalInput,
  type DeclineNegotiationInput,
} from "../schemas/collaboration-commercial-command.schema";
import {
  appendCommandEvent,
  assertExpectedVersion,
  parseCommand,
  replayOrThrow,
  requestFingerprint,
} from "../utils/collaboration-command-support";
import { afterSecurementProgression } from "../utils/collaboration-stage-progression";
import { projectCanonicalCollaborationDetail } from "../utils/collaboration-thread.mapper";
import {
  COLLABORATION_THREAD_INCLUDE,
  CollaborationAccessService,
} from "./collaboration-access.service";
import { CollaborationRealtimeService } from "./collaboration-realtime.service";
import { CollaborationPaymentCapabilityService } from "./collaboration-payment-capability.service";

@Injectable()
export class CollaborationNegotiationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CollaborationAccessService,
    private readonly realtime: CollaborationRealtimeService,
    private readonly paymentCapabilities: CollaborationPaymentCapabilityService,
  ) {}

  acceptProposedFee(user: AuthUser, collaborationId: string, raw: unknown) {
    const input = parseCommand(collaborationCommandEnvelopeSchema, raw);
    return this.lockTerms(
      user,
      collaborationId,
      input,
      "CREATOR_PROPOSAL_ACCEPTED",
      "APPLICATION_PROPOSAL",
    );
  }

  async counterOffer(user: AuthUser, collaborationId: string, raw: unknown) {
    this.assertRole(user, UserRole.BRAND);
    const input = parseCommand(counterCreatorProposalSchema, raw);
    const fingerprint = requestFingerprint(input);
    await this.access.assertThreadForUser(user, collaborationId);

    await this.prisma.$transaction(async (tx) => {
      if (
        await replayOrThrow(
          tx,
          collaborationId,
          input.commandId,
          "CREATOR_PROPOSAL_COUNTERED",
          fingerprint,
        )
      )
        return;
      const row = await this.load(tx, collaborationId);
      this.assertNegotiation(row);
      const agreement = row.commercialAgreement!;
      this.assertRole(user, UserRole.BRAND);
      assertExpectedVersion(
        row.aggregateVersion,
        input.expectedAggregateVersion,
      );
      if (agreement.brandCounterFee !== null) {
        commandConflict(
          "COUNTER_OFFER_ALREADY_USED",
          "The single Brand counter-offer has already been used",
          row.aggregateVersion,
        );
      }
      if (
        agreement.negotiationState !==
        CollaborationNegotiationState.AWAITING_BRAND_DECISION
      ) {
        commandConflict(
          "INVALID_STATE",
          "Brand counter is not available",
          row.aggregateVersion,
        );
      }
      const version = row.aggregateVersion + 1;
      await tx.collaborationCommercialAgreement.update({
        where: { collaborationId },
        data: {
          brandCounterFee: new Prisma.Decimal(input.counterFee),
          negotiationState:
            CollaborationNegotiationState.AWAITING_CREATOR_DECISION,
        },
      });
      await this.bump(tx, collaborationId, row.aggregateVersion);
      await appendCommandEvent(tx, {
        collaborationId,
        eventType: "CREATOR_PROPOSAL_COUNTERED",
        actorClass: CollaborationActorClass.BRAND,
        actorUserId: user.id,
        commandId: input.commandId,
        aggregateVersion: version,
        requestFingerprint: fingerprint,
        payload: {
          counterFee: input.counterFee,
          currency: agreement.currency,
        },
      });
    });
    return this.result(user, collaborationId);
  }

  acceptCounterOffer(user: AuthUser, collaborationId: string, raw: unknown) {
    const input = parseCommand(collaborationCommandEnvelopeSchema, raw);
    return this.lockTerms(
      user,
      collaborationId,
      input,
      "BRAND_COUNTER_ACCEPTED",
      "BRAND_COUNTER",
    );
  }

  async decline(user: AuthUser, collaborationId: string, raw: unknown) {
    const input = parseCommand(declineNegotiationSchema, raw);
    const fingerprint = requestFingerprint(input);
    await this.access.assertThreadForUser(user, collaborationId);
    const actorClass =
      user.role === UserRole.BRAND
        ? CollaborationActorClass.BRAND
        : user.role === UserRole.CREATOR
          ? CollaborationActorClass.CREATOR
          : unauthorizedActor("Brand or Creator access required");

    await this.prisma.$transaction(async (tx) => {
      if (
        await replayOrThrow(
          tx,
          collaborationId,
          input.commandId,
          "NEGOTIATION_DECLINED",
          fingerprint,
        )
      )
        return;
      const row = await this.load(tx, collaborationId);
      this.assertNegotiation(row);
      assertExpectedVersion(
        row.aggregateVersion,
        input.expectedAggregateVersion,
      );
      const state = row.commercialAgreement?.negotiationState;
      const actorCanDecline =
        (actorClass === CollaborationActorClass.BRAND &&
          state === CollaborationNegotiationState.AWAITING_BRAND_DECISION) ||
        (actorClass === CollaborationActorClass.CREATOR &&
          state === CollaborationNegotiationState.AWAITING_CREATOR_DECISION);
      if (!actorCanDecline)
        commandConflict(
          "INVALID_STATE",
          "Negotiation cannot be declined by this actor",
          row.aggregateVersion,
        );
      const version = row.aggregateVersion + 1;
      const now = new Date();
      await tx.collaborationCommercialAgreement.update({
        where: { collaborationId },
        data: { negotiationState: CollaborationNegotiationState.FAILED },
      });
      const updated = await tx.collaboration.updateMany({
        where: { id: collaborationId, aggregateVersion: row.aggregateVersion },
        data: {
          lifecycle: CollaborationLifecycle.CANCELLED,
          currentStageStatus: CollaborationStageStatus.COMPLETED,
          aggregateVersion: { increment: 1 },
          endedFromStage: CollaborationStage.NEGOTIATION,
          endedReasonCode: input.reasonCode,
          endedReasonText: input.reasonText,
          endedByActorClass: actorClass,
          endedByUserId: user.id,
          endedAt: now,
        },
      });
      if (updated.count !== 1) this.stale(row.aggregateVersion);
      await tx.collaborationFinancialResolution.upsert({
        where: { collaborationId },
        create: {
          collaborationId,
          status: CollaborationResolutionStatus.RESOLVED,
          outcome: CollaborationFinancialOutcome.NEGOTIATION_EXIT,
          creatorEntitlementAmount: new Prisma.Decimal(0),
          brandRefundEntitlementAmount: new Prisma.Decimal(0),
          currency: row.commercialAgreement?.currency,
          reasonCode: input.reasonCode,
          reasonText: input.reasonText,
          decidedByActorClass: actorClass,
          decidedByUserId: user.id,
          decidedAt: now,
          resolvedAt: now,
        },
        update: {},
      });
      await appendCommandEvent(tx, {
        collaborationId,
        eventType: "NEGOTIATION_DECLINED",
        actorClass,
        actorUserId: user.id,
        commandId: input.commandId,
        aggregateVersion: version,
        requestFingerprint: fingerprint,
        payload: { reasonCode: input.reasonCode },
      });
    });
    return this.result(user, collaborationId);
  }

  private async lockTerms(
    user: AuthUser,
    collaborationId: string,
    input: CollaborationCommandEnvelope,
    eventType: string,
    feeSource: "APPLICATION_PROPOSAL" | "BRAND_COUNTER",
  ) {
    const requiredRole =
      feeSource === "APPLICATION_PROPOSAL" ? UserRole.BRAND : UserRole.CREATOR;
    this.assertRole(user, requiredRole);
    const fingerprint = requestFingerprint(input);
    await this.access.assertThreadForUser(user, collaborationId);
    await this.prisma.$transaction(async (tx) => {
      if (
        await replayOrThrow(
          tx,
          collaborationId,
          input.commandId,
          eventType,
          fingerprint,
        )
      )
        return;
      const row = await this.load(tx, collaborationId);
      this.assertNegotiation(row);
      assertExpectedVersion(
        row.aggregateVersion,
        input.expectedAggregateVersion,
      );
      const agreement = row.commercialAgreement;
      if (!agreement)
        commandConflict(
          "INVALID_STATE",
          "Commercial agreement is missing",
          row.aggregateVersion,
        );
      if (
        agreement.termsLockedAt ||
        agreement.negotiationState === CollaborationNegotiationState.LOCKED ||
        agreement.negotiationState ===
          CollaborationNegotiationState.NOT_REQUIRED
      ) {
        commandConflict(
          "NEGOTIATION_ALREADY_LOCKED",
          "Commercial terms are already locked",
          row.aggregateVersion,
        );
      }
      const expectedState =
        feeSource === "APPLICATION_PROPOSAL"
          ? CollaborationNegotiationState.AWAITING_BRAND_DECISION
          : CollaborationNegotiationState.AWAITING_CREATOR_DECISION;
      if (agreement.negotiationState !== expectedState)
        commandConflict(
          "INVALID_STATE",
          "Negotiation decision is not available",
          row.aggregateVersion,
        );
      const fee =
        feeSource === "APPLICATION_PROPOSAL"
          ? agreement.applicationProposedFee
          : agreement.brandCounterFee;
      if (fee === null)
        commandConflict(
          "INVALID_STATE",
          "Authoritative fee is missing",
          row.aggregateVersion,
        );
      const advanceAmount = fee
        .mul(agreement.advancePercentageSnapshot)
        .div(100);
      const balanceAmount = fee.minus(advanceAmount);
      if (
        agreement.paymentRail === CollaborationPaymentRail.MANUAL &&
        !this.paymentCapabilities.manualEnabledForNewObligations()
      ) {
        commandConflict(
          "MANUAL_PAYMENT_DISABLED",
          "Manual payment is disabled for new obligations",
          row.aggregateVersion,
        );
      }
      let securementState: CollaborationSecurementState;
      if (fee.isZero())
        securementState = CollaborationSecurementState.NOT_REQUIRED;
      else if (
        agreement.paymentRail === CollaborationPaymentRail.PLATFORM_ESCROW
      )
        securementState = CollaborationSecurementState.AWAITING_ESCROW_FUNDING;
      else {
        const profile = row.creatorUser.creatorProfile;
        const payout = profile
          ? await tx.creatorSettlementProfile.findUnique({
              where: { creatorProfileId: profile.id },
              select: { id: true },
            })
          : null;
        securementState = payout
          ? CollaborationSecurementState.AWAITING_BRAND_PAYMENT
          : CollaborationSecurementState.AWAITING_PAYOUT_DETAILS;
      }
      const progression =
        securementState === CollaborationSecurementState.NOT_REQUIRED
          ? afterSecurementProgression(row.fulfillment?.state ?? null)
          : {
              canonicalStage: CollaborationStage.SECUREMENT,
              currentStageStatus: CollaborationStageStatus.IN_PROGRESS,
              legacyStage: UceMilestoneStage.STAGE_2_SECUREMENT,
              fulfillmentState: row.fulfillment?.state ?? null,
            };
      const version = row.aggregateVersion + 1;
      const now = new Date();
      await tx.collaborationCommercialAgreement.update({
        where: { collaborationId },
        data: {
          agreedCreatorFee: fee,
          advanceAmount,
          balanceAmount,
          requiredSecuredAmount: fee,
          confirmedSecuredAmount: new Prisma.Decimal(0),
          negotiationState: CollaborationNegotiationState.LOCKED,
          securementState,
          termsLockedAt: now,
          securementCompletedAt:
            securementState === CollaborationSecurementState.NOT_REQUIRED
              ? now
              : null,
        },
      });
      if (
        row.fulfillment &&
        progression.fulfillmentState !== row.fulfillment.state
      ) {
        await tx.collaborationFulfillment.update({
          where: { collaborationId },
          data: { state: progression.fulfillmentState! },
        });
      }
      const updated = await tx.collaboration.updateMany({
        where: { id: collaborationId, aggregateVersion: row.aggregateVersion },
        data: {
          aggregateVersion: { increment: 1 },
          canonicalStage: progression.canonicalStage,
          currentStageStatus: progression.currentStageStatus,
          currentStage: progression.legacyStage,
          stageUpdatedAt: now,
        },
      });
      if (updated.count !== 1) this.stale(row.aggregateVersion);
      await appendCommandEvent(tx, {
        collaborationId,
        eventType,
        actorClass:
          requiredRole === UserRole.BRAND
            ? CollaborationActorClass.BRAND
            : CollaborationActorClass.CREATOR,
        actorUserId: user.id,
        commandId: input.commandId,
        aggregateVersion: version,
        requestFingerprint: fingerprint,
        payload: {
          feeSource,
          agreedCreatorFee: fee.toString(),
          currency: agreement.currency,
          securementState,
        },
      });
    });
    return this.result(user, collaborationId);
  }

  private assertNegotiation(
    row: Awaited<ReturnType<CollaborationNegotiationService["load"]>>,
  ) {
    if (
      !row.sourceApplicationId ||
      row.lifecycle !== CollaborationLifecycle.ACTIVE
    )
      commandConflict(
        "INVALID_STATE",
        "Canonical active Collaboration required",
        row.aggregateVersion,
      );
    if (row.canonicalStage !== CollaborationStage.NEGOTIATION)
      commandConflict(
        "INVALID_STAGE",
        "Collaboration is not in Negotiation",
        row.aggregateVersion,
      );
  }

  private assertRole(user: AuthUser, role: UserRole) {
    if (user.role !== role) unauthorizedActor(`${role} access required`);
  }

  private load(tx: Prisma.TransactionClient, collaborationId: string) {
    return tx.collaboration.findUniqueOrThrow({
      where: { id: collaborationId },
      include: COLLABORATION_THREAD_INCLUDE,
    });
  }

  private async bump(
    tx: Prisma.TransactionClient,
    collaborationId: string,
    version: number,
  ) {
    const result = await tx.collaboration.updateMany({
      where: { id: collaborationId, aggregateVersion: version },
      data: { aggregateVersion: { increment: 1 } },
    });
    if (result.count !== 1) this.stale(version);
  }

  private stale(version: number): never {
    return commandConflict(
      "STALE_AGGREGATE_VERSION",
      "Collaboration changed while the command was executing",
      version,
    );
  }

  private async result(user: AuthUser, collaborationId: string) {
    const row = await this.access.assertThreadForUser(user, collaborationId);
    const viewer = user.role === UserRole.BRAND ? "BRAND" : "CREATOR";
    void this.realtime.broadcast(collaborationId, "thread.updated");
    return projectCanonicalCollaborationDetail(row, viewer);
  }
}
