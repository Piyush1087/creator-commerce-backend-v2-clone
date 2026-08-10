import {
  CollaborationFinancialOutcome,
  CollaborationResolutionStatus,
  Prisma,
} from "@prisma/client";

import { calculateFinancialResolution } from "./collaboration-financial-calculation";

type LockedCommercialTerms = {
  agreedCreatorFee: Prisma.Decimal | null;
  currency: string;
  platformCommissionRateSnapshot: Prisma.Decimal | null;
  platformCommissionAmount: Prisma.Decimal | null;
  platformCommissionGstRateSnapshot: Prisma.Decimal | null;
  platformCommissionGstAmount: Prisma.Decimal | null;
};

export function resolveFulfillmentHardStopFinancialOutcome(
  terms: LockedCommercialTerms,
) {
  if (
    terms.agreedCreatorFee === null ||
    terms.platformCommissionRateSnapshot === null ||
    terms.platformCommissionAmount === null ||
    terms.platformCommissionGstRateSnapshot === null ||
    terms.platformCommissionGstAmount === null
  ) {
    throw new Error(
      "Locked commercial terms are incomplete for Fulfillment hard-stop resolution",
    );
  }

  const zero = new Prisma.Decimal(0);
  const decomposition = calculateFinancialResolution(
    terms.agreedCreatorFee,
    zero,
    terms.platformCommissionRateSnapshot,
    terms.platformCommissionAmount,
    terms.platformCommissionGstRateSnapshot,
    terms.platformCommissionGstAmount,
  );

  return {
    status: CollaborationResolutionStatus.RESOLVED,
    outcome: CollaborationFinancialOutcome.FULFILLMENT_HARD_STOP,
    creatorEntitlementAmount: decomposition.creatorGrossEntitlementAmount,
    brandRefundEntitlementAmount:
      decomposition.brandCommercialRefundEntitlementAmount,
    ...decomposition,
    currency: terms.currency,
    reasonCode: "FULFILLMENT_HARD_STOP",
    decidedByActorClass: "SYSTEM" as const,
  };
}
