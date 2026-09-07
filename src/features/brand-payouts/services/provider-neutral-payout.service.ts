import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { EscrowFundingAttributionService } from "../../brand-escrow/services/escrow-funding-attribution.service";
import {
  CREATOR_PAYOUT_PROVIDER_PORT,
  type CreatorPayoutProviderPort,
} from "../ports/creator-payout-provider.port";
import {
  CREATOR_PAYOUT_READINESS_PORT,
  type CreatorPayoutReadinessPort,
} from "../ports/creator-payout-readiness.port";

@Injectable()
export class ProviderNeutralPayoutService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CREATOR_PAYOUT_READINESS_PORT)
    private readonly readiness: CreatorPayoutReadinessPort,
    @Inject(CREATOR_PAYOUT_PROVIDER_PORT)
    private readonly provider: CreatorPayoutProviderPort,
    private readonly attribution: EscrowFundingAttributionService,
  ) {}

  async executeDue(
    obligationId: string,
    idempotencyKey: string,
    now = new Date(),
  ) {
    const capabilities = await this.provider.readCapabilities();
    if (
      !capabilities.transferCreate ||
      capabilities.availability !== "AVAILABLE"
    ) {
      await this.prisma.creatorPayoutObligation.updateMany({
        where: {
          id: obligationId,
          provenanceMode: "CANONICAL_C04",
          status: { not: "SETTLED" },
        },
        data: {
          status: "BLOCKED",
          lifecycle: "ACTION_REQUIRED",
          currentGate: "PROVIDER_UNAVAILABLE",
          blockedReason:
            capabilities.limitationReasonCode ?? "PAYOUT_PROVIDER_UNAVAILABLE",
        },
      });
      return { outcome: "UNAVAILABLE" as const, attempt: null };
    }

    const source = await this.prisma.creatorPayoutObligation.findUnique({
      where: { id: obligationId },
    });
    if (!source) throw new NotFoundException("Payout obligation not found");
    const readiness = await this.readiness.readCurrent({
      creatorProfileId: source.creatorProfileId,
    });
    const unsupported = Boolean(
      readiness.destination &&
      (readiness.destination.rail !== "BANK_ACCOUNT" ||
        readiness.destination.countryCode !== "IN" ||
        readiness.destination.currency !== "INR"),
    );
    if (readiness.setupStatus !== "READY" || !readiness.destination) {
      await this.prisma.creatorPayoutObligation.update({
        where: { id: obligationId },
        data: {
          status: "BLOCKED",
          lifecycle: "ACTION_REQUIRED",
          currentGate: unsupported
            ? "UNSUPPORTED_GEOGRAPHY_OR_RAIL"
            : "CREATOR_SETUP_REQUIRED",
          blockedReason: readiness.blockingReasonCode,
        },
      });
      return { outcome: "ACTION_REQUIRED" as const, attempt: null };
    }

    const claimed = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`bp-transfer-obligation:${obligationId}`}, 0))`;
        const obligation = await tx.creatorPayoutObligation.findUnique({
          where: { id: obligationId },
          include: {
            authorityInstruction: {
              include: { supersededBy: { select: { id: true }, take: 1 } },
            },
          },
        });
        if (!obligation)
          throw new NotFoundException("Payout obligation not found");
        if (
          obligation.provenanceMode !== "CANONICAL_C04" ||
          !obligation.authorityInstruction ||
          obligation.authorityInstruction.supersededBy.length ||
          !obligation.paymentDueAt ||
          obligation.paymentDueAt > now ||
          obligation.amountOutstanding?.lessThanOrEqualTo(0) ||
          obligation.status === "SETTLED"
        )
          throw new ConflictException("Payout obligation is not due/current");
        const outstanding = obligation.amountOutstanding!;

        const existing = await tx.routeTransferAttempt.findUnique({
          where: { idempotencyKey },
        });
        if (existing) {
          if (
            existing.obligationId !== obligationId ||
            !existing.amount.equals(outstanding)
          )
            throw new ConflictException(
              "Idempotency key was reused for different transfer economics",
            );
          return { attempt: existing, replayed: true };
        }
        const destination = await tx.creatorPayoutDestination.findUnique({
          where: { id: readiness.destination!.reference },
          include: { providerMappings: true },
        });
        const mapping = destination?.providerMappings.find(
          (row) => row.destinationVersion === readiness.destination!.version,
        );
        const profile = await tx.creatorPayoutProfile.findUnique({
          where: { creatorProfileId: obligation.creatorProfileId },
        });
        if (
          !destination ||
          !mapping ||
          !profile ||
          readiness.stateVersion !==
            `${profile.stateVersion}:${destination.version}:${mapping.id}` ||
          destination.disabledAt ||
          destination.state === "DISABLED"
        )
          throw new ConflictException(
            "Creator payout readiness changed before claim",
          );
        const active = await tx.routeTransferAttempt.findFirst({
          where: { obligationId, finalDisposition: null },
          select: { id: true },
        });
        if (active)
          throw new ConflictException(
            "Payout obligation already has an active attempt",
          );
        const sequence =
          (await tx.routeTransferAttempt.count({ where: { obligationId } })) +
          1;
        const attempt = await tx.routeTransferAttempt.create({
          data: {
            obligationId,
            attemptSequence: sequence,
            profileStateVersion: profile.stateVersion,
            provider: mapping.provider,
            idempotencyKey,
            amount: outstanding,
            currency: obligation.currency,
            snapshotMode: "CURRENT_C05",
            destinationId: destination.id,
            destinationVersion: destination.version,
            providerMappingId: mapping.id,
            mappingProvider: mapping.provider,
            readinessCheckedAt: readiness.observedAt,
            destinationCountrySnapshot: destination.countryCode,
            destinationCurrencySnapshot: destination.currencyCode,
            queuedAt: now,
            executionStartedAt: now,
          },
        });
        await tx.creatorPayoutObligation.update({
          where: { id: obligationId },
          data: {
            status: "EXECUTING",
            lifecycle: "PROCESSING",
            currentGate: "READY",
            blockedReason: null,
          },
        });
        return { attempt, replayed: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (claimed.replayed)
      return { outcome: "REPLAYED" as const, attempt: claimed.attempt };
    const result = await this.provider.createTransfer({
      obligationId,
      attemptId: claimed.attempt.id,
      idempotencyKey,
      amount: {
        amount: claimed.attempt.amount.toFixed(2),
        currency: claimed.attempt.currency,
      },
      destinationReference: readiness.destination.reference,
      destinationVersion: readiness.destination.version,
    });
    const attempt = await this.recordCreateResult(claimed.attempt.id, result);
    return { outcome: result.outcome, attempt };
  }

  async observeAndSettle(attemptId: string) {
    const capabilities = await this.provider.readCapabilities();
    if (!capabilities.transferRead || capabilities.availability !== "AVAILABLE")
      return { outcome: "UNAVAILABLE" as const };
    const source = await this.prisma.routeTransferAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!source?.transferId)
      throw new ConflictException("Accepted transfer evidence is required");
    const result = await this.provider.readTransfer({
      attemptId,
      executionReference: source.transferId,
    });
    if (result.outcome !== "FOUND" || result.observedState !== "SETTLED")
      return result;
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`bp-transfer-settle:${attemptId}`}, 0))`;
        const attempt = await tx.routeTransferAttempt.findUniqueOrThrow({
          where: { id: attemptId },
          include: { obligation: true },
        });
        if (
          attempt.state === "PROCESSED" &&
          attempt.settlementState === "SETTLED"
        )
          return;
        const obligation = attempt.obligation;
        await this.attribution.consumeCreatorSettlement(tx, {
          obligationId: obligation.id,
          vaultId: obligation.vaultId,
          collaborationId: obligation.collaborationId,
          currency: obligation.currency,
          amount: attempt.amount,
        });
        const ledgerKey = `payout-settlement:${attempt.id}:${result.evidenceReference}`;
        const ledger = await tx.escrowTransactionLedger.findUnique({
          where: { idempotencyKey: ledgerKey },
        });
        if (!ledger) {
          await tx.escrowTransactionLedger.create({
            data: {
              vaultId: obligation.vaultId,
              brandProfileId: obligation.brandProfileId,
              collaborationId: obligation.collaborationId,
              transactionType: "CREATOR_PAYOUT_SETTLEMENT",
              transactionStatus: "CLEARED",
              amount: attempt.amount,
              currency: attempt.currency,
              idempotencyKey: ledgerKey,
            },
          });
          await tx.brandEscrowVault.update({
            where: { id: obligation.vaultId },
            data: {
              lockedCampaignFunds: { decrement: attempt.amount },
              totalPooledBalance: { decrement: attempt.amount },
            },
          });
        }
        await tx.routeTransferAttempt.update({
          where: { id: attemptId },
          data: {
            state: "PROCESSED",
            settlementState: "SETTLED",
            providerState: "SETTLED",
            processedAt: result.observedAt,
            settledAt: result.observedAt,
            finalDisposition: "SUCCEEDED",
            finalDispositionRecordedAt: result.observedAt,
          },
        });
        await tx.creatorPayoutObligation.update({
          where: { id: obligation.id },
          data: {
            status: "SETTLED",
            lifecycle: "SETTLED",
            amountSettled: { increment: attempt.amount },
            amountOutstanding: { decrement: attempt.amount },
            settledAt: result.observedAt,
          },
        });
        await tx.payoutReconciledReceipt.upsert({
          where: {
            dedupeIdentity: `settled:${attemptId}:${result.evidenceReference}`,
          },
          create: {
            dedupeIdentity: `settled:${attemptId}:${result.evidenceReference}`,
            entityType: "OBLIGATION",
            eventClass: "SETTLEMENT_RECORDED",
            transferAttemptId: attemptId,
            obligationId: obligation.id,
            receivedAt: result.observedAt,
            providerOccurredAt: result.observedAt,
            reconciledAt: result.observedAt,
            createdAt: result.observedAt,
          },
          update: {},
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return result;
  }

  private recordCreateResult(
    attemptId: string,
    result: Awaited<ReturnType<CreatorPayoutProviderPort["createTransfer"]>>,
  ) {
    const accepted = result.outcome === "ACCEPTED";
    const disposition = accepted
      ? null
      : result.outcome === "AMBIGUOUS"
        ? "AMBIGUOUS_RECONCILIATION_REQUIRED"
        : result.outcome === "RETRYABLE_FAILURE" ||
            result.outcome === "UNAVAILABLE"
          ? "RETRYABLE_FAILURE"
          : "TERMINAL_FAILURE";
    return this.prisma.$transaction(
      async (tx) => {
        const attempt = await tx.routeTransferAttempt.update({
          where: { id: attemptId },
          data: {
            transferId: result.executionReference,
            state: accepted ? "PENDING" : "FAILED",
            providerState: accepted ? result.observedState : result.outcome,
            providerAcceptedAt: accepted ? result.observedAt : null,
            providerRequestCompletedAt: result.observedAt,
            failedAt: accepted ? null : result.observedAt,
            failureRecordedAt: accepted ? null : result.observedAt,
            finalDisposition: disposition,
            finalDispositionRecordedAt: accepted ? null : result.observedAt,
            finalReasonCode: accepted ? null : result.reasonCode,
          },
        });
        if (accepted) {
          await tx.payoutReconciledReceipt.create({
            data: {
              dedupeIdentity: `accepted:${attemptId}:${result.executionReference}`,
              entityType: "TRANSFER_ATTEMPT",
              eventClass: "TRANSFER_ACCEPTED",
              transferAttemptId: attemptId,
              obligationId: attempt.obligationId,
              receivedAt: result.observedAt,
              providerOccurredAt: result.observedAt,
              reconciledAt: result.observedAt,
              createdAt: result.observedAt,
            },
          });
        } else {
          await tx.creatorPayoutObligation.update({
            where: { id: attempt.obligationId },
            data: {
              status: "BLOCKED",
              lifecycle:
                result.outcome === "RETRYABLE_FAILURE" ||
                result.outcome === "UNAVAILABLE"
                  ? "FAILED_RETRYABLE"
                  : "ACTION_REQUIRED",
              blockedReason: result.reasonCode,
            },
          });
        }
        return attempt;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
