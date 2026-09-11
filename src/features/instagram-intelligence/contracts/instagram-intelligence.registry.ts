import {
  INSTAGRAM_INTELLIGENCE_ALGORITHM_CONTRACT_VERSION,
  INSTAGRAM_INTELLIGENCE_V1_CONSTANTS,
} from "./instagram-intelligence.constants";

export const INSTAGRAM_INTELLIGENCE_OBJECT_IDS = [
  "instagram_content_behavior",
  "instagram_audience_profile",
  "instagram_organic_performance_profile",
] as const;

export type InstagramIntelligenceObjectId =
  (typeof INSTAGRAM_INTELLIGENCE_OBJECT_IDS)[number];

/**
 * Contract vocabulary for the later additive DE migration/runtime packet.
 * Keeping it outside the accepted website runtime union prevents A2 from
 * claiming that Prisma can persist these values before B1 migrates them.
 */
export const INSTAGRAM_DE_CONTRACT = {
  sourceClass: "INSTAGRAM_OWNED",
  resourceTypes: ["INSTAGRAM_ACCOUNT", "INSTAGRAM_MEDIA"],
  capabilities: [
    "instagram.account_profile",
    "instagram.media_inventory",
    "instagram.media_insights",
    "instagram.audience_followers",
    "instagram.audience_engaged",
    "instagram.caption_context",
    "instagram.media_visual_observations",
    "instagram.media_creator_signals",
    "instagram.media_offering_signals",
  ],
} as const;

export const INSTAGRAM_INTELLIGENCE_OBJECT_REGISTRY = [
  {
    semanticId: "instagram_content_behavior",
    objectContractVersion: "1.0",
    outputContractVersion: "1.0",
    freshnessClass: "DAILY",
    staleAfterHours: INSTAGRAM_INTELLIGENCE_V1_CONSTANTS.dailyFreshnessHours,
    components: [
      "window",
      "corpus_summary",
      "posting_cadence",
      "format_mix",
      "theme_patterns",
      "caption_patterns",
      "creative_structure_patterns",
      "offering_presence_patterns",
      "creator_presence_patterns",
      "representative_media_refs",
      "bounded_learnings",
      "coverage",
    ],
  },
  {
    semanticId: "instagram_audience_profile",
    objectContractVersion: "1.0",
    outputContractVersion: "1.0",
    freshnessClass: "WEEKLY",
    staleAfterHours:
      INSTAGRAM_INTELLIGENCE_V1_CONSTANTS.audienceFreshnessDays * 24,
    components: [
      "window",
      "follower_audience",
      "engaged_audience",
      "distribution_concentration",
      "material_differences",
      "limitations",
      "coverage",
      "summary",
    ],
  },
  {
    semanticId: "instagram_organic_performance_profile",
    objectContractVersion: "1.0",
    outputContractVersion: "1.0",
    freshnessClass: "DAILY",
    staleAfterHours: INSTAGRAM_INTELLIGENCE_V1_CONSTANTS.dailyFreshnessHours,
    components: [
      "window",
      "account_results",
      "metric_coverage",
      "format_baselines",
      "response_distribution",
      "high_response_cohorts",
      "low_response_cohorts",
      "content_performance_signals",
      "snapshot_change",
      "representative_media_refs",
      "bounded_learnings",
      "coverage",
    ],
  },
] as const satisfies readonly {
  semanticId: InstagramIntelligenceObjectId;
  objectContractVersion: string;
  outputContractVersion: string;
  freshnessClass: "DAILY" | "WEEKLY";
  staleAfterHours: number;
  components: readonly string[];
}[];

export const INSTAGRAM_SYNC_CAPABILITY_CLASSES = [
  "INITIAL_30_DAY",
  "PROFILE_MEDIA_PERFORMANCE",
  "AUDIENCE",
] as const;

/**
 * B2 provider-verified Instagram Login v26 read allowlist. Missing provider
 * rows remain unavailable and unsupported pairs are never requested.
 */
export const INSTAGRAM_GRAPH_METRIC_CONTRACT = {
  graphVersion: "v26.0",
  verificationState: "B2_PROVIDER_VERIFIED_2026_09_11",
  media: {
    IMAGE: [
      "comments",
      "likes",
      "reach",
      "saved",
      "shares",
      "total_interactions",
      "views",
    ],
    CAROUSEL_ALBUM: [
      "comments",
      "likes",
      "reach",
      "saved",
      "shares",
      "total_interactions",
      "views",
    ],
    VIDEO: [
      "comments",
      "likes",
      "reach",
      "saved",
      "shares",
      "total_interactions",
      "views",
    ],
    REEL: [
      "comments",
      "likes",
      "reach",
      "saved",
      "shares",
      "total_interactions",
      "views",
    ],
    STORY: ["reach", "shares", "total_interactions", "views"],
  },
  audience: {
    metrics: ["follower_demographics", "engaged_audience_demographics"],
    period: "lifetime",
    metricType: "total_value",
    timeframes: ["this_month", "this_week"],
    breakdowns: ["age", "city", "country", "gender"],
    providerTopCategoryLimit: 45,
    privacyThreshold: 100,
  },
} as const;

export const INSTAGRAM_WORKSPACE_ROUTE_CONTRACT = {
  aggregate: "GET /api/v1/brand-centre/instagram",
  refresh: "POST /api/v1/brand-centre/instagram/refresh",
  mediaDetail: "GET /api/v1/brand-centre/instagram/media/:mediaId",
  settingsRecovery: "/brand/settings/integrations?tab=instagram",
  b4OwnsDirectAuthenticatedProofRoute: true,
  b4DirectProofOwnsNavigation: false,
  e1OwnsPeerNavigationConvergence: true,
} as const;

export const INSTAGRAM_MANUAL_REFRESH_ACTION_AUTHORITY = {
  authorityVersion: "1.0",
  action: "INSTAGRAM_INTELLIGENCE_MANUAL_REFRESH",
  roles: {
    BRAND_OWNER: "ALLOW",
    CAMPAIGN_MANAGER: "ALLOW",
    FINANCE_ADMIN: "DENY_READ_ONLY",
  },
  parentDecisionDate: "2026-09-10",
  doesNotModifySettingsLifecycleAuthority: true,
  doesNotModifyGenericBrandIntelligenceRefreshAuthority: true,
} as const;

export const INSTAGRAM_HIDDEN_BRAND_LANE_PERSISTENCE_CONTRACT = {
  contractVersion: "1.0",
  sourceScope: "INSTAGRAM_OWNED",
  mode: "GENERATION_ONLY",
  writes: {
    objectGeneration: true,
    componentGeneration: true,
    evidenceReferences: true,
    current: false,
    candidate: false,
    transition: false,
    reconciliation: false,
  },
  latestRead: "LATEST_SUCCESSFUL_BY_EXACT_SOURCE_SCOPE",
  serviceabilitySupported: false,
} as const;

export type InstagramBrandSourceProcessorProfile = {
  readonly processorId: string;
  readonly websiteProcessorVersion: "1.0";
  readonly instagramProcessorVersion: "1.1" | null;
  readonly objectContractVersion: "1.0" | null;
  readonly outputContractVersion: "1.0" | "1.1" | null;
  readonly evidenceContractVersion: "1.0" | "1.1" | null;
  readonly validatorProfileVersion: "1.1" | null;
  readonly sourceScope: "INSTAGRAM_OWNED" | null;
  readonly runPolicy: "RUN" | "RUN_WHEN_EVIDENCE_THRESHOLD_MET" | "EXCLUDED";
  readonly frozenWebsiteBundleMutation: false;
};

/**
 * Contract/version decisions only. D2 adds and registers the new additive
 * bundles/profiles; A2 deliberately does not generate or mutate a bundle.
 */
export const INSTAGRAM_BRAND_SOURCE_PROCESSOR_PROFILES = [
  {
    processorId: "brand_character",
    websiteProcessorVersion: "1.0",
    instagramProcessorVersion: "1.1",
    objectContractVersion: "1.0",
    outputContractVersion: "1.0",
    evidenceContractVersion: "1.0",
    validatorProfileVersion: "1.1",
    sourceScope: "INSTAGRAM_OWNED",
    runPolicy: "RUN",
    frozenWebsiteBundleMutation: false,
  },
  {
    processorId: "brand_communication",
    websiteProcessorVersion: "1.0",
    instagramProcessorVersion: "1.1",
    objectContractVersion: "1.0",
    outputContractVersion: "1.0",
    evidenceContractVersion: "1.0",
    validatorProfileVersion: "1.1",
    sourceScope: "INSTAGRAM_OWNED",
    runPolicy: "RUN",
    frozenWebsiteBundleMutation: false,
  },
  {
    processorId: "audience_persona_synthesis",
    websiteProcessorVersion: "1.0",
    instagramProcessorVersion: "1.1",
    objectContractVersion: "1.0",
    outputContractVersion: "1.0",
    evidenceContractVersion: "1.0",
    validatorProfileVersion: "1.1",
    sourceScope: "INSTAGRAM_OWNED",
    runPolicy: "RUN_WHEN_EVIDENCE_THRESHOLD_MET",
    frozenWebsiteBundleMutation: false,
  },
  {
    processorId: "visual_style_synthesis",
    websiteProcessorVersion: "1.0",
    instagramProcessorVersion: "1.1",
    objectContractVersion: "1.0",
    outputContractVersion: "1.0",
    evidenceContractVersion: "1.0",
    validatorProfileVersion: "1.1",
    sourceScope: "INSTAGRAM_OWNED",
    runPolicy: "RUN",
    frozenWebsiteBundleMutation: false,
  },
  {
    processorId: "brand_meaning",
    websiteProcessorVersion: "1.0",
    instagramProcessorVersion: "1.1",
    objectContractVersion: "1.0",
    outputContractVersion: "1.1",
    evidenceContractVersion: "1.1",
    validatorProfileVersion: "1.1",
    sourceScope: "INSTAGRAM_OWNED",
    runPolicy: "RUN_WHEN_EVIDENCE_THRESHOLD_MET",
    frozenWebsiteBundleMutation: false,
  },
  {
    processorId: "brand_differentiation",
    websiteProcessorVersion: "1.0",
    instagramProcessorVersion: "1.1",
    objectContractVersion: "1.0",
    outputContractVersion: "1.1",
    evidenceContractVersion: "1.1",
    validatorProfileVersion: "1.1",
    sourceScope: "INSTAGRAM_OWNED",
    runPolicy: "RUN_WHEN_EVIDENCE_THRESHOLD_MET",
    frozenWebsiteBundleMutation: false,
  },
  {
    processorId: "serviceability_synthesis",
    websiteProcessorVersion: "1.0",
    instagramProcessorVersion: null,
    objectContractVersion: null,
    outputContractVersion: null,
    evidenceContractVersion: null,
    validatorProfileVersion: null,
    sourceScope: null,
    runPolicy: "EXCLUDED",
    frozenWebsiteBundleMutation: false,
  },
] as const satisfies readonly InstagramBrandSourceProcessorProfile[];

export const INSTAGRAM_CONTRACT_REGISTRY = {
  registryVersion: "1.0",
  algorithmContractVersion: INSTAGRAM_INTELLIGENCE_ALGORITHM_CONTRACT_VERSION,
  objectIds: INSTAGRAM_INTELLIGENCE_OBJECT_IDS,
  dataExtraction: INSTAGRAM_DE_CONTRACT,
  objects: INSTAGRAM_INTELLIGENCE_OBJECT_REGISTRY,
  syncCapabilityClasses: INSTAGRAM_SYNC_CAPABILITY_CLASSES,
  graphMetricContract: INSTAGRAM_GRAPH_METRIC_CONTRACT,
  brandSourceProfiles: INSTAGRAM_BRAND_SOURCE_PROCESSOR_PROFILES,
  manualRefreshAuthority: INSTAGRAM_MANUAL_REFRESH_ACTION_AUTHORITY,
  hiddenBrandLanePersistence: INSTAGRAM_HIDDEN_BRAND_LANE_PERSISTENCE_CONTRACT,
  workspaceRoutes: INSTAGRAM_WORKSPACE_ROUTE_CONTRACT,
} as const;

export function assertUniqueInstagramContractRegistry(): void {
  const assertUnique = (label: string, values: readonly string[]) => {
    if (new Set(values).size !== values.length) {
      throw new Error(`Duplicate ${label} in Instagram contract registry`);
    }
  };
  assertUnique("Object semantic ID", INSTAGRAM_INTELLIGENCE_OBJECT_IDS);
  assertUnique(
    "Object registry semantic ID",
    INSTAGRAM_INTELLIGENCE_OBJECT_REGISTRY.map((entry) => entry.semanticId),
  );
  assertUnique(
    "Brand source processor ID",
    INSTAGRAM_BRAND_SOURCE_PROCESSOR_PROFILES.map((entry) => entry.processorId),
  );
  for (const object of INSTAGRAM_INTELLIGENCE_OBJECT_REGISTRY) {
    assertUnique(`${object.semanticId} component`, object.components);
  }
}
