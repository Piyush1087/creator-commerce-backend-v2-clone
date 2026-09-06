import { Prisma } from "@prisma/client";

export function calculateCommercialReserve(
  creatorGrossFee: Prisma.Decimal,
  commissionRatePercent: Prisma.Decimal,
  gstRatePercent: Prisma.Decimal,
) {
  const platformCommissionAmount = creatorGrossFee
    .mul(commissionRatePercent)
    .div(100);
  const platformCommissionGstAmount = platformCommissionAmount
    .mul(gstRatePercent)
    .div(100);
  return {
    platformCommissionAmount,
    platformCommissionGstAmount,
    requiredSecuredAmount: creatorGrossFee
      .add(platformCommissionAmount)
      .add(platformCommissionGstAmount),
  };
}

export function calculateFinancialResolution(
  agreedCreatorFee: Prisma.Decimal,
  creatorGrossEntitlementAmount: Prisma.Decimal,
  commissionRatePercent: Prisma.Decimal,
  originalCommissionAmount: Prisma.Decimal,
  gstRatePercent: Prisma.Decimal,
  originalGstAmount: Prisma.Decimal,
) {
  const creatorCommercialRefundAmount = agreedCreatorFee.minus(
    creatorGrossEntitlementAmount,
  );
  const platformCommissionRetainedAmount = creatorGrossEntitlementAmount
    .mul(commissionRatePercent)
    .div(100);
  const platformCommissionRefundAmount = originalCommissionAmount.minus(
    platformCommissionRetainedAmount,
  );
  const platformCommissionGstRetainedAmount = platformCommissionRetainedAmount
    .mul(gstRatePercent)
    .div(100);
  const platformCommissionGstRefundAmount = originalGstAmount.minus(
    platformCommissionGstRetainedAmount,
  );
  return {
    creatorGrossEntitlementAmount,
    creatorCommercialRefundAmount,
    platformCommissionRetainedAmount,
    platformCommissionRefundAmount,
    platformCommissionGstRetainedAmount,
    platformCommissionGstRefundAmount,
    brandCommercialRefundEntitlementAmount: creatorCommercialRefundAmount
      .add(platformCommissionRefundAmount)
      .add(platformCommissionGstRefundAmount),
  };
}
