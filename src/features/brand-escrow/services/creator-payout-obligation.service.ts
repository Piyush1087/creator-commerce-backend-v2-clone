import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { CreatorPayoutObligationType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { PrismaService } from "../../../prisma/prisma.service";
import { NotificationDispatchService } from "../../notifications/services/notification-dispatch.service";

export type CollaborationSettlementInstruction = {
  instructionId: string;
  collaborationId: string;
  brandProfileId: string;
  creatorProfileId: string;
  obligationType: CreatorPayoutObligationType;
  entitlementAmount: Decimal.Value;
  currency: string;
  issuedAt: Date;
  paymentDueAt?: Date | null;
  triggeringUserId?: string | null;
};

@Injectable()
export class CreatorPayoutObligationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async consumeSettlementInstruction(
    input: CollaborationSettlementInstruction,
  ) {
    const amount = new Decimal(input.entitlementAmount);
    if (!input.instructionId.trim())
      throw new BadRequestException("Settlement instruction ID is required");
    if (!amount.isPositive())
      throw new BadRequestException("Entitlement amount must be positive");
    if (input.currency !== "INR")
      throw new BadRequestException("Route payout currency is not supported");

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`creator-payout-instruction:${input.instructionId}`}))`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`escrow-obligation:${input.collaborationId}`}))`;
      const existing = await tx.creatorPayoutObligation.findUnique({
        where: { settlementInstructionId: input.instructionId },
      });
      if (existing) {
        if (
          existing.collaborationId !== input.collaborationId ||
          existing.brandProfileId !== input.brandProfileId ||
          existing.creatorProfileId !== input.creatorProfileId ||
          existing.obligationType !== input.obligationType ||
          !existing.entitlementAmount.equals(amount) ||
          existing.currency !== input.currency
        ) {
          throw new ConflictException(
            "Settlement instruction identity was reused with different economics",
          );
        }
        return existing;
      }

      const collaboration = await tx.collaboration.findUnique({
        where: { id: input.collaborationId },
        include: {
          escrowLock: true,
          creatorUser: { include: { creatorProfile: true } },
        },
      });
      if (!collaboration)
        throw new NotFoundException("Collaboration not found");
      if (
        collaboration.brandProfileId !== input.brandProfileId ||
        collaboration.creatorUser.creatorProfile?.id !== input.creatorProfileId
      ) {
        throw new ConflictException(
          "Settlement instruction does not match Collaboration authority",
        );
      }
      const lock = collaboration.escrowLock;
      if (!lock || lock.lockReleasedViaRefund)
        throw new ConflictException("Active Collaboration reserve is required");
      if (amount.greaterThan(lock.netCreatorPayoutPool))
        throw new ConflictException(
          "Instruction exceeds the canonical Creator payout reserve",
        );
      const vault = await tx.brandEscrowVault.findUnique({
        where: { brandProfileId: input.brandProfileId },
      });
      if (!vault || vault.currency !== input.currency)
        throw new ConflictException("Brand vault currency authority mismatch");

      const profile = await tx.creatorPayoutProfile.upsert({
        where: { creatorProfileId: input.creatorProfileId },
        create: {
          creatorProfileId: input.creatorProfileId,
          externalReferenceId: `creator:${input.creatorProfileId}`,
        },
        update: {},
      });
      const ready =
        profile.operationalEligibility === "ELIGIBLE_FOR_TRANSFER" &&
        profile.bankStatus === "BANK_VALIDATED";
      const obligation = await tx.creatorPayoutObligation.create({
        data: {
          settlementInstructionId: input.instructionId,
          collaborationId: input.collaborationId,
          vaultId: vault.id,
          brandProfileId: input.brandProfileId,
          creatorProfileId: input.creatorProfileId,
          payoutProfileId: profile.id,
          obligationType: input.obligationType,
          entitlementAmount: amount,
          currency: input.currency,
          instructionIssuedAt: input.issuedAt,
          paymentDueAt: input.paymentDueAt,
          status: ready ? "ELIGIBLE" : "BLOCKED",
          blockedReason: ready ? null : "PROVIDER_SETUP_REQUIRED",
        },
      });
      if (!ready) {
        await this.notifications.enqueueWithinTransaction(tx, {
          workspaceId: input.brandProfileId,
          eventType: "escrow.creator_payout_action_required",
          source: {
            sourceType: "creator_payout_obligation",
            sourceId: obligation.id,
            transitionId: "provider-setup-required",
          },
          payload: {
            collaboration_id: input.collaborationId,
            obligation_id: obligation.id,
            reason: "PROVIDER_SETUP_REQUIRED",
          },
          triggerUserId: input.triggeringUserId,
        });
      }
      return obligation;
    });
  }

  async refreshBusinessExecutionReadiness(obligationId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`creator-payout-obligation:${obligationId}`}))`;
      const obligation = await tx.creatorPayoutObligation.findUnique({
        where: { id: obligationId },
        include: { payoutProfile: true },
      });
      if (!obligation)
        throw new NotFoundException("Payout obligation not found");
      if (obligation.status !== "BLOCKED") return obligation;
      if (
        obligation.payoutProfile.operationalEligibility !==
          "ELIGIBLE_FOR_TRANSFER" ||
        obligation.payoutProfile.bankStatus !== "BANK_VALIDATED"
      )
        return obligation;
      return tx.creatorPayoutObligation.update({
        where: { id: obligation.id },
        data: { status: "ELIGIBLE", blockedReason: null },
      });
    });
  }
}
