import type {
  BrandPayoutsAuthorizationScopeV1,
  BrandPayoutsFullFinancialAuthorizationScopeV1,
} from "../contracts/brand-payouts-authorization.contract";
import type {
  BrandPayoutsActivityCategory,
  BrandPayoutsActivityCsvExportV2,
  BrandPayoutsActivityDetailResponseV2,
  BrandPayoutsActivityResponseV2,
  BrandPayoutsBrandReturnDetailResponseV2,
  BrandPayoutsBrandReturnsResponseV2,
  BrandPayoutsBrandReturnStatus,
  BrandPayoutsObligationDetailResponseV2,
  BrandPayoutsObligationGate,
  BrandPayoutsObligationLifecycle,
  BrandPayoutsObligationsResponseV2,
  BrandPayoutsOverviewResponseV2,
  BrandPayoutsReserveRequestStatus,
  BrandPayoutsReserveRequestsResponseV2,
} from "../contracts/brand-payouts-v2.contract";

export const BRAND_PAYOUTS_QUERY_PORT_V2 = Symbol(
  "BRAND_PAYOUTS_QUERY_PORT_V2",
);

export interface BrandPayoutsReadContextV2 {
  /** Server-resolved active membership and entity scope; never client input. */
  readonly authorization: BrandPayoutsAuthorizationScopeV1;
  /** One fixed database snapshot boundary shared by the response. */
  readonly asOf: Date;
}

export interface BrandPayoutsOverviewReadRequestV2 extends BrandPayoutsReadContextV2 {}

export interface BrandPayoutsActivityPageRequestV2 extends BrandPayoutsReadContextV2 {
  readonly cursor?: string;
  readonly limit: number;
  readonly categories?: readonly BrandPayoutsActivityCategory[];
  readonly fromInclusive?: Date;
  readonly toExclusive?: Date;
}

export interface BrandPayoutsPageRequestV2 extends BrandPayoutsReadContextV2 {
  readonly cursor?: string;
  readonly limit: number;
}

export interface BrandPayoutsObligationsPageRequestV2 extends BrandPayoutsPageRequestV2 {
  readonly lifecycles?: readonly BrandPayoutsObligationLifecycle[];
  readonly gates?: readonly BrandPayoutsObligationGate[];
}

export interface BrandPayoutsBrandReturnsPageRequestV2 extends BrandPayoutsPageRequestV2 {
  readonly statuses?: readonly BrandPayoutsBrandReturnStatus[];
}

export interface BrandPayoutsReserveRequestsPageRequestV2 extends BrandPayoutsPageRequestV2 {
  readonly statuses?: readonly BrandPayoutsReserveRequestStatus[];
}

export interface BrandPayoutsDetailReadRequestV2 extends BrandPayoutsReadContextV2 {
  /** Stable Creator Shop identity, never a provider-native identifier. */
  readonly resourceId: string;
}

export interface BrandPayoutsActivityCsvReadRequestV2 {
  /** This type prevents Campaign Manager use before any query is executed. */
  readonly authorization: BrandPayoutsFullFinancialAuthorizationScopeV1;
  readonly asOf: Date;
  readonly fromInclusive: Date;
  readonly toExclusive: Date;
  readonly categories?: readonly BrandPayoutsActivityCategory[];
}

/**
 * Side-effect-free application boundary for P1. Implementations may only read
 * existing canonical sources and must not provision, refresh, or call an
 * external payment system.
 */
export interface BrandPayoutsQueryPortV2 {
  readOverview(
    request: BrandPayoutsOverviewReadRequestV2,
  ): Promise<BrandPayoutsOverviewResponseV2>;

  listActivity(
    request: BrandPayoutsActivityPageRequestV2,
  ): Promise<BrandPayoutsActivityResponseV2>;

  listObligations(
    request: BrandPayoutsObligationsPageRequestV2,
  ): Promise<BrandPayoutsObligationsResponseV2>;

  readObligation(
    request: BrandPayoutsDetailReadRequestV2,
  ): Promise<BrandPayoutsObligationDetailResponseV2>;

  readActivity(
    request: BrandPayoutsDetailReadRequestV2,
  ): Promise<BrandPayoutsActivityDetailResponseV2>;

  listBrandReturns(
    request: BrandPayoutsBrandReturnsPageRequestV2,
  ): Promise<BrandPayoutsBrandReturnsResponseV2>;

  readBrandReturn(
    request: BrandPayoutsDetailReadRequestV2,
  ): Promise<BrandPayoutsBrandReturnDetailResponseV2>;

  listReserveRequests(
    request: BrandPayoutsReserveRequestsPageRequestV2,
  ): Promise<BrandPayoutsReserveRequestsResponseV2>;

  readActivityCsv(
    request: BrandPayoutsActivityCsvReadRequestV2,
  ): Promise<BrandPayoutsActivityCsvExportV2>;
}
