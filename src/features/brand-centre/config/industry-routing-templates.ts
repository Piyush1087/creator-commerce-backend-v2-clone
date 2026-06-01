import { BrandRoutingType } from "@prisma/client";

import type { IndustryRoutingTemplate } from "../types/routing-template.types";

const D2C_TEMPLATE: IndustryRoutingTemplate = {
  routingType: BrandRoutingType.D2C_SKINCARE,
  section4: {
    header: "Hero Products",
    addActionLabel: "Add Product",
    entityTypeLabel: "PRODUCT",
    maxCount: 5,
    drawerFields: [
      "imageUrl",
      "name",
      "url",
      "price",
      "briefDescription",
      "sellingPoints",
      "doNotSay",
      "applicableOffers",
    ],
    doNotSayExamples: [],
  },
  section5: {
    header: "Key Collections",
    addActionLabel: "Add Collection",
    maxCount: 3,
    drawerFields: [
      "imageUrl",
      "name",
      "url",
      "briefDescription",
      "sellingPoints",
      "doNotSay",
      "applicableOffers",
    ],
  },
  complianceHints: [],
};

const SAAS_TEMPLATE: IndustryRoutingTemplate = {
  routingType: BrandRoutingType.SAAS_PRODUCT,
  section4: {
    header: "Core Platforms & Modules",
    addActionLabel: "Add Module",
    entityTypeLabel: "MODULE",
    maxCount: 5,
    drawerFields: [
      "imageUrl",
      "name",
      "url",
      "startingPriceLabel",
      "briefDescription",
      "sellingPoints",
      "doNotSay",
      "applicableOffers",
    ],
    doNotSayExamples: ["Guaranteed 10x ROI"],
  },
  section5: {
    header: "Subscription Plans & Tiers",
    addActionLabel: "Add Subscription Tier",
    maxCount: 3,
    drawerFields: [
      "imageUrl",
      "name",
      "url",
      "briefDescription",
      "sellingPoints",
      "doNotSay",
      "applicableOffers",
    ],
  },
  complianceHints: [],
};

const HEALTHCARE_TEMPLATE: IndustryRoutingTemplate = {
  routingType: BrandRoutingType.HEALTHCARE_TREATMENT,
  section4: {
    header: "Treatments & Programs",
    addActionLabel: "Add Treatment",
    entityTypeLabel: "TREATMENT",
    maxCount: 5,
    drawerFields: [
      "imageUrl",
      "name",
      "url",
      "fee",
      "briefDescription",
      "sellingPoints",
      "doNotSay",
      "applicableOffers",
    ],
    doNotSayExamples: ["FDA Approved", "100% Painless", "Cures disease"],
  },
  section5: {
    header: "Specialties & Departments",
    addActionLabel: "Add Specialty",
    maxCount: 3,
    drawerFields: [
      "imageUrl",
      "name",
      "url",
      "briefDescription",
      "sellingPoints",
      "doNotSay",
      "applicableOffers",
    ],
  },
  complianceHints: [
    "Forbidden medical claims are stripped at deep scan and added to do-not-say list.",
  ],
};

const OFFLINE_TEMPLATE: IndustryRoutingTemplate = {
  routingType: BrandRoutingType.OFFLINE_EXPERIENCE,
  section4: {
    header: "Experiences & Venues",
    addActionLabel: "Add Experience",
    entityTypeLabel: "EXPERIENCE",
    maxCount: 5,
    drawerFields: [
      "imageUrl",
      "name",
      "url",
      "pricePerPax",
      "briefDescription",
      "sellingPoints",
      "doNotSay",
      "applicableOffers",
    ],
    doNotSayExamples: ["Unlimited alcohol", "Guaranteed celebrity appearances"],
  },
  section5: {
    header: "Locations & Properties",
    addActionLabel: "Add Location",
    maxCount: 3,
    drawerFields: [
      "imageUrl",
      "name",
      "url",
      "briefDescription",
      "sellingPoints",
      "doNotSay",
      "applicableOffers",
    ],
  },
  complianceHints: [],
};

const ROUTING_TEMPLATES: Record<BrandRoutingType, IndustryRoutingTemplate> = {
  [BrandRoutingType.D2C_SKINCARE]: D2C_TEMPLATE,
  [BrandRoutingType.SAAS_PRODUCT]: SAAS_TEMPLATE,
  [BrandRoutingType.HEALTHCARE_TREATMENT]: HEALTHCARE_TEMPLATE,
  [BrandRoutingType.OFFLINE_EXPERIENCE]: OFFLINE_TEMPLATE,
};

export function getIndustryRoutingTemplate(
  routingType: BrandRoutingType,
): IndustryRoutingTemplate {
  return ROUTING_TEMPLATES[routingType];
}

export function listIndustryRoutingTemplates(): IndustryRoutingTemplate[] {
  return Object.values(ROUTING_TEMPLATES);
}
