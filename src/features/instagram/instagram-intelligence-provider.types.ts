import type { InstagramProviderErrorClass } from "./instagram-provider-error";

export const INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT = Symbol(
  "INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT",
);

export const INSTAGRAM_MEDIA_WINDOW_DAYS = 30;
export const INSTAGRAM_MEDIA_MAX_ITEMS = 500;
export const INSTAGRAM_CAROUSEL_MAX_CHILDREN = 10;

export type InstagramAvailability = "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";

export type InstagramField<T> =
  | { state: "OBSERVED"; value: T }
  | { state: "OBSERVED_ZERO"; value: 0 }
  | { state: "EXPLICIT_EMPTY"; value: "" }
  | { state: "UNAVAILABLE"; reason: string }
  | { state: "UNSUPPORTED"; reason: string }
  | {
      state: "PROVIDER_FAILURE";
      classification: InstagramProviderErrorClass;
    };

export type InstagramProviderCredential = Readonly<{
  accessToken: string;
  providerAccountId: string;
}>;

export type InstagramProfileTruth = {
  availability: InstagramAvailability;
  providerAccountId: string;
  appScopedUserId: InstagramField<string>;
  username: InstagramField<string>;
  name: InstagramField<string>;
  profilePictureUrl: InstagramField<string>;
  accountType: InstagramField<string>;
  followersCount: InstagramField<number>;
  followsCount: InstagramField<number>;
  mediaCount: InstagramField<number>;
};

export type InstagramMediaTruth = {
  providerMediaId: string;
  mediaType: InstagramField<string>;
  mediaProductType: InstagramField<string>;
  permalink: InstagramField<string>;
  caption: InstagramField<string>;
  timestamp: InstagramField<string>;
};

export type InstagramPaginationCoverage = {
  windowStart: string;
  windowEnd: string;
  pagesAttempted: number;
  pagesCompleted: number;
  rowsReturned: number;
  rowsEligible: number;
  rowsMissingTimestamp: number;
  duplicatesDiscarded: number;
  oldestObservedTimestamp: string | null;
  newestObservedTimestamp: string | null;
  stopReason:
    | "EXHAUSTED"
    | "EMPTY_SUCCESS"
    | "CAP_REACHED"
    | "PROVIDER_FAILURE";
};

export type InstagramMediaInventoryTruth = {
  availability: InstagramAvailability;
  items: InstagramMediaTruth[];
  coverage: InstagramPaginationCoverage;
  failureClassification?: InstagramProviderErrorClass;
};

export const INSTAGRAM_MEDIA_INSIGHT_METRICS = [
  "comments",
  "likes",
  "reach",
  "saved",
  "shares",
  "total_interactions",
  "views",
] as const;
export type InstagramMediaInsightMetric =
  (typeof INSTAGRAM_MEDIA_INSIGHT_METRICS)[number];

export type InstagramMediaInsightsTruth = {
  availability: InstagramAvailability;
  mediaType: string;
  metrics: Record<InstagramMediaInsightMetric, InstagramField<number>>;
  units: Record<InstagramMediaInsightMetric, "COUNT">;
  denominators: Record<
    InstagramMediaInsightMetric,
    { state: "UNAVAILABLE"; reason: "NO_PROVIDER_DENOMINATOR" }
  >;
  providerObservationTime: {
    state: "UNAVAILABLE";
    reason: "PROVIDER_DOES_NOT_RETURN_OBSERVATION_TIME";
  };
  providerLagLimitHours: 48;
  unavailableReason?:
    | "EMPTY_DATA"
    | "CONTENT_OR_METRIC_UNAVAILABLE"
    | "PROVIDER_FAILURE";
  failureClassification?: InstagramProviderErrorClass;
};

export type InstagramAudiencePopulation = "FOLLOWERS" | "ENGAGED_AUDIENCE";
export type InstagramAudienceBreakdown = "AGE" | "CITY" | "COUNTRY" | "GENDER";
export type InstagramAudienceTimeframe = "THIS_MONTH" | "THIS_WEEK";

export type InstagramAudienceInsightsTruth = {
  availability: InstagramAvailability;
  population: InstagramAudiencePopulation;
  breakdown: InstagramAudienceBreakdown;
  timeframe: InstagramAudienceTimeframe;
  values: Array<{ dimension: string; value: number }>;
  limitation:
    | null
    | "PROVIDER_EMPTY_OR_THRESHOLD_SUPPRESSED"
    | "TOP_45_PROVIDER_LIMIT";
  failureClassification?: InstagramProviderErrorClass;
};

export type InstagramCarouselChildrenTruth = {
  availability: InstagramAvailability;
  children: Array<{
    providerMediaId: string;
    ordinal: number;
    mediaType: InstagramField<string>;
    mediaProductType: InstagramField<string>;
  }>;
  stopReason:
    | "EXHAUSTED"
    | "EMPTY_SUCCESS"
    | "CAP_REACHED"
    | "PROVIDER_FAILURE";
  failureClassification?: InstagramProviderErrorClass;
};

export interface InstagramIntelligenceProviderReadClient {
  readProfile(
    credential: InstagramProviderCredential,
  ): Promise<InstagramProfileTruth>;
  readMediaInventory(
    credential: InstagramProviderCredential,
    windowEnd: Date,
  ): Promise<InstagramMediaInventoryTruth>;
  readMediaInsights(
    credential: InstagramProviderCredential,
    mediaId: string,
    mediaType: string,
  ): Promise<InstagramMediaInsightsTruth>;
  readAudienceInsights(
    credential: InstagramProviderCredential,
    population: InstagramAudiencePopulation,
    breakdown: InstagramAudienceBreakdown,
    timeframe: InstagramAudienceTimeframe,
  ): Promise<InstagramAudienceInsightsTruth>;
  readCarouselChildren(
    credential: InstagramProviderCredential,
    mediaId: string,
  ): Promise<InstagramCarouselChildrenTruth>;
}
