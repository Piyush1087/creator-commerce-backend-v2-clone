/**
 * Instagram Intelligence V1 algorithm and safety defaults.
 *
 * These values are versioned implementation constants, not permanent Product
 * semantics. Any later change must produce a new algorithm contract version
 * and retain the old value for replayability.
 */
export const INSTAGRAM_INTELLIGENCE_ALGORITHM_CONTRACT_VERSION = "1.0" as const;

export const INSTAGRAM_INTELLIGENCE_V1_CONSTANTS = {
  analysisWindowDays: 30,
  inventoryHardCap: 500,
  deepMultimodalPostCap: 24,
  carouselChildCap: 10,
  knownDurationFrameCap: 6,
  unknownDurationFrameCap: 3,
  minimumSignalSample: 3,
  minimumComparableCohortSample: 3,
  minimumMetricCoveragePercent: 50,
  mediumConfidenceMinimumCoveragePercent: 70,
  mediumConfidenceMinimumSample: 5,
  mediumConfidenceMinimumPublicationDates: 2,
  materialAudienceDifferencePercentagePoints: 10,
  notableAudienceDifferencePercentagePoints: 5,
  trendMinimumSnapshots: 3,
  trendMinimumElapsedDays: 14,
  dailyFreshnessHours: 36,
  audienceFreshnessDays: 8,
  manualRefreshCooldownMinutes: 15,
  dispatcherIntervalMinutes: 60,
  maximumDispatcherJitterMinutes: 30,
} as const;

export const INSTAGRAM_DEEP_SELECTION_REASONS = [
  "RECENT_FORMAT_COVERAGE",
  "TOP_PERFORMANCE_BAND",
  "MIDDLE_PERFORMANCE_BAND",
  "LOW_PERFORMANCE_BAND",
  "LIKELY_CREATOR_CUE",
  "BRAND_ONLY_BASELINE_CUE",
  "OFFERING_DIVERSITY_CUE",
  "THEME_DIVERSITY_CUE",
  "TIME_BUCKET_COVERAGE",
  "STABLE_FILL",
] as const;

export const INSTAGRAM_INTELLIGENCE_REASON_CODES = [
  "CONNECTION_NOT_CONNECTED",
  "CONNECTION_CONNECTING",
  "REAUTH_REQUIRED",
  "PARTIAL_CAPABILITY",
  "UNKNOWN_CAPABILITY",
  "AUTHORIZATION_DEGRADED",
  "ACCOUNT_IDENTITY_CONFLICT",
  "PROVIDER_TRANSIENT_FAILURE",
  "PROVIDER_REQUEST_FAILED",
  "RATE_LIMITED",
  "INVENTORY_CAP_REACHED",
  "WINDOW_EMPTY",
  "MISSING_TIMESTAMP",
  "METRIC_NOT_SUPPORTED",
  "METRIC_NOT_RETURNED",
  "AUDIENCE_NOT_SUPPORTED",
  "AUDIENCE_PRIVACY_SUPPRESSED",
  "AUDIENCE_FOLLOWERS_UNAVAILABLE",
  "AUDIENCE_ENGAGED_UNAVAILABLE",
  "MEDIA_NOT_SELECTED_FOR_DEEP_ANALYSIS",
  "MEDIA_DOWNLOAD_FAILED",
  "MEDIA_URL_EXPIRED",
  "MEDIA_TYPE_UNSUPPORTED",
  "CAROUSEL_CHILD_UNAVAILABLE",
  "VIDEO_NOT_ANALYZED",
  "AUDIO_NOT_ANALYZED",
  "TRANSCRIPT_NOT_ACQUIRED",
  "COVER_ONLY",
  "INSUFFICIENT_SAMPLE",
  "INSUFFICIENT_COMPARABLE_SAMPLE",
  "INSUFFICIENT_METRIC_COVERAGE",
  "INSUFFICIENT_EVIDENCE",
  "NOT_INSPECTED",
  "INTENTIONAL_ABSENCE",
  "REFRESH_COOLDOWN",
  "REFRESH_NOT_AUTHORIZED",
  "REFRESH_BACKOFF_ACTIVE",
  "REFRESH_ALREADY_RUNNING",
  "CURRENT_PRESERVED_AFTER_FAILURE",
  "DELETE_IN_PROGRESS",
  "DELETED",
  "SOURCE_SCOPE_MISMATCH",
  "OFFERING_MATCH_UNVERIFIED",
  "CREATOR_IDENTITY_UNVERIFIED",
] as const;

export type InstagramIntelligenceReasonCode =
  (typeof INSTAGRAM_INTELLIGENCE_REASON_CODES)[number];
