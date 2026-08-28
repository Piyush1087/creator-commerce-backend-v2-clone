import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { randomUUID } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { RazorpayXPayoutAdapter } from "./razorpayx-payout.adapter";

type Tranche = "ADVANCE_30" | "FINAL_70";

@Injectable()
export class EscrowCreatorPayoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: RazorpayXPayoutAdapter,
  ) {}

  async approveAndStart(input: {
    collaborationId: string;
    brandProfileId: string;
    approvedByUserId: string;
    tranche: Tranche;
  }) {
    const approved = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`escrow-obligation:${input.collaborationId}`}))`;
      const membership = await tx.brandTeamMember.findUnique({
        where: {
          brandProfileId_userId: {
            brandProfileId: input.brandProfileId,
            userId: input.approvedByUserId,
          },
        },
      });
      if (
        !membership?.isActive ||
        !["BRAND_OWNER", "FINANCE_ADMIN", "CAMPAIGN_MANAGER"].includes(
          membership.role,
        )
      )
        throw new ForbiddenException("Active Brand payout authority required");
      const collaboration = await tx.collaboration.findUnique({
        where: { id: input.collaborationId },
        include: { commercials: true, escrowLock: true, finalization: true },
      });
      if (!collaboration)
        throw new NotFoundException("Collaboration not found");
      if (collaboration.brandProfileId !== input.brandProfileId)
        throw new ForbiddenException(
          "Collaboration is outside this Brand workspace",
        );
      const lock = collaboration.escrowLock;
      const commercial = collaboration.commercials;
      if (!lock || !commercial || lock.lockReleasedViaRefund)
        throw new ConflictException("An active canonical reserve is required");
      if (lock.finalTrancheDisbursed)
        throw new ConflictException("Collaboration reserve is already settled");
      const gross = commercial.finalQuote;
      if (
        !gross ||
        gross.lessThanOrEqualTo(0) ||
        commercial.advance30Amount.lessThan(0) ||
        commercial.balance70Amount.lessThan(0) ||
        !commercial.advance30Amount
          .add(commercial.balance70Amount)
          .equals(gross) ||
        !lock.grossCreatorQuote.equals(gross) ||
        !lock.netCreatorPayoutPool.equals(gross)
      )
        throw new ConflictException(
          "Contracted payout amounts fail integrity validation",
        );
      const amount =
        input.tranche === "ADVANCE_30"
          ? commercial.advance30Amount
          : commercial.balance70Amount;
      if (input.tranche === "ADVANCE_30") {
        if (lock.advanceTrancheDisbursed)
          throw new ConflictException("Advance payout is already paid");
        if (amount.lessThanOrEqualTo(0))
          throw new BadRequestException("No contracted advance payout exists");
        if (
          collaboration.currentStage === "STAGE_1_NEGOTIATION" ||
          collaboration.currentStage === "STAGE_2_SECUREMENT"
        )
          throw new BadRequestException("Advance payout is not yet eligible");
      } else {
        if (!collaboration.finalization?.isComplianceVerified)
          throw new BadRequestException("Final compliance is required");
        if (commercial.advance30Amount.greaterThan(0)) {
          const advancePayout = await tx.escrowCreatorPayout.findUnique({
            where: {
              collaborationId_tranche: {
                collaborationId: input.collaborationId,
                tranche: "ADVANCE_30",
              },
            },
          });
          if (advancePayout?.status !== "PAID" || !lock.advanceTrancheDisbursed)
            throw new ConflictException(
              "Contracted advance must be paid before final payout",
            );
        }
      }
      const creator = await tx.creatorProfile.findUnique({
        where: { userId: collaboration.creatorUserId },
      });
      if (!creator) throw new NotFoundException("Creator profile not found");
      const vault = await tx.brandEscrowVault.findUnique({
        where: { brandProfileId: input.brandProfileId },
      });
      if (!vault) throw new NotFoundException("Escrow vault not found");
      if (vault.currency !== "INR")
        throw new BadRequestException("USD_PAYOUT_PROVIDER_GAP");
      const payout = await tx.escrowCreatorPayout.upsert({
        where: {
          collaborationId_tranche: {
            collaborationId: input.collaborationId,
            tranche: input.tranche,
          },
        },
        create: {
          collaborationId: input.collaborationId,
          escrowLockId: lock.id,
          brandProfileId: input.brandProfileId,
          creatorProfileId: creator.id,
          tranche: input.tranche,
          contractedAmount: amount,
          currency: vault.currency,
          approvedByUserId: input.approvedByUserId,
          status: "APPROVED",
        },
        update: {},
      });
      if (
        !payout.contractedAmount.equals(amount) ||
        payout.currency !== vault.currency
      )
        throw new ConflictException(
          "Existing payout conflicts with contracted authority",
        );
      if (payout.status === "PAID")
        return { payout, attempt: null, settlement: null, zeroFinal: false };
      if (input.tranche === "FINAL_70" && amount.equals(0))
        return { payout, attempt: null, settlement: null, zeroFinal: true };
      const settlement = await tx.creatorSettlementProfile.findUnique({
        where: { creatorProfileId: creator.id },
      });
      if (!settlement)
        throw new BadRequestException("Creator settlement route is missing");
      const resumable =
        payout.status === "PROCESSING" || payout.status === "APPROVED"
          ? await tx.escrowCreatorPayoutAttempt.findFirst({
              where: {
                payoutId: payout.id,
                status: { in: ["CREATED", "PROCESSING"] },
              },
              orderBy: { initiatedAt: "desc" },
            })
          : null;
      if (payout.status === "PROCESSING" && payout.currentProviderPayoutId)
        return { payout, attempt: null, settlement: null, zeroFinal: false };
      const attempt =
        resumable ??
        (await tx.escrowCreatorPayoutAttempt.create({
          data: {
            payoutId: payout.id,
            provider: "RAZORPAYX",
            providerIdempotencyKey: `creator-payout:${payout.id}:${randomUUID()}`,
            status: "CREATED",
          },
        }));
      return { payout, attempt, settlement, zeroFinal: false };
    });
    if (approved.zeroFinal) return this.settleZeroFinal(approved.payout.id);
    if (!approved.attempt || !approved.settlement)
      return this.map(approved.payout);
    const { payout, attempt } = approved;
    this.provider.assertConfigured();
    try {
      const route = await this.ensureRoute(
        approved.settlement,
        payout.creatorProfileId,
      );
      await this.startProviderAttempt(payout, attempt);
      const result = await this.provider.createPayout({
        fundAccountId: route,
        amountPaise: new Decimal(payout.contractedAmount).mul(100).toNumber(),
        idempotencyKey: attempt.providerIdempotencyKey,
        referenceId: payout.id,
      });
      await this.prisma.escrowCreatorPayoutAttempt.update({
        where: { id: attempt.id },
        data: { providerPayoutId: result.id, providerStatus: result.status },
      });
      await this.prisma.escrowCreatorPayout.update({
        where: { id: payout.id },
        data: {
          currentProviderPayoutId: result.id,
          currentProviderStatus: result.status,
        },
      });
      return this.reconcileProviderPayout(result.id, result.status);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return this.map(
          await this.prisma.escrowCreatorPayout.findUniqueOrThrow({
            where: { id: payout.id },
          }),
        );
      }
      await this.markFailed(payout.id, attempt.id, error);
      throw error;
    }
  }

  async reconcileProviderPayout(
    providerPayoutId: string,
    providerStatus: string,
  ) {
    const normalized = providerStatus.toLowerCase();
    if (["pending", "queued", "processing", "initiated"].includes(normalized))
      return this.setProcessing(providerPayoutId, normalized);
    if (["failed", "rejected", "cancelled"].includes(normalized))
      return this.setFailed(providerPayoutId, normalized);
    if (normalized === "processed")
      return this.setPaid(providerPayoutId, normalized);
    if (normalized === "reversed")
      return this.setReversed(providerPayoutId, normalized);
  }

  private async startProviderAttempt(
    payout: { id: string; collaborationId: string },
    attempt: { id: string },
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`escrow-obligation:${payout.collaborationId}`}))`;
      const [currentPayout, currentAttempt, lock] = await Promise.all([
        tx.escrowCreatorPayout.findUnique({ where: { id: payout.id } }),
        tx.escrowCreatorPayoutAttempt.findUnique({ where: { id: attempt.id } }),
        tx.collaborationEscrowLock.findUnique({
          where: { collaborationId: payout.collaborationId },
        }),
      ]);
      if (
        !lock ||
        lock.lockReleasedViaRefund ||
        currentPayout?.status !== "APPROVED" ||
        currentAttempt?.status !== "CREATED"
      )
        throw new ConflictException(
          "Payout obligation changed before provider initiation",
        );
      const now = new Date();
      await tx.escrowCreatorPayout.update({
        where: { id: payout.id },
        data: {
          status: "PROCESSING",
          processingAt: now,
          currentProvider: "RAZORPAYX",
        },
      });
      await tx.escrowCreatorPayoutAttempt.update({
        where: { id: attempt.id },
        data: { status: "PROCESSING", providerStatus: "requesting" },
      });
    });
  }

  private async ensureRoute(settlement: any, creatorProfileId: string) {
    let contactId = settlement.razorpayContactId as string | null;
    if (!contactId) {
      contactId = (
        await this.provider.createContact({
          name: settlement.accountHolderName,
          referenceId: `creator:${creatorProfileId}`,
        })
      ).id;
      await this.prisma.creatorSettlementProfile.update({
        where: { id: settlement.id },
        data: { razorpayContactId: contactId },
      });
    }
    let fundId = settlement.razorpayFundAccountId as string | null;
    if (!fundId) {
      fundId = (
        await this.provider.createFundAccount({
          contactId,
          name: settlement.accountHolderName,
          accountNumber: settlement.bankAccountNumber,
          ifsc: settlement.ifscCode,
        })
      ).id;
      await this.prisma.creatorSettlementProfile.update({
        where: { id: settlement.id },
        data: { razorpayFundAccountId: fundId, isSettlementRouteActive: true },
      });
    }
    return fundId;
  }

  private async setProcessing(providerId: string, status: string) {
    const attempt = await this.prisma.escrowCreatorPayoutAttempt.findUnique({
      where: { providerPayoutId: providerId },
      include: { payout: true },
    });
    if (!attempt || ["PAID", "FAILED", "REVERSED"].includes(attempt.status))
      return;
    await this.prisma.$transaction([
      this.prisma.escrowCreatorPayoutAttempt.update({
        where: { id: attempt.id },
        data: { status: "PROCESSING", providerStatus: status },
      }),
      this.prisma.escrowCreatorPayout.update({
        where: { id: attempt.payoutId },
        data: {
          status: "PROCESSING",
          processingAt: attempt.payout.processingAt ?? new Date(),
          currentProviderStatus: status,
        },
      }),
    ]);
    return { state: "PROCESSING", payout_id: attempt.payoutId };
  }

  private async setFailed(providerId: string, status: string) {
    const attempt = await this.prisma.escrowCreatorPayoutAttempt.findUnique({
      where: { providerPayoutId: providerId },
      include: { payout: true },
    });
    if (!attempt || ["PAID", "FAILED", "REVERSED"].includes(attempt.status))
      return;
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.escrowCreatorPayoutAttempt.update({
        where: { id: attempt.id },
        data: { status: "FAILED", providerStatus: status, terminalAt: now },
      }),
      this.prisma.escrowCreatorPayout.update({
        where: { id: attempt.payoutId },
        data: {
          status: "FAILED",
          failedAt: now,
          currentProviderStatus: status,
        },
      }),
    ]);
    return { state: "FAILED", payout_id: attempt.payoutId };
  }

  private async setPaid(providerId: string, status: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`creator-payout:${providerId}`}))`;
      const attempt = await tx.escrowCreatorPayoutAttempt.findUnique({
        where: { providerPayoutId: providerId },
        include: { payout: true },
      });
      if (attempt)
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`escrow-obligation:${attempt.payout.collaborationId}`}))`;
      if (
        !attempt ||
        attempt.status === "FAILED" ||
        attempt.status === "REVERSED"
      )
        return;
      if (attempt.status === "PAID") return this.map(attempt.payout);
      const payout = attempt.payout;
      const lock = await tx.collaborationEscrowLock.findUniqueOrThrow({
        where: { id: payout.escrowLockId },
      });
      if (lock.lockReleasedViaRefund)
        throw new ConflictException(
          "Cannot settle a refunded Escrow obligation",
        );
      const vault = await tx.brandEscrowVault.findUniqueOrThrow({
        where: { brandProfileId: payout.brandProfileId },
      });
      const commercial = await tx.collaborationCommercial.findUniqueOrThrow({
        where: { collaborationId: payout.collaborationId },
      });
      const platform =
        payout.tranche === "FINAL_70"
          ? lock.platformCommissionFee.add(lock.platformCommissionGst)
          : new Decimal(0);
      const consumed = payout.contractedAmount.add(platform);
      if (
        vault.lockedCampaignFunds.lessThan(consumed) ||
        vault.totalPooledBalance.lessThan(consumed)
      )
        throw new ConflictException("Escrow locked balance is insufficient");
      await tx.brandEscrowVault.update({
        where: { id: vault.id },
        data: {
          lockedCampaignFunds: { decrement: consumed },
          totalPooledBalance: { decrement: consumed },
        },
      });
      await tx.collaborationEscrowLock.update({
        where: { id: lock.id },
        data:
          payout.tranche === "ADVANCE_30"
            ? { advanceTrancheDisbursed: true }
            : { finalTrancheDisbursed: true },
      });
      await tx.collaborationCommercial.update({
        where: { collaborationId: payout.collaborationId },
        data: {
          escrowStatus:
            payout.tranche === "ADVANCE_30"
              ? lock.finalTrancheDisbursed
                ? "SETTLED"
                : "PARTIAL_RELEASE"
              : commercial.advance30Amount.greaterThan(0) &&
                  !lock.advanceTrancheDisbursed
                ? "PARTIAL_RELEASE"
                : "SETTLED",
        },
      });
      if (payout.tranche === "FINAL_70")
        await tx.collaborationFinalization.update({
          where: { collaborationId: payout.collaborationId },
          data: { isFinalPayoutReleased: true },
        });
      await tx.escrowTransactionLedger.create({
        data: {
          vaultId: vault.id,
          brandProfileId: payout.brandProfileId,
          collaborationId: payout.collaborationId,
          transactionType: "CREATOR_PAYOUT",
          payoutTrancheTarget: payout.tranche,
          amount: payout.contractedAmount,
          currency: payout.currency,
          idempotencyKey: `creator-payout:${payout.id}:${attempt.id}`,
          gatewayReferenceId: providerId,
          transactionStatus: "CLEARED",
        },
      });
      if (payout.tranche === "FINAL_70") {
        await tx.escrowTransactionLedger.create({
          data: {
            vaultId: vault.id,
            brandProfileId: payout.brandProfileId,
            collaborationId: payout.collaborationId,
            transactionType: "PLATFORM_COMMISSION",
            amount: lock.platformCommissionFee,
            currency: payout.currency,
            idempotencyKey: `platform-commission:${payout.id}:${attempt.id}`,
            transactionStatus: "CLEARED",
          },
        });
        if (lock.platformCommissionGst.greaterThan(0))
          await tx.escrowTransactionLedger.create({
            data: {
              vaultId: vault.id,
              brandProfileId: payout.brandProfileId,
              collaborationId: payout.collaborationId,
              transactionType: "GST",
              amount: lock.platformCommissionGst,
              currency: payout.currency,
              idempotencyKey: `commission-gst:${payout.id}:${attempt.id}`,
              transactionStatus: "CLEARED",
            },
          });
      }
      const now = new Date();
      await tx.escrowCreatorPayoutAttempt.update({
        where: { id: attempt.id },
        data: { status: "PAID", providerStatus: status, terminalAt: now },
      });
      const updated = await tx.escrowCreatorPayout.update({
        where: { id: payout.id },
        data: {
          status: "PAID",
          paidAt: now,
          failedAt: null,
          currentProviderStatus: status,
        },
      });
      return this.map(updated);
    });
  }

  private async setReversed(providerId: string, status: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`creator-payout:${providerId}`}))`;
      const attempt = await tx.escrowCreatorPayoutAttempt.findUnique({
        where: { providerPayoutId: providerId },
        include: { payout: true },
      });
      if (attempt)
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`escrow-obligation:${attempt.payout.collaborationId}`}))`;
      if (!attempt || attempt.status === "REVERSED") return;
      if (attempt.status !== "PAID") {
        if (attempt.status === "FAILED") return;
        const now = new Date();
        await tx.escrowCreatorPayoutAttempt.update({
          where: { id: attempt.id },
          data: { status: "FAILED", providerStatus: status, terminalAt: now },
        });
        await tx.escrowCreatorPayout.update({
          where: { id: attempt.payoutId },
          data: {
            status: "FAILED",
            failedAt: now,
            currentProviderStatus: status,
          },
        });
        return { state: "FAILED", payout_id: attempt.payoutId };
      }
      const payout = attempt.payout;
      const lock = await tx.collaborationEscrowLock.findUniqueOrThrow({
        where: { id: payout.escrowLockId },
      });
      const vault = await tx.brandEscrowVault.findUniqueOrThrow({
        where: { brandProfileId: payout.brandProfileId },
      });
      const platform =
        payout.tranche === "FINAL_70"
          ? lock.platformCommissionFee.add(lock.platformCommissionGst)
          : new Decimal(0);
      const restored = payout.contractedAmount.add(platform);
      await tx.brandEscrowVault.update({
        where: { id: vault.id },
        data: {
          lockedCampaignFunds: { increment: restored },
          totalPooledBalance: { increment: restored },
        },
      });
      await tx.collaborationEscrowLock.update({
        where: { id: lock.id },
        data:
          payout.tranche === "ADVANCE_30"
            ? { advanceTrancheDisbursed: false }
            : { finalTrancheDisbursed: false },
      });
      const escrowStatus =
        payout.tranche === "ADVANCE_30"
          ? lock.finalTrancheDisbursed
            ? "PARTIAL_RELEASE"
            : "FUNDED"
          : lock.advanceTrancheDisbursed
            ? "PARTIAL_RELEASE"
            : "FUNDED";
      await tx.collaborationCommercial.update({
        where: { collaborationId: payout.collaborationId },
        data: { escrowStatus },
      });
      if (payout.tranche === "FINAL_70")
        await tx.collaborationFinalization.update({
          where: { collaborationId: payout.collaborationId },
          data: { isFinalPayoutReleased: false },
        });
      await tx.escrowTransactionLedger.create({
        data: {
          vaultId: vault.id,
          brandProfileId: payout.brandProfileId,
          collaborationId: payout.collaborationId,
          transactionType: "REVERSAL_CORRECTION",
          payoutTrancheTarget: payout.tranche,
          amount: restored,
          currency: payout.currency,
          idempotencyKey: `reversal:${attempt.id}`,
          transactionStatus: "REVERSED",
          errorDiagnosticPayload: { providerPayoutId: providerId },
        },
      });
      const now = new Date();
      await tx.escrowCreatorPayoutAttempt.update({
        where: { id: attempt.id },
        data: { status: "REVERSED", providerStatus: status, terminalAt: now },
      });
      return this.map(
        await tx.escrowCreatorPayout.update({
          where: { id: payout.id },
          data: {
            status: "FAILED",
            failedAt: now,
            paidAt: null,
            currentProviderStatus: status,
          },
        }),
      );
    });
  }

  private async markFailed(
    payoutId: string,
    attemptId: string,
    error: unknown,
  ) {
    const now = new Date();
    const diagnosticPayload = {
      message: error instanceof Error ? error.message : "Provider failure",
    };
    await this.prisma.$transaction([
      this.prisma.escrowCreatorPayoutAttempt.update({
        where: { id: attemptId },
        data: { status: "FAILED", terminalAt: now, diagnosticPayload },
      }),
      this.prisma.escrowCreatorPayout.update({
        where: { id: payoutId },
        data: { status: "FAILED", failedAt: now, diagnosticPayload },
      }),
    ]);
  }

  private async settleZeroFinal(payoutId: string) {
    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.escrowCreatorPayout.findUniqueOrThrow({
        where: { id: payoutId },
      });
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`escrow-obligation:${payout.collaborationId}`}))`;
      if (payout.status === "PAID") return this.map(payout);
      const lock = await tx.collaborationEscrowLock.findUniqueOrThrow({
        where: { id: payout.escrowLockId },
      });
      const commercial = await tx.collaborationCommercial.findUniqueOrThrow({
        where: { collaborationId: payout.collaborationId },
      });
      if (
        lock.lockReleasedViaRefund ||
        (commercial.advance30Amount.greaterThan(0) &&
          !lock.advanceTrancheDisbursed)
      )
        throw new ConflictException(
          "Creator obligations must be paid before final settlement",
        );
      const vault = await tx.brandEscrowVault.findUniqueOrThrow({
        where: { brandProfileId: payout.brandProfileId },
      });
      const consumed = lock.platformCommissionFee.add(
        lock.platformCommissionGst,
      );
      await tx.brandEscrowVault.update({
        where: { id: vault.id },
        data: {
          lockedCampaignFunds: { decrement: consumed },
          totalPooledBalance: { decrement: consumed },
        },
      });
      await tx.collaborationEscrowLock.update({
        where: { id: lock.id },
        data: { finalTrancheDisbursed: true },
      });
      await tx.collaborationCommercial.update({
        where: { collaborationId: payout.collaborationId },
        data: { escrowStatus: "SETTLED" },
      });
      await tx.collaborationFinalization.update({
        where: { collaborationId: payout.collaborationId },
        data: { isFinalPayoutReleased: true },
      });
      await tx.escrowTransactionLedger.create({
        data: {
          vaultId: vault.id,
          brandProfileId: payout.brandProfileId,
          collaborationId: payout.collaborationId,
          transactionType: "PLATFORM_COMMISSION",
          amount: lock.platformCommissionFee,
          currency: payout.currency,
          idempotencyKey: `platform-commission:${payout.id}`,
          transactionStatus: "CLEARED",
        },
      });
      if (lock.platformCommissionGst.greaterThan(0))
        await tx.escrowTransactionLedger.create({
          data: {
            vaultId: vault.id,
            brandProfileId: payout.brandProfileId,
            collaborationId: payout.collaborationId,
            transactionType: "GST",
            amount: lock.platformCommissionGst,
            currency: payout.currency,
            idempotencyKey: `commission-gst:${payout.id}`,
            transactionStatus: "CLEARED",
          },
        });
      return this.map(
        await tx.escrowCreatorPayout.update({
          where: { id: payout.id },
          data: { status: "PAID", paidAt: new Date() },
        }),
      );
    });
  }

  private map(payout: any) {
    return {
      payout_id: payout.id,
      collaboration_id: payout.collaborationId,
      tranche: payout.tranche,
      amount: Number(payout.contractedAmount),
      currency: payout.currency,
      state: payout.status,
      provider_reference: payout.currentProviderPayoutId ?? null,
    };
  }
}
