import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type UcePayoutTerms } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { EscrowFinancialAllocationService } from "../../brand-escrow/services/escrow-financial-allocation.service";
import { EscrowFundingAttributionService } from "../../brand-escrow/services/escrow-funding-attribution.service";
import type {
  CollaborationPaymentTermV1,
  CollaborationFinancialRecoveryInstructionV1,
  CollaborationPayoutEntitlementInstructionV1,
  CollaborationPayoutInstructionIntakePortV1,
} from "../ports/collaboration-payout-instruction.port";
import {
  kolkataPaymentDueAt,
  PAYOUT_DUE_RULE_VERSION,
} from "../utils/kolkata-due-date";

const NORMAL_TERMS = new Set<UcePayoutTerms>([
  "NET_7",
  "NET_15",
  "NET_30",
  "NET_45",
  "NET_60",
]);

@Injectable()
export class PayoutObligationIntakeService implements CollaborationPayoutInstructionIntakePortV1 {
  constructor(
    private readonly prisma: PrismaService,
    private readonly allocations: EscrowFinancialAllocationService,
    private readonly attribution: EscrowFundingAttributionService,
  ) {}

  async acceptEntitlement(input: CollaborationPayoutEntitlementInstructionV1) {
    try {
      const result = await this.acceptAuthority(input.instruction.id, input);
      return {
        outcome: result.replayed
          ? ("REPLAYED" as const)
          : ("ACCEPTED" as const),
        instruction: input.instruction,
        obligationReference: result.obligation.id,
        paymentDueAt: result.obligation.paymentDueAt!,
        observedAt: new Date(),
      };
    } catch (error) {
      return {
        outcome: "REJECTED" as const,
        instruction: input.instruction,
        reasonCode:
          error instanceof Error ? error.message : "PAYOUT_INTAKE_REJECTED",
        observedAt: new Date(),
      };
    }
  }

  async acceptRecovery(input: CollaborationFinancialRecoveryInstructionV1) {
    return {
      outcome: "REJECTED" as const,
      instruction: input.instruction,
      reasonCode: "P4R_RECOVERY_DEFERRED",
      observedAt: new Date(),
    };
  }

  async acceptAuthority(
    authorityInstructionId: string,
    expected?: CollaborationPayoutEntitlementInstructionV1,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`bp-obligation-authority:${authorityInstructionId}`}, 0))`;
        const authority =
          await tx.collaborationFinancialAuthorityInstruction.findUnique({
            where: { id: authorityInstructionId },
            include: {
              reserveInstruction: true,
              fundingConfirmation: true,
              commercialAgreement: true,
              supersededBy: { select: { id: true }, take: 1 },
            },
          });
        if (!authority)
          throw new NotFoundException("C04 payout authority not found");
        if (
          authority.kind !== "CREATOR_ENTITLEMENT" ||
          authority.fundingLineageMode !== "CANONICAL_PAYOUTS_V1" ||
          authority.resolutionType !== "NORMAL_SUCCESS" ||
          !authority.settlementEligibleAt ||
          !authority.reserveInstruction ||
          !authority.fundingConfirmation ||
          authority.supersededBy.length
        )
          throw new ConflictException(
            "C04 normal Creator entitlement is not current",
          );

        const reserve = authority.reserveInstruction;
        const confirmation = authority.fundingConfirmation;
        if (
          confirmation.applicationState !== "APPLIED" ||
          confirmation.reserveInstructionId !== reserve.id ||
          confirmation.commercialAgreementId !==
            authority.commercialAgreementId ||
          confirmation.brandProfileId !== reserve.brandProfileId ||
          confirmation.creatorProfileId !== reserve.creatorProfileId ||
          confirmation.currency !== authority.currency
        )
          throw new ConflictException(
            "C04 protected-funding lineage is incomplete",
          );

        const term = authority.commercialAgreement.campaignPaymentTermSnapshot;
        if (!term || !NORMAL_TERMS.has(term) || term === "IMMEDIATE")
          throw new ConflictException(
            "Payment term is not a supported normal net term",
          );
        const paymentDueAt = kolkataPaymentDueAt(
          authority.settlementEligibleAt,
          term as CollaborationPaymentTermV1,
        );
        if (expected)
          this.assertExpected(expected, authority, reserve, term, paymentDueAt);

        const existing = await tx.creatorPayoutObligation.findUnique({
          where: { authorityInstructionId: authority.id },
        });
        if (existing) {
          this.assertReplay(existing, authority);
          return { obligation: existing, replayed: true };
        }

        const vault = await tx.brandEscrowVault.findUnique({
          where: { brandProfileId: reserve.brandProfileId },
        });
        if (!vault || vault.currency !== authority.currency)
          throw new ConflictException("Brand vault authority mismatch");
        const lock = await tx.collaborationEscrowLock.findUnique({
          where: { collaborationId: authority.collaborationId },
        });
        if (!lock || lock.lockReleasedViaRefund)
          throw new ConflictException("Active C04 reserve lock is required");
        await this.allocations.assertCreatorAllocation(
          tx,
          authority.collaborationId,
          lock,
          authority.creatorEntitlementEffect,
        );
        const profile = await tx.creatorPayoutProfile.upsert({
          where: { creatorProfileId: reserve.creatorProfileId },
          create: {
            creatorProfileId: reserve.creatorProfileId,
            externalReferenceId: `creator:${reserve.creatorProfileId}`,
          },
          update: {},
        });
        const now = new Date();
        const obligation = await tx.creatorPayoutObligation.create({
          data: {
            settlementInstructionId: authority.id,
            collaborationId: authority.collaborationId,
            vaultId: vault.id,
            brandProfileId: reserve.brandProfileId,
            creatorProfileId: reserve.creatorProfileId,
            payoutProfileId: profile.id,
            obligationType: "FULL",
            entitlementAmount: authority.creatorEntitlementEffect,
            currency: authority.currency,
            status: "ELIGIBLE",
            instructionIssuedAt: authority.effectiveAt,
            paymentDueAt,
            provenanceMode: "CANONICAL_C04",
            authorityInstructionId: authority.id,
            authorityInstructionKind: authority.kind,
            authorityInstructionVersion: authority.instructionVersion,
            authorityInstructionHash: authority.instructionHash,
            commercialAgreementId: authority.commercialAgreementId,
            agreementVersion: authority.agreementVersion,
            agreementHash: authority.agreementHash,
            reserveInstructionId: reserve.id,
            fundingConfirmationId: confirmation.id,
            intakeRecordedAt: now,
            settlementEligibleAt: authority.settlementEligibleAt,
            paymentTermSnapshot: term,
            dueRuleVersion: PAYOUT_DUE_RULE_VERSION,
            dueEvidenceRecordedAt: now,
            lifecycle: "SCHEDULED",
            currentGate: "NOT_YET_DUE",
            amountSettled: new Prisma.Decimal(0),
            amountOutstanding: authority.creatorEntitlementEffect,
          },
        });
        await this.attribution.allocateCreatorObligation(tx, {
          obligationId: obligation.id,
          vaultId: vault.id,
          collaborationId: authority.collaborationId,
          currency: authority.currency,
          amount: authority.creatorEntitlementEffect,
        });
        return { obligation, replayed: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private assertReplay(
    obligation: {
      collaborationId: string;
      entitlementAmount: Prisma.Decimal;
      currency: string;
    },
    authority: {
      collaborationId: string;
      creatorEntitlementEffect: Prisma.Decimal;
      currency: string;
    },
  ) {
    if (
      obligation.collaborationId !== authority.collaborationId ||
      !obligation.entitlementAmount.equals(
        authority.creatorEntitlementEffect,
      ) ||
      obligation.currency !== authority.currency
    )
      throw new ConflictException(
        "C04 authority identity was reused with different economics",
      );
  }

  private assertExpected(
    input: CollaborationPayoutEntitlementInstructionV1,
    authority: {
      id: string;
      instructionVersion: number;
      instructionHash: string;
      commercialAgreementId: string;
      agreementVersion: number;
      agreementHash: string;
      creatorEntitlementEffect: Prisma.Decimal;
      currency: string;
      collaborationId: string;
    },
    reserve: {
      id: string;
      instructionVersion: number;
      instructionHash: string;
      brandProfileId: string;
      campaignId: string;
      creatorProfileId: string;
      creatorFee: Prisma.Decimal;
      platformCommissionAmount: Prisma.Decimal;
      platformCommissionGstAmount: Prisma.Decimal;
      reserveAmount: Prisma.Decimal;
    },
    term: UcePayoutTerms,
    paymentDueAt: Date,
  ) {
    const mismatch =
      input.instruction.id !== authority.id ||
      input.instruction.version !== String(authority.instructionVersion) ||
      input.instruction.integrityHash !== authority.instructionHash ||
      input.commercialAgreement.id !== authority.commercialAgreementId ||
      input.commercialAgreement.version !==
        String(authority.agreementVersion) ||
      input.commercialAgreement.integrityHash !== authority.agreementHash ||
      input.reserveRequest.id !== reserve.id ||
      input.reserveRequest.version !== String(reserve.instructionVersion) ||
      input.reserveRequest.integrityHash !== reserve.instructionHash ||
      input.brandProfileId !== reserve.brandProfileId ||
      input.campaignId !== reserve.campaignId ||
      input.collaborationId !== authority.collaborationId ||
      input.creatorProfileId !== reserve.creatorProfileId ||
      input.creatorGrossEntitlement !==
        authority.creatorEntitlementEffect.toFixed(2) ||
      input.commercialBreakdown.creatorGrossFee !==
        reserve.creatorFee.toFixed(2) ||
      input.commercialBreakdown.platformCommission !==
        reserve.platformCommissionAmount.toFixed(2) ||
      input.commercialBreakdown.gstOnPlatformCommission !==
        reserve.platformCommissionGstAmount.toFixed(2) ||
      input.commercialBreakdown.totalBrandCommercialReserve !==
        reserve.reserveAmount.toFixed(2) ||
      input.commercialBreakdown.currency !== authority.currency ||
      input.dueAuthority.kind !== "NORMAL_SUCCESS" ||
      input.dueAuthority.paymentTerm !== term ||
      input.dueAuthority.settlementEligibleAt.getTime() !==
        paymentDueAt.getTime() -
          { NET_7: 7, NET_15: 15, NET_30: 30, NET_45: 45, NET_60: 60 }[
            term as CollaborationPaymentTermV1
          ] *
            86_400_000;
    if (mismatch)
      throw new ConflictException(
        "Payout instruction does not match C04 authority",
      );
  }
}
