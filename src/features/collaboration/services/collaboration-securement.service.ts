import { Injectable } from "@nestjs/common";
import {
  CollaborationActorClass,
  CollaborationLifecycle,
  CollaborationPaymentRail,
  CollaborationSecurementState,
  CollaborationStage,
  CollaborationStageStatus,
  Prisma,
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
  confirmEscrowFundingSchema,
  disputeManualPaymentSchema,
  reportManualPaymentSchema,
  type CollaborationCommandEnvelope,
  type ConfirmEscrowFundingInput,
  type DisputeManualPaymentInput,
  type ReportManualPaymentInput,
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
import { CollaborationFundingGateway } from "./collaboration-funding.gateway";
import { CollaborationRealtimeService } from "./collaboration-realtime.service";

export type TrustedFundingConfirmationActor = {
  actorClass: "SYSTEM";
};

@Injectable()
export class CollaborationSecurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CollaborationAccessService,
    private readonly realtime: CollaborationRealtimeService,
    private readonly funding: CollaborationFundingGateway,
  ) {}

  async requestEscrowFunding(
    user: AuthUser,
    collaborationId: string,
    raw: unknown,
  ) {
    this.assertRole(user, UserRole.BRAND);
    const input = parseCommand(collaborationCommandEnvelopeSchema, raw);
    const fingerprint = requestFingerprint(input);
    await this.access.assertThreadForUser(user, collaborationId);
    const replay = await this.prisma.collaborationEvent.findFirst({
      where: { collaborationId, commandId: input.commandId },
    });
    if (replay) {
      await this.prisma.$transaction((tx) =>
        replayOrThrow(
          tx,
          collaborationId,
          input.commandId,
          "ESCROW_FUNDING_REQUESTED",
          fingerprint,
        ),
      );
      return this.result(user, collaborationId);
    }
    const before = await this.prisma.collaboration.findUniqueOrThrow({
      where: { id: collaborationId },
      include: COLLABORATION_THREAD_INCLUDE,
    });
    this.assertSecurement(before);
    assertExpectedVersion(
      before.aggregateVersion,
      input.expectedAggregateVersion,
    );
    const agreement = before.commercialAgreement;
    if (
      !agreement ||
      agreement.paymentRail !== CollaborationPaymentRail.PLATFORM_ESCROW
    ) {
      commandConflict(
        "INVALID_STATE",
        "Platform escrow does not apply",
        before.aggregateVersion,
      );
    }
    if (
      agreement.securementState !==
      CollaborationSecurementState.AWAITING_ESCROW_FUNDING
    ) {
      commandConflict(
        "INVALID_STATE",
        "Escrow funding cannot be requested in this state",
        before.aggregateVersion,
      );
    }
    const required = agreement.requiredSecuredAmount;
    if (required === null)
      commandConflict(
        "INVALID_STATE",
        "Required secured amount is missing",
        before.aggregateVersion,
      );
    if (
      !agreement.agreedCreatorFee ||
      !agreement.platformCommissionAmount ||
      !agreement.platformCommissionGstAmount
    ) {
      commandConflict(
        "INVALID_STATE",
        "Locked financial policy snapshot is incomplete",
        before.aggregateVersion,
      );
    }
    const reserve = await this.funding.reserveFunds({
      collaborationId,
      brandProfileId: before.brandProfileId,
      currency: agreement.currency,
      creatorGrossFee: agreement.agreedCreatorFee,
      platformCommissionAmount: agreement.platformCommissionAmount,
      platformCommissionGstAmount: agreement.platformCommissionGstAmount,
      requiredSecuredAmount: required,
    });

    await this.prisma.$transaction(async (tx) => {
      if (
        await replayOrThrow(
          tx,
          collaborationId,
          input.commandId,
          "ESCROW_FUNDING_REQUESTED",
          fingerprint,
        )
      )
        return;
      const row = await this.load(tx, collaborationId);
      assertExpectedVersion(
        row.aggregateVersion,
        input.expectedAggregateVersion,
      );
      const version = row.aggregateVersion + 1;
      const now = new Date();
      const reserved = reserve.status === "RESERVED";
      const progression = reserved
        ? afterSecurementProgression(row.fulfillment?.state ?? null)
        : null;
      await tx.collaborationCommercialAgreement.update({
        where: { collaborationId },
        data: {
          fundingInstructionRef: `escrow-reserve:${input.commandId}`,
          escrowLockRef: reserved ? reserve.escrowLockRef : undefined,
          confirmedSecuredAmount: reserved
            ? reserve.confirmedAmount
            : new Prisma.Decimal(0),
          securementState: reserved
            ? CollaborationSecurementState.COMPLETED
            : CollaborationSecurementState.AWAITING_ESCROW_FUNDING,
          securementCompletedAt: reserved ? now : null,
        },
      });
      if (
        reserved &&
        row.fulfillment &&
        progression!.fulfillmentState !== row.fulfillment.state
      ) {
        await tx.collaborationFulfillment.update({
          where: { collaborationId },
          data: { state: progression!.fulfillmentState! },
        });
      }
      const updated = await tx.collaboration.updateMany({
        where: { id: collaborationId, aggregateVersion: row.aggregateVersion },
        data: {
          aggregateVersion: { increment: 1 },
          ...(progression
            ? {
                canonicalStage: progression.canonicalStage,
                currentStageStatus: progression.currentStageStatus,
                currentStage: progression.legacyStage,
                stageUpdatedAt: now,
              }
            : {}),
        },
      });
      if (updated.count !== 1) this.stale(row.aggregateVersion);
      await appendCommandEvent(tx, {
        collaborationId,
        eventType: "ESCROW_FUNDING_REQUESTED",
        actorClass: CollaborationActorClass.BRAND,
        actorUserId: user.id,
        commandId: input.commandId,
        aggregateVersion: version,
        requestFingerprint: fingerprint,
        payload: {
          reserveStatus: reserve.status,
          escrowLockRef: reserved ? reserve.escrowLockRef : undefined,
          requiredSecuredAmount: required.toString(),
          shortfallAmount:
            reserve.status === "INSUFFICIENT_AVAILABLE_BALANCE"
              ? reserve.shortfallAmount.toString()
              : undefined,
          currency: agreement.currency,
        },
      });
    });
    return this.result(user, collaborationId);
  }

  async confirmEscrowFunding(
    actor: TrustedFundingConfirmationActor,
    collaborationId: string,
    raw: unknown,
  ) {
    if (actor.actorClass !== CollaborationActorClass.SYSTEM) {
      unauthorizedActor("Escrow confirmation requires a trusted SYSTEM path");
    }
    const input = parseCommand(confirmEscrowFundingSchema, raw);
    const fingerprint = requestFingerprint(input);
    let response!: {
      aggregateVersion: number;
      securementState: CollaborationSecurementState;
    };
    await this.prisma.$transaction(async (tx) => {
      if (
        await replayOrThrow(
          tx,
          collaborationId,
          input.commandId,
          "ESCROW_FUNDING_CONFIRMATION_RECORDED",
          fingerprint,
        )
      ) {
        const replayed = await this.load(tx, collaborationId);
        response = {
          aggregateVersion: replayed.aggregateVersion,
          securementState: replayed.commercialAgreement!.securementState!,
        };
        return;
      }
      const row = await this.load(tx, collaborationId);
      this.assertSecurement(row);
      assertExpectedVersion(
        row.aggregateVersion,
        input.expectedAggregateVersion,
      );
      const agreement = row.commercialAgreement;
      if (
        !agreement ||
        agreement.paymentRail !== CollaborationPaymentRail.PLATFORM_ESCROW
      )
        commandConflict(
          "INVALID_STATE",
          "Platform escrow does not apply",
          row.aggregateVersion,
        );
      if (agreement.currency !== input.currency)
        commandConflict(
          "FUNDING_NOT_CONFIRMED",
          "Funding currency does not match the agreement",
          row.aggregateVersion,
        );
      if (!agreement.requiredSecuredAmount)
        commandConflict(
          "INVALID_STATE",
          "Required secured amount is missing",
          row.aggregateVersion,
        );
      const authoritativeLock = await tx.collaborationEscrowLock.findUnique({
        where: { id: input.escrowLockRef },
      });
      if (
        !authoritativeLock ||
        authoritativeLock.collaborationId !== collaborationId ||
        authoritativeLock.brandProfileId !== row.brandProfileId
      ) {
        commandConflict(
          "FUNDING_NOT_CONFIRMED",
          "Authoritative Escrow lock evidence was not found",
          row.aggregateVersion,
        );
      }
      const confirmed = new Prisma.Decimal(input.confirmedAmount);
      if (!authoritativeLock.totalEscrowLockedAmount.equals(confirmed)) {
        commandConflict(
          "FUNDING_NOT_CONFIRMED",
          "Confirmed amount does not match the authoritative Escrow lock",
          row.aggregateVersion,
        );
      }
      const complete = confirmed.greaterThanOrEqualTo(
        agreement.requiredSecuredAmount,
      );
      const version = row.aggregateVersion + 1;
      const now = new Date();
      const progression = complete
        ? afterSecurementProgression(row.fulfillment?.state ?? null)
        : null;
      await tx.collaborationCommercialAgreement.update({
        where: { collaborationId },
        data: {
          fundingConfirmationRef: input.fundingConfirmationRef,
          escrowLockRef: input.escrowLockRef,
          confirmedSecuredAmount: confirmed,
          securementState: complete
            ? CollaborationSecurementState.COMPLETED
            : CollaborationSecurementState.PROCESSING_FUNDING,
          securementCompletedAt: complete ? now : null,
        },
      });
      if (
        complete &&
        row.fulfillment &&
        progression!.fulfillmentState !== row.fulfillment.state
      ) {
        await tx.collaborationFulfillment.update({
          where: { collaborationId },
          data: { state: progression!.fulfillmentState! },
        });
      }
      const updated = await tx.collaboration.updateMany({
        where: { id: collaborationId, aggregateVersion: row.aggregateVersion },
        data: {
          aggregateVersion: { increment: 1 },
          ...(progression
            ? {
                canonicalStage: progression.canonicalStage,
                currentStageStatus: progression.currentStageStatus,
                currentStage: progression.legacyStage,
                stageUpdatedAt: now,
              }
            : {}),
        },
      });
      if (updated.count !== 1) this.stale(row.aggregateVersion);
      await appendCommandEvent(tx, {
        collaborationId,
        eventType: "ESCROW_FUNDING_CONFIRMATION_RECORDED",
        actorClass: CollaborationActorClass.SYSTEM,
        commandId: input.commandId,
        aggregateVersion: version,
        requestFingerprint: fingerprint,
        payload: {
          fundingConfirmationRef: input.fundingConfirmationRef,
          escrowLockRef: input.escrowLockRef,
          confirmedAmount: confirmed.toString(),
          currency: input.currency,
          sufficient: complete,
        },
      });
      response = {
        aggregateVersion: version,
        securementState: complete
          ? CollaborationSecurementState.COMPLETED
          : CollaborationSecurementState.PROCESSING_FUNDING,
      };
    });
    void this.realtime.broadcast(collaborationId, "thread.updated");
    return { collaborationId, ...response };
  }

  reportManualPayment(user: AuthUser, collaborationId: string, raw: unknown) {
    this.assertRole(user, UserRole.BRAND);
    const input = parseCommand(reportManualPaymentSchema, raw);
    return this.manualTransition(
      user,
      collaborationId,
      input,
      "MANUAL_PAYMENT_REPORTED",
    );
  }

  confirmManualPayment(user: AuthUser, collaborationId: string, raw: unknown) {
    this.assertRole(user, UserRole.CREATOR);
    const input = parseCommand(collaborationCommandEnvelopeSchema, raw);
    return this.manualTransition(
      user,
      collaborationId,
      input,
      "MANUAL_PAYMENT_CONFIRMED",
    );
  }

  disputeManualPayment(user: AuthUser, collaborationId: string, raw: unknown) {
    this.assertRole(user, UserRole.CREATOR);
    const input = parseCommand(disputeManualPaymentSchema, raw);
    return this.manualTransition(
      user,
      collaborationId,
      input,
      "MANUAL_PAYMENT_DISPUTED",
    );
  }

  private async manualTransition(
    user: AuthUser,
    collaborationId: string,
    input:
      | ReportManualPaymentInput
      | CollaborationCommandEnvelope
      | DisputeManualPaymentInput,
    eventType:
      | "MANUAL_PAYMENT_REPORTED"
      | "MANUAL_PAYMENT_CONFIRMED"
      | "MANUAL_PAYMENT_DISPUTED",
  ) {
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
      this.assertSecurement(row);
      assertExpectedVersion(
        row.aggregateVersion,
        input.expectedAggregateVersion,
      );
      const agreement = row.commercialAgreement;
      if (
        !agreement ||
        agreement.paymentRail !== CollaborationPaymentRail.MANUAL
      )
        commandConflict(
          "INVALID_STATE",
          "Manual payment does not apply",
          row.aggregateVersion,
        );
      const version = row.aggregateVersion + 1;
      const now = new Date();
      let securementState: CollaborationSecurementState;
      let progression: ReturnType<typeof afterSecurementProgression> | null =
        null;
      const agreementData: Prisma.CollaborationCommercialAgreementUpdateInput =
        {};
      if (eventType === "MANUAL_PAYMENT_REPORTED") {
        if (
          agreement.securementState !==
          CollaborationSecurementState.AWAITING_BRAND_PAYMENT
        )
          commandConflict(
            "INVALID_STATE",
            "Brand payment evidence is not expected",
            row.aggregateVersion,
          );
        agreementData.manualPaymentEvidenceRef = (
          input as ReportManualPaymentInput
        ).paymentEvidenceRef;
        securementState =
          CollaborationSecurementState.AWAITING_CREATOR_CONFIRMATION;
      } else if (eventType === "MANUAL_PAYMENT_CONFIRMED") {
        if (
          agreement.securementState !==
          CollaborationSecurementState.AWAITING_CREATOR_CONFIRMATION
        )
          commandConflict(
            "CREATOR_CONFIRMATION_REQUIRED",
            "Manual payment evidence must await Creator confirmation",
            row.aggregateVersion,
          );
        agreementData.manualCreatorConfirmedAt = now;
        agreementData.securementCompletedAt = now;
        agreementData.confirmedSecuredAmount = agreement.requiredSecuredAmount;
        securementState = CollaborationSecurementState.COMPLETED;
        progression = afterSecurementProgression(
          row.fulfillment?.state ?? null,
        );
      } else {
        if (
          agreement.securementState !==
          CollaborationSecurementState.AWAITING_CREATOR_CONFIRMATION
        )
          commandConflict(
            "INVALID_STATE",
            "Manual payment cannot be disputed in this state",
            row.aggregateVersion,
          );
        agreementData.paymentDisputeRef = `manual-dispute:${input.commandId}`;
        securementState = CollaborationSecurementState.PAYMENT_DISPUTED;
      }
      agreementData.securementState = securementState;
      await tx.collaborationCommercialAgreement.update({
        where: { collaborationId },
        data: agreementData,
      });
      if (
        progression &&
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
          currentStageStatus:
            eventType === "MANUAL_PAYMENT_DISPUTED"
              ? CollaborationStageStatus.BLOCKED
              : progression?.currentStageStatus,
          ...(progression
            ? {
                canonicalStage: progression.canonicalStage,
                currentStage: progression.legacyStage,
                stageUpdatedAt: now,
              }
            : {}),
        },
      });
      if (updated.count !== 1) this.stale(row.aggregateVersion);
      await appendCommandEvent(tx, {
        collaborationId,
        eventType,
        actorClass:
          user.role === UserRole.BRAND
            ? CollaborationActorClass.BRAND
            : CollaborationActorClass.CREATOR,
        actorUserId: user.id,
        commandId: input.commandId,
        aggregateVersion: version,
        requestFingerprint: fingerprint,
        payload: {
          securementState,
          ...(eventType === "MANUAL_PAYMENT_REPORTED"
            ? {
                paymentEvidenceRef: (input as ReportManualPaymentInput)
                  .paymentEvidenceRef,
              }
            : {}),
        },
      });
    });
    return this.result(user, collaborationId);
  }

  private assertSecurement(
    row: Awaited<ReturnType<CollaborationSecurementService["load"]>>,
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
    if (row.canonicalStage !== CollaborationStage.SECUREMENT)
      commandConflict(
        "INVALID_STAGE",
        "Collaboration is not in Securement",
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
