import { randomUUID } from "node:crypto";

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type FinancialReserveApproval } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { CollaborationEscrowReserveService } from "../../brand-escrow/services/collaboration-escrow-reserve.service";
import { EscrowFundingAttributionService } from "../../brand-escrow/services/escrow-funding-attribution.service";
import {
  CollaborationTrustedConfirmationService,
  trustedEscrowConfirmationDigest,
} from "../../collaboration/services/collaboration-trusted-confirmation.service";
import type { ApproveReserveCommand } from "../dto/brand-payouts-command.dto";
import { BrandPayoutsAuthorizationService } from "./brand-payouts-authorization.service";

@Injectable()
export class FinancialReserveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: BrandPayoutsAuthorizationService,
    private readonly reserve: CollaborationEscrowReserveService,
    private readonly attribution: EscrowFundingAttributionService,
    private readonly confirmations: CollaborationTrustedConfirmationService,
  ) {}

  async approveAndExecute(user: AuthUser, command: ApproveReserveCommand) {
    return this.approveWithRetry(user, command, 2);
  }

  private async approveWithRetry(
    user: AuthUser,
    command: ApproveReserveCommand,
    serializationRetries: number,
  ): Promise<{ approval: FinancialReserveApproval; replayed: boolean }> {
    const scope = await this.authorization.resolve(user);
    if (scope.kind !== "FULL_FINANCIAL")
      throw new ForbiddenException(
        "Reserve approval requires Owner or Finance authority",
      );

    let broadcastCollaborationId: string | null = null;
    let replayed = false;
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`bp-reserve-key:${scope.brandProfileId}:${command.idempotency_key}`}, 0))`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`bp-reserve-instruction:${command.reserve_instruction_id}`}, 0))`;

          const byKey = await tx.financialReserveApproval.findUnique({
            where: {
              brandProfileId_idempotencyKey: {
                brandProfileId: scope.brandProfileId,
                idempotencyKey: command.idempotency_key,
              },
            },
          });
          if (byKey) {
            replayed = true;
            return this.assertReplay(byKey, command.reserve_instruction_id);
          }

          const instruction =
            await tx.collaborationReserveInstruction.findUnique({
              where: { id: command.reserve_instruction_id },
              include: {
                supersededBy: { select: { id: true }, take: 1 },
                collaboration: { select: { aggregateVersion: true } },
              },
            });
          if (
            !instruction ||
            instruction.brandProfileId !== scope.brandProfileId
          )
            throw new NotFoundException("Reserve instruction not found");
          if (
            instruction.status !== "REQUESTED" ||
            instruction.supersededBy.length
          )
            throw new ConflictException("Reserve instruction is not current");

          const requester = await tx.brandTeamMember.findUnique({
            where: {
              brandProfileId_userId: {
                brandProfileId: instruction.brandProfileId,
                userId: instruction.requestedByUserId,
              },
            },
          });
          if (!requester?.isActive)
            throw new ConflictException(
              "Reserve requester authority is unavailable",
            );

          const approvalId = randomUUID();
          const now = new Date();
          const approval = await tx.financialReserveApproval.create({
            data: {
              id: approvalId,
              reserveInstructionId: instruction.id,
              requestId: instruction.requestId,
              collaborationId: instruction.collaborationId,
              commercialAgreementId: instruction.commercialAgreementId,
              brandProfileId: instruction.brandProfileId,
              instructionVersion: instruction.instructionVersion,
              instructionHash: instruction.instructionHash,
              agreementVersion: instruction.agreementVersion,
              agreementHash: instruction.agreementHash,
              creatorFee: instruction.creatorFee,
              platformCommissionAmount: instruction.platformCommissionAmount,
              platformCommissionGstAmount:
                instruction.platformCommissionGstAmount,
              approvedReserveAmount: instruction.reserveAmount,
              currency: instruction.currency,
              requestedByUserId: instruction.requestedByUserId,
              requestedByMembershipId: requester.id,
              requestedByRole: requester.role,
              requestedAt: instruction.requestedAt,
              requesterObservedAt: now,
              approvedByUserId: user.id,
              approvedByMembershipId: scope.membershipId,
              approvedByRole: scope.role,
              idempotencyKey: command.idempotency_key,
            },
          });
          await tx.financialReserveApproval.update({
            where: { id: approval.id },
            data: {
              status: "EXECUTING",
              stateVersion: { increment: 1 },
              executionStartedAt: now,
            },
          });

          const attemptId = randomUUID();
          const claimToken = randomUUID();
          const attempt = await tx.financialReserveExecutionAttempt.create({
            data: {
              id: attemptId,
              approvalId: approval.id,
              attemptSequence: 1,
              claimToken,
              leaseExpiresAt: new Date(now.getTime() + 60_000),
              startedAt: now,
            },
          });

          const reserveResult = await this.reserve.reserveFunds(tx, {
            collaborationId: instruction.collaborationId,
            brandProfileId: instruction.brandProfileId,
            currency: instruction.currency,
            creatorGrossFee: instruction.creatorFee,
            platformCommissionAmount: instruction.platformCommissionAmount,
            platformCommissionGstAmount:
              instruction.platformCommissionGstAmount,
            requiredSecuredAmount: instruction.reserveAmount,
          });
          if (reserveResult.status === "INSUFFICIENT_AVAILABLE_BALANCE") {
            await tx.financialReserveExecutionAttempt.update({
              where: { id: attempt.id },
              data: {
                outcome: "SHORTFALL",
                failureCode: "INSUFFICIENT_AVAILABLE_BALANCE",
                completedAt: new Date(),
              },
            });
            return tx.financialReserveApproval.update({
              where: { id: approval.id },
              data: {
                status: "AWAITING_FUNDS",
                stateVersion: { increment: 1 },
                executionFailedAt: new Date(),
                failureCode: "INSUFFICIENT_AVAILABLE_BALANCE",
              },
            });
          }

          const vault = await tx.brandEscrowVault.findUniqueOrThrow({
            where: { brandProfileId: instruction.brandProfileId },
          });
          const allocated =
            await tx.collaborationFundingLotAllocation.aggregate({
              where: { collaborationId: instruction.collaborationId },
              _sum: { lockedAmount: true },
            });
          const allocatedAmount =
            allocated._sum.lockedAmount ?? new Prisma.Decimal(0);
          if (allocatedAmount.isZero()) {
            await this.attribution.reserveAvailable(tx, {
              vaultId: vault.id,
              brandProfileId: instruction.brandProfileId,
              collaborationId: instruction.collaborationId,
              currency: instruction.currency,
              amount: instruction.reserveAmount,
            });
          } else if (!allocatedAmount.equals(instruction.reserveAmount)) {
            throw new ConflictException(
              "Protected funding allocation is incomplete",
            );
          }

          const ledger = await tx.escrowTransactionLedger.findUniqueOrThrow({
            where: {
              idempotencyKey: `collaboration-reserve:${instruction.collaborationId}`,
            },
          });
          const confirmationId = `bp:${attempt.id}`;
          const confirmationBase = {
            confirmationId,
            bodyDigest: "0".repeat(64),
            collaborationId: instruction.collaborationId,
            expectedAggregateVersion:
              instruction.collaboration.aggregateVersion,
            fundingConfirmationRef: `bp-reserve:${approval.id}`,
            escrowLockRef: reserveResult.escrowLockRef,
            confirmedAmount: instruction.reserveAmount.toFixed(2),
            currency: instruction.currency,
            reserveInstructionId: instruction.id,
            reserveRequestId: instruction.requestId,
            reserveInstructionVersion: instruction.instructionVersion,
            reserveInstructionHash: instruction.instructionHash,
            commercialAgreementId: instruction.commercialAgreementId,
            agreementVersion: instruction.agreementVersion,
            agreementHash: instruction.agreementHash,
            payoutsApprovalRef: approval.id,
            reserveExecutionAttemptRef: attempt.id,
            reserveLedgerTransactionId: ledger.id,
            brandProfileId: instruction.brandProfileId,
            campaignId: instruction.campaignId,
            creatorProfileId: instruction.creatorProfileId,
          };
          const bodyDigest = trustedEscrowConfirmationDigest(confirmationBase);
          const applied = await this.confirmations.consumeEscrowInTransaction(
            tx,
            {
              ...confirmationBase,
              bodyDigest,
            },
          );
          const completedAt = new Date();
          await tx.financialReserveExecutionAttempt.update({
            where: { id: attempt.id },
            data: { outcome: "SUCCEEDED", completedAt },
          });
          const completed = await tx.financialReserveApproval.update({
            where: { id: approval.id },
            data: {
              status: "COMPLETED",
              stateVersion: { increment: 1 },
              executionCompletedAt: completedAt,
              escrowLockId: reserveResult.escrowLockRef,
              ledgerTransactionId: ledger.id,
              trustedConfirmationId: applied.trustedConfirmationId,
            },
          });
          broadcastCollaborationId = instruction.collaborationId;
          return completed;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      if (broadcastCollaborationId)
        await this.confirmations.broadcastEscrowApplied(
          broadcastCollaborationId,
        );
      return { approval: result, replayed };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        serializationRetries > 0
      )
        return this.approveWithRetry(user, command, serializationRetries - 1);
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
      const winner = await this.prisma.financialReserveApproval.findUnique({
        where: {
          brandProfileId_idempotencyKey: {
            brandProfileId: scope.brandProfileId,
            idempotencyKey: command.idempotency_key,
          },
        },
      });
      if (!winner) throw error;
      return {
        approval: this.assertReplay(winner, command.reserve_instruction_id),
        replayed: true,
      };
    }
  }

  private assertReplay<T extends { reserveInstructionId: string }>(
    row: T,
    reserveInstructionId: string,
  ): T {
    if (row.reserveInstructionId !== reserveInstructionId)
      throw new ConflictException(
        "Reserve idempotency key was reused with a changed command",
      );
    return row;
  }
}
