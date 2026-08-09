import type { BrandRoutingType } from "@prisma/client";

export type RoutingDrawerFieldKey =
  | "imageUrl"
  | "name"
  | "url"
  | "price"
  | "startingPriceLabel"
  | "fee"
  | "pricePerPax"
  | "briefDescription"
  | "sellingPoints"
  | "doNotSay"
  | "applicableOffers";

export type IndustryRoutingTemplate = {
  routingType: BrandRoutingType;
  section4: {
    header: string;
    addActionLabel: string;
    entityTypeLabel: string;
    maxCount: number;
    drawerFields: RoutingDrawerFieldKey[];
    doNotSayExamples: string[];
  };
  section5: {
    header: string;
    addActionLabel: string;
    maxCount: number;
    drawerFields: RoutingDrawerFieldKey[];
  };
  complianceHints: string[];
};
