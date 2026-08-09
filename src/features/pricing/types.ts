import type { FeatureLimitKey } from "./constants/subscription.constants";

export type GeoZone = "ZONE_IN" | "ZONE_US" | "ZONE_ROW";

export interface GeoContext {
  zone: GeoZone;
  currency: "INR" | "USD";
  complianceWarning?: string;
}

export interface CatalogPlanView {
  tierKey: string;
  name: string;
  priceDescriptor: string;
  isPubliclyAvailable: boolean;
}

export type EntitlementFeatureKey = Exclude<
  FeatureLimitKey,
  "ESCROW_AGGREGATE_CAP"
>;
