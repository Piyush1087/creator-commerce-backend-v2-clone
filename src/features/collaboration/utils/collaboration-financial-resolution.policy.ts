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
  advanceAmount?: Prisma.Decimal | null;
};

export function resolveFinancialOutcome(
  terms: LockedCommercialTerms,
  creatorGrossEntitlementAmount: Prisma.Decimal,
  outcome: CollaborationFinancialOutcome,
  reasonCode: string,
) {
  if (
    terms.agreedCreatorFee === null ||
    terms.platformCommissionRateSnapshot === null ||
    terms.platformCommissionAmount === null ||
    terms.platformCommissionGstRateSnapshot === null ||
    terms.platformCommissionGstAmount === null
  ) {
    throw new Error(
      "Locked commercial terms are incomplete for terminal financial resolution",
    );
  }
  const decomposition = calculateFinancialResolution(
    terms.agreedCreatorFee,
    creatorGrossEntitlementAmount,
    terms.platformCommissionRateSnapshot,
    terms.platformCommissionAmount,
    terms.platformCommissionGstRateSnapshot,
    terms.platformCommissionGstAmount,
  );
  return {
    status: CollaborationResolutionStatus.RESOLVED,
    outcome,
    creatorEntitlementAmount: decomposition.creatorGrossEntitlementAmount,
    brandRefundEntitlementAmount:
      decomposition.brandCommercialRefundEntitlementAmount,
    ...decomposition,
    currency: terms.currency,
    reasonCode,
    decidedByActorClass: "SYSTEM" as const,
  };
}

export function resolveFulfillmentHardStopFinancialOutcome(
  terms: LockedCommercialTerms,
) {
  return resolveFinancialOutcome(
    terms,
    new Prisma.Decimal(0),
    CollaborationFinancialOutcome.FULFILLMENT_HARD_STOP,
    "FULFILLMENT_HARD_STOP",
  );
}

export function resolveProductionHardStopFinancialOutcome(
  terms: LockedCommercialTerms,
) {
  if (terms.advanceAmount === null || terms.advanceAmount === undefined) {
    throw new Error(
      "Locked Advance amount is missing for Production hard-stop resolution",
    );
  }
  return resolveFinancialOutcome(
    terms,
    terms.advanceAmount,
    CollaborationFinancialOutcome.PRODUCTION_HARD_STOP,
    "PRODUCTION_HARD_STOP",
  );
}

export function resolveBrandDeclinedPublicationFinancialOutcome(
  terms: LockedCommercialTerms,
) {
  if (terms.advanceAmount === null || terms.advanceAmount === undefined) {
    throw new Error(
      "Locked Advance amount is missing for Brand-declined publication resolution",
    );
  }
  return resolveFinancialOutcome(
    terms,
    terms.advanceAmount,
    CollaborationFinancialOutcome.BRAND_PROTECTED_POST_SECUREMENT_EXIT,
    "BRAND_DECLINED_PUBLICATION",
  );
}
