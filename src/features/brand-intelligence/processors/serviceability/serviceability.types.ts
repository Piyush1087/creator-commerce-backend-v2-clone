import type { IntelligenceFreshness } from "@prisma/client";
import type { PreparedProcessorDependencies } from "../../input/dependency/processor-dependency-preparation.service";
import type { ServiceabilityCurrentState } from "./serviceability-state.repository";

export const SERVICEABILITY_OBJECT = "serviceability_profile";
export type ServiceabilityScope =
  | "LOCAL"
  | "REGIONAL"
  | "COUNTRY"
  | "MULTI_COUNTRY"
  | "GLOBAL";
export type MarketScope =
  | "LOCAL"
  | "REGIONAL"
  | "COUNTRY"
  | "MULTI_COUNTRY_MEMBER"
  | "GLOBAL";
export type BasisType =
  | "CANONICAL_LOCATION_COVERAGE"
  | "CANONICAL_OFFERING_AVAILABILITY"
  | "SHIPPING_OR_DELIVERY_POLICY"
  | "DIGITAL_SERVICE_AVAILABILITY"
  | "FIRST_PARTY_SERVICE_AREA_STATEMENT"
  | "BRAND_CONFIRMED_GEOGRAPHY_INPUT";
export interface ServiceabilityMetadata {
  readonly authority: "OBSERVED" | "CREATOR_SHOP_DERIVED";
  readonly source_class:
    | "OWNED_WEBSITE"
    | "BRAND_USER_INPUT"
    | "CANONICAL_BUSINESS_STATE"
    | "MULTI_SOURCE"
    | "SYSTEM_DERIVATION_INPUT";
  readonly freshness: IntelligenceFreshness;
  readonly evidence_refs: readonly string[];
  readonly business_state_refs?: readonly string[] | null;
}
export interface ServiceabilityItemMetadata extends ServiceabilityMetadata {
  readonly semantic_id: string;
}
export interface ServiceableMarket {
  readonly semantic_id: string;
  readonly scope: MarketScope;
  readonly label: string | null;
  readonly country_code: string | null;
  readonly locality: string | null;
  readonly region: string | null;
  readonly radius_km: number | null;
}
export interface ServiceabilityBasis {
  readonly semantic_id: string;
  readonly basis_type: BasisType;
  readonly business_state_refs: readonly string[] | null;
  readonly evidence_refs: readonly string[] | null;
  readonly applies_to_market_refs: readonly string[] | null;
  readonly offering_refs: readonly string[] | null;
}
export interface ServiceabilityProfile {
  readonly overall_scope: ServiceabilityScope | null;
  readonly coverage_is_heterogeneous: boolean;
  readonly serviceable_markets: readonly ServiceableMarket[] | null;
  readonly serviceability_basis: readonly ServiceabilityBasis[] | null;
  readonly mixed_coverage_note: string | null;
}
export interface ServiceabilityOutput {
  readonly serviceability_profile: ServiceabilityProfile | null;
  readonly output_metadata: {
    readonly overall_scope: ServiceabilityMetadata | null;
    readonly coverage_is_heterogeneous: ServiceabilityMetadata | null;
    readonly serviceable_markets: readonly ServiceabilityItemMetadata[] | null;
    readonly serviceability_basis: readonly ServiceabilityItemMetadata[] | null;
    readonly mixed_coverage_note: ServiceabilityMetadata | null;
  };
}
export interface ServiceabilityPersistencePayload {
  readonly kind: "SERVICEABILITY_V1";
  readonly output: ServiceabilityOutput;
  readonly prepared: PreparedProcessorDependencies;
  readonly current: readonly ServiceabilityCurrentState[];
}
