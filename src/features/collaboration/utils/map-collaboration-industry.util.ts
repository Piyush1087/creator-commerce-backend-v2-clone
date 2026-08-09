import {
  BrandRoutingType,
  CollaborationIndustryType,
  IndustryVertical,
} from "@prisma/client";

export function mapBrandIndustryToCollaborationIndustry(
  industry: IndustryVertical,
  routingType?: BrandRoutingType,
): CollaborationIndustryType {
  if (routingType === BrandRoutingType.SAAS_PRODUCT) {
    return CollaborationIndustryType.AI_SAAS;
  }
  if (routingType === BrandRoutingType.HEALTHCARE_TREATMENT) {
    return CollaborationIndustryType.HEALTHCARE_CLINICAL;
  }
  if (routingType === BrandRoutingType.OFFLINE_EXPERIENCE) {
    return CollaborationIndustryType.OFFLINE_EXPERIENCES;
  }

  switch (industry) {
    case IndustryVertical.SAAS_AI:
      return CollaborationIndustryType.AI_SAAS;
    case IndustryVertical.HEALTHCARE:
      return CollaborationIndustryType.HEALTHCARE_CLINICAL;
    case IndustryVertical.OFFLINE_SERVICES:
      return CollaborationIndustryType.OFFLINE_EXPERIENCES;
    default:
      return CollaborationIndustryType.D2C_ECOMMERCE;
  }
}
