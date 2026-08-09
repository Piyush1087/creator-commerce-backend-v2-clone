import { BrandRoutingType, IndustryVertical } from "@prisma/client";

const INDUSTRY_TO_ROUTING: Partial<Record<IndustryVertical, BrandRoutingType>> =
  {
    [IndustryVertical.D2C]: BrandRoutingType.D2C_SKINCARE,
    [IndustryVertical.SAAS_AI]: BrandRoutingType.SAAS_PRODUCT,
    [IndustryVertical.HEALTHCARE]: BrandRoutingType.HEALTHCARE_TREATMENT,
    [IndustryVertical.OFFLINE_SERVICES]: BrandRoutingType.OFFLINE_EXPERIENCE,
  };

export function mapIndustryVerticalToRoutingType(
  industry: IndustryVertical,
): BrandRoutingType {
  return INDUSTRY_TO_ROUTING[industry] ?? BrandRoutingType.D2C_SKINCARE;
}
