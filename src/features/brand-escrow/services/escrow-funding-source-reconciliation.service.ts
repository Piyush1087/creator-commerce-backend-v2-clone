import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";

import { PrismaService } from "../../../prisma/prisma.service";
import { BrandReturnRefundProvider } from "./brand-return-provider.adapter";
import type { TrustedFundingEvidence } from "./brand-return-provider.types";

@Injectable()
export class EscrowFundingSourceReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: BrandReturnRefundProvider,
  ) {}

  /** Internal-only seam. No Brand-facing controller is intentionally provided. */
  async reconcileTrustedSource(
    fundingLotId: string,
    evidence: TrustedFundingEvidence,
  ) {
    await this.provider.verifyTrustedFundingEvidence(evidence);
    return this.prisma.$transaction(async (tx) => {
      const lot = await tx.escrowFundingLot.findUnique({
        where: { id: fundingLotId },
      });
      if (!lot) throw new NotFoundException("Funding lot not found");
      if (lot.provenanceStatus === "PROVEN_SOURCE") return lot;
      if (lot.brandProfileId !== evidence.brandProfileId) {
        throw new ConflictException("Trusted evidence Brand mismatch");
      }
      if (lot.currency !== evidence.currency.toUpperCase()) {
        throw new ConflictException("Trusted evidence currency mismatch");
      }
      if (!lot.creditedPrincipal.equals(new Decimal(evidence.amount))) {
        throw new ConflictException("Trusted evidence amount mismatch");
      }
      if (
        !evidence.providerPaymentId.trim() ||
        evidence.sourceType === "LEGACY_SOURCE_UNKNOWN"
      ) {
        throw new ConflictException(
          "Trusted evidence requires an external provider source",
        );
      }
      return tx.escrowFundingLot.update({
        where: { id: lot.id },
        data: {
          sourceType: evidence.sourceType,
          provenanceStatus: "PROVEN_SOURCE",
          providerPaymentId: evidence.providerPaymentId,
          providerOrderId: evidence.providerOrderId,
          capturedAmount: evidence.capturedAmount
            ? new Decimal(evidence.capturedAmount)
            : null,
          providerPaymentCaptured: true,
          providerRefundableAmount: lot.creditedPrincipal,
          provenanceDiagnostic: {
            classification: "TRUSTED_RECONCILIATION",
          },
        },
      });
    });
  }
}
