import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { PrismaService } from "../../../prisma/prisma.service";
import { NotificationDispatchService } from "../../notifications/services/notification-dispatch.service";
import { RazorpayRouteAdapter } from "./razorpay-route.adapter";
import { RouteProviderGateError } from "./razorpay-route.types";

const minorUnits = (amount: Decimal): number => {
  const value = amount.mul(100);
  if (!value.isInteger() || value.greaterThan(Number.MAX_SAFE_INTEGER))
    throw new BadRequestException(
      "Route amount cannot be represented in paise",
    );
  return value.toNumber();
};

@Injectable()
export class RouteTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly route: RazorpayRouteAdapter,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async startTransfer(input: {
    obligationId: string;
    idempotencyKey: string;
    onHold?: boolean;
    onHoldUntil?: Date | null;
  }) {
    const prepared = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`creator-payout-obligation:${input.obligationId}`}))::text`;
      const existingByKey = await tx.routeTransferAttempt.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { obligation: { include: { payoutProfile: true } } },
      });
      if (existingByKey) {
        if (existingByKey.obligationId !== input.obligationId)
          throw new ConflictException(
            "Transfer idempotency key is already owned",
          );
        return existingByKey;
      }
      const obligation = await tx.creatorPayoutObligation.findUnique({
        where: { id: input.obligationId },
        include: { payoutProfile: true, transfers: true },
      });
      if (!obligation)
        throw new NotFoundException("Payout obligation not found");
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`escrow-obligation:${obligation.collaborationId}`}))::text`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`creator-payout-profile:${obligation.creatorProfileId}`}))::text`;
      if (obligation.status !== "ELIGIBLE")
        throw new ConflictException("Payout obligation is not executable");
      if (
        obligation.payoutProfile.operationalEligibility !==
          "ELIGIBLE_FOR_TRANSFER" ||
        obligation.payoutProfile.bankStatus !== "BANK_VALIDATED" ||
        !obligation.payoutProfile.linkedAccountId
      )
        throw new ConflictException(
          "Provider operational eligibility is not valid",
        );
      if (
        obligation.transfers.some((attempt) =>
          ["CREATED", "PENDING", "PROCESSED", "PARTIALLY_REVERSED"].includes(
            attempt.state,
          ),
        )
      )
        throw new ConflictException(
          "An active Route transfer already owns this obligation",
        );
      const attempt = await tx.routeTransferAttempt.create({
        data: {
          obligationId: obligation.id,
          attemptSequence: obligation.transfers.length + 1,
          profileStateVersion: obligation.payoutProfile.stateVersion,
          idempotencyKey: input.idempotencyKey,
          amount: obligation.entitlementAmount,
          currency: obligation.currency,
          onHold: input.onHold ?? false,
          onHoldUntil: input.onHoldUntil,
          settlementState: input.onHold ? "HELD" : "PENDING",
        },
        include: { obligation: { include: { payoutProfile: true } } },
      });
      await tx.creatorPayoutObligation.update({
        where: { id: obligation.id },
        data: { status: "EXECUTING", blockedReason: null },
      });
      return attempt;
    });

    if (prepared.transferId) return prepared;
    const currentProfile =
      await this.prisma.creatorPayoutProfile.findUniqueOrThrow({
        where: { id: prepared.obligation.payoutProfileId },
      });
    if (
      currentProfile.stateVersion !== prepared.profileStateVersion ||
      currentProfile.operationalEligibility !== "ELIGIBLE_FOR_TRANSFER"
    ) {
      await this.prisma.$transaction([
        this.prisma.routeTransferAttempt.update({
          where: { id: prepared.id },
          data: { state: "FAILED", failedAt: new Date() },
        }),
        this.prisma.creatorPayoutObligation.update({
          where: { id: prepared.obligationId },
          data: {
            status: "BLOCKED",
            blockedReason: "STALE_PROVIDER_ELIGIBILITY",
          },
        }),
      ]);
      throw new ConflictException(
        "Provider eligibility changed before transfer execution",
      );
    }
    try {
      const result = await this.route.createTransfer({
        linkedAccountId: prepared.obligation.payoutProfile.linkedAccountId!,
        amountMinor: minorUnits(prepared.amount),
        currency: prepared.currency,
        idempotencyKey: prepared.idempotencyKey,
        referenceId: prepared.obligation.settlementInstructionId,
        onHold: prepared.onHold,
        onHoldUntil: prepared.onHoldUntil,
      });
      return this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`creator-payout-obligation:${prepared.obligationId}`}))::text`;
        return tx.routeTransferAttempt.update({
          where: { id: prepared.id },
          data: {
            transferId: result.transferId,
            providerState: result.providerState,
            state: result.state,
            settlementState: result.settlementState,
            onHold: result.onHold,
            onHoldUntil: result.onHoldUntil,
            providerAcceptedAt: new Date(),
          },
        });
      });
    } catch (error) {
      if (!(error instanceof RouteProviderGateError)) throw error;
      await this.prisma.$transaction(async (tx) => {
        await tx.routeTransferAttempt.update({
          where: { id: prepared.id },
          data: {
            state: "FAILED",
            failedAt: new Date(),
            diagnosticPayload: {
              code: error.code,
              capability: error.capability,
            },
          },
        });
        await tx.creatorPayoutObligation.update({
          where: { id: prepared.obligationId },
          data: {
            status: "BLOCKED",
            blockedReason: "PROVIDER_CAPABILITY_UNAVAILABLE",
          },
        });
        await this.notifications.enqueueWithinTransaction(tx, {
          workspaceId: prepared.obligation.brandProfileId,
          eventType: "escrow.creator_payout_action_required",
          source: {
            sourceType: "creator_payout_obligation",
            sourceId: prepared.obligationId,
            transitionId: `provider-capability-unavailable:${error.capability}`,
          },
          payload: {
            collaboration_id: prepared.obligation.collaborationId,
            obligation_id: prepared.obligationId,
            reason: "PROVIDER_CAPABILITY_UNAVAILABLE",
          },
        });
      });
      throw error;
    }
  }

  async releaseTransfer(transferAttemptId: string) {
    const transfer = await this.getReleaseCandidate(transferAttemptId);
    try {
      const result = await this.route.releaseTransfer(transfer.transferId!);
      return this.prisma.routeTransferAttempt.update({
        where: { id: transfer.id },
        data: {
          providerState: result.providerState,
          state: result.state,
          settlementState: result.settlementState,
          onHold: result.onHold,
          onHoldUntil: result.onHoldUntil,
          releasedAt: new Date(),
        },
      });
    } catch (error) {
      await this.prisma.routeTransferAttempt.updateMany({
        where: { id: transfer.id, settlementState: "RELEASE_PROCESSING" },
        data: { settlementState: "RELEASE_ELIGIBLE" },
      });
      throw error;
    }
  }

  async holdTransfer(transferAttemptId: string, until?: Date | null) {
    const transfer = await this.prisma.routeTransferAttempt.findUnique({
      where: { id: transferAttemptId },
      include: { obligation: true },
    });
    if (!transfer?.transferId)
      throw new NotFoundException("Route transfer not found");
    if (transfer.settlementState === "SETTLED")
      throw new ConflictException("Settled transfer cannot be held");
    const result = await this.route.holdTransfer(transfer.transferId, until);
    return this.prisma.routeTransferAttempt.update({
      where: { id: transfer.id },
      data: {
        providerState: result.providerState,
        state: result.state,
        settlementState: "HELD",
        onHold: true,
        onHoldUntil: result.onHoldUntil ?? until,
      },
    });
  }

  async markReleaseEligible(transferAttemptId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`route-transfer:${transferAttemptId}`}))::text`;
      const transfer = await tx.routeTransferAttempt.findUnique({
        where: { id: transferAttemptId },
        include: { obligation: { include: { payoutProfile: true } } },
      });
      if (!transfer?.transferId || !transfer.onHold)
        throw new ConflictException("Held provider transfer is required");
      if (
        transfer.obligation.status === "BLOCKED" ||
        transfer.obligation.payoutProfile.operationalEligibility !==
          "ELIGIBLE_FOR_TRANSFER"
      )
        throw new ConflictException("Release authority is blocked");
      return tx.routeTransferAttempt.update({
        where: { id: transfer.id },
        data: { settlementState: "RELEASE_ELIGIBLE" },
      });
    });
  }

  async blockSettlement(
    transferAttemptId: string,
    trustedResolutionReference: string,
  ) {
    if (!trustedResolutionReference.trim())
      throw new BadRequestException("Trusted resolution reference is required");
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`route-transfer:${transferAttemptId}`}))::text`;
      const transfer = await tx.routeTransferAttempt.findUnique({
        where: { id: transferAttemptId },
      });
      if (!transfer || transfer.settlementState === "SETTLED")
        throw new ConflictException("Transfer cannot be blocked");
      await tx.creatorPayoutObligation.update({
        where: { id: transfer.obligationId },
        data: {
          status: "BLOCKED",
          blockedReason: "BUSINESS_RESOLUTION_BLOCK",
        },
      });
      return tx.routeTransferAttempt.update({
        where: { id: transfer.id },
        data: {
          settlementState: "BLOCKED",
          diagnosticPayload: {
            businessResolutionReference: trustedResolutionReference,
          },
        },
      });
    });
  }

  async createReversal(input: {
    transferAttemptId: string;
    amount: Decimal.Value;
    currency: string;
    idempotencyKey: string;
    resolutionReferenceId: string;
  }) {
    const amount = new Decimal(input.amount);
    if (!amount.isPositive())
      throw new BadRequestException("Reversal amount must be positive");
    const prepared = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`route-transfer:${input.transferAttemptId}`}))::text`;
        const byKey = await tx.routeTransferReversal.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (byKey) {
          if (byKey.transferAttemptId !== input.transferAttemptId)
            throw new ConflictException(
              "Reversal idempotency key is already owned",
            );
          return byKey;
        }
        const transfer = await tx.routeTransferAttempt.findUnique({
          where: { id: input.transferAttemptId },
          include: { reversals: true },
        });
        if (!transfer?.transferId)
          throw new ConflictException(
            "Provider-confirmed transfer is required",
          );
        if (transfer.currency !== input.currency)
          throw new ConflictException("Reversal currency mismatch");
        if (!["PROCESSED", "PARTIALLY_REVERSED"].includes(transfer.state))
          throw new ConflictException("Transfer is not reversible");
        const committed = transfer.reversals
          .filter((row) =>
            ["CREATED", "PENDING", "PROCESSED"].includes(row.state),
          )
          .reduce((total, row) => total.add(row.amount), new Decimal(0));
        if (committed.add(amount).greaterThan(transfer.amount))
          throw new ConflictException(
            "Cumulative reversal exceeds transfer amount",
          );
        return tx.routeTransferReversal.create({
          data: {
            transferAttemptId: transfer.id,
            idempotencyKey: input.idempotencyKey,
            amount,
            currency: input.currency,
            diagnosticPayload: {
              businessResolutionReference: input.resolutionReferenceId,
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (prepared.reversalId) return prepared;
    const transfer = await this.prisma.routeTransferAttempt.findUniqueOrThrow({
      where: { id: input.transferAttemptId },
    });
    const result = await this.route.createReversal({
      transferId: transfer.transferId!,
      amountMinor: minorUnits(amount),
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
      referenceId: input.resolutionReferenceId,
    });
    return this.prisma.routeTransferReversal.update({
      where: { id: prepared.id },
      data: {
        reversalId: result.reversalId,
        providerState: result.providerState,
        state: result.state,
      },
    });
  }

  private async getReleaseCandidate(transferAttemptId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`route-transfer:${transferAttemptId}`}))::text`;
      const transfer = await tx.routeTransferAttempt.findUnique({
        where: { id: transferAttemptId },
        include: { obligation: { include: { payoutProfile: true } } },
      });
      if (!transfer?.transferId)
        throw new NotFoundException("Route transfer not found");
      if (
        !transfer.onHold ||
        !["HELD", "RELEASE_ELIGIBLE"].includes(transfer.settlementState)
      )
        throw new ConflictException("Route transfer is not release eligible");
      if (
        transfer.obligation.status === "BLOCKED" ||
        transfer.obligation.payoutProfile.operationalEligibility !==
          "ELIGIBLE_FOR_TRANSFER"
      )
        throw new ConflictException("Release conditions are no longer valid");
      return tx.routeTransferAttempt.update({
        where: { id: transfer.id },
        data: { settlementState: "RELEASE_PROCESSING" },
        include: { obligation: { include: { payoutProfile: true } } },
      });
    });
  }
}
