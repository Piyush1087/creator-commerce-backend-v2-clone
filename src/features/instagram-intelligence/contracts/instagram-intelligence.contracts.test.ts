import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DATA_EXTRACTION_EVIDENCE_CAPABILITIES,
  WAVE1_EVIDENCE_CAPABILITIES,
} from "../../data-extraction/evidence/domain/evidence-vocabulary";
import {
  INSTAGRAM_INTELLIGENCE_REASON_CODES,
  INSTAGRAM_INTELLIGENCE_V1_CONSTANTS,
} from "./instagram-intelligence.constants";
import {
  assertUniqueInstagramContractRegistry,
  INSTAGRAM_BRAND_SOURCE_PROCESSOR_PROFILES,
  INSTAGRAM_DE_CONTRACT,
  INSTAGRAM_GRAPH_METRIC_CONTRACT,
  INSTAGRAM_HIDDEN_BRAND_LANE_PERSISTENCE_CONTRACT,
  INSTAGRAM_INTELLIGENCE_OBJECT_IDS,
  INSTAGRAM_INTELLIGENCE_OBJECT_REGISTRY,
  INSTAGRAM_MANUAL_REFRESH_ACTION_AUTHORITY,
  INSTAGRAM_WORKSPACE_ROUTE_CONTRACT,
} from "./instagram-intelligence.registry";
import {
  InstagramLikelyCollabSchema,
  InstagramMediaObservationSchema,
  InstagramObservedMetricSchema,
  InstagramSignalSchema,
  InstagramSourceValueSchema,
  InstagramSyncStateContractSchema,
  InstagramWorkspaceConsumerSchema,
} from "./instagram-intelligence.schemas";

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(join(__dirname, "fixtures", name), "utf8"),
  ) as unknown;
}

describe("Instagram Intelligence V1 contract registry", () => {
  it("adds exact Instagram DE semantics without changing the website Wave 1 vocabulary", () => {
    expect(WAVE1_EVIDENCE_CAPABILITIES).toEqual([
      "owned_website.brand_messaging",
      "owned_website.brand_company_context",
      "owned_website.offering_context",
      "observed_brand_communication_language_signals",
      "derived_communication_constraint_evidence",
    ]);
    expect(INSTAGRAM_DE_CONTRACT).toEqual({
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
    });
    expect(DATA_EXTRACTION_EVIDENCE_CAPABILITIES).toEqual(
      expect.arrayContaining(INSTAGRAM_DE_CONTRACT.capabilities),
    );
  });

  it("registers exactly three unique Objects with unique components", () => {
    expect(assertUniqueInstagramContractRegistry).not.toThrow();
    expect(INSTAGRAM_INTELLIGENCE_OBJECT_IDS).toEqual([
      "instagram_content_behavior",
      "instagram_audience_profile",
      "instagram_organic_performance_profile",
    ]);
    expect(INSTAGRAM_INTELLIGENCE_OBJECT_REGISTRY).toHaveLength(3);
  });

  it("classifies caps and thresholds as one versioned V1 constant set", () => {
    expect(INSTAGRAM_INTELLIGENCE_V1_CONSTANTS).toMatchObject({
      analysisWindowDays: 30,
      inventoryHardCap: 500,
      deepMultimodalPostCap: 24,
      manualRefreshCooldownMinutes: 15,
      minimumSignalSample: 3,
      minimumMetricCoveragePercent: 50,
    });
  });

  it("freezes the Parent-authorized Instagram refresh action without changing other actions", () => {
    expect(INSTAGRAM_MANUAL_REFRESH_ACTION_AUTHORITY.roles).toEqual({
      BRAND_OWNER: "ALLOW",
      CAMPAIGN_MANAGER: "ALLOW",
      FINANCE_ADMIN: "DENY_READ_ONLY",
    });
    expect(
      INSTAGRAM_MANUAL_REFRESH_ACTION_AUTHORITY.doesNotModifySettingsLifecycleAuthority,
    ).toBe(true);
    expect(
      INSTAGRAM_MANUAL_REFRESH_ACTION_AUTHORITY.doesNotModifyGenericBrandIntelligenceRefreshAuthority,
    ).toBe(true);
  });

  it("records the B4 direct-proof/E1 navigation ownership split", () => {
    expect(INSTAGRAM_WORKSPACE_ROUTE_CONTRACT).toMatchObject({
      b4OwnsDirectAuthenticatedProofRoute: true,
      b4DirectProofOwnsNavigation: false,
      e1OwnsPeerNavigationConvergence: true,
    });
  });

  it("pins the B2 provider-verified v26 metric and audience allowlists", () => {
    expect(INSTAGRAM_GRAPH_METRIC_CONTRACT).toEqual({
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
    });
  });

  it("freezes the hidden Brand lane as source-scoped generation-only persistence", () => {
    expect(INSTAGRAM_HIDDEN_BRAND_LANE_PERSISTENCE_CONTRACT).toEqual({
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
    });
  });
});

describe("Instagram truth and null semantics", () => {
  it("parses the media fixture and preserves observed zero separately from unavailable", () => {
    const parsed = InstagramMediaObservationSchema.parse(
      fixture("instagram-media-observation.ready.json"),
    );
    expect(parsed.metrics[0]).toMatchObject({
      availability: "OBSERVED_ZERO",
      value: 0,
    });
    expect(parsed.metrics[1]).toEqual({
      availability: "UNAVAILABLE",
      metricId: "shares",
      reasonCode: "METRIC_NOT_RETURNED",
      evidenceRefs: [],
    });
    expect("value" in parsed.metrics[1]).toBe(false);
  });

  it("rejects lossy unavailable metrics and reasonless unknowns", () => {
    expect(
      InstagramObservedMetricSchema.safeParse({
        availability: "UNAVAILABLE",
        metricId: "reach",
        value: 0,
        reasonCode: "METRIC_NOT_RETURNED",
        evidenceRefs: [],
      }).success,
    ).toBe(false);
    expect(
      InstagramSourceValueSchema.safeParse({ state: "UNKNOWN" }).success,
    ).toBe(false);
  });

  it("rejects null/undefined AVAILABLE payloads and positive metrics labelled as zero", () => {
    expect(
      InstagramSourceValueSchema.safeParse({
        state: "AVAILABLE",
        value: null,
      }).success,
    ).toBe(false);
    expect(
      InstagramSourceValueSchema.safeParse({
        state: "AVAILABLE",
        value: undefined,
      }).success,
    ).toBe(false);
    expect(
      InstagramObservedMetricSchema.safeParse({
        availability: "OBSERVED_ZERO",
        metricId: "reach",
        value: 1,
        unit: "COUNT",
        denominator: {
          state: "INTENTIONALLY_ABSENT",
          reasonCode: "INTENTIONAL_ABSENCE",
        },
        evidenceRefs: ["evidence:1"],
      }).success,
    ).toBe(false);
  });

  it("rejects uninspected negative collaboration conclusions", () => {
    expect(
      InstagramLikelyCollabSchema.safeParse({
        state: "NO_COLLAB_SIGNAL",
        confidence: "LOW",
        signalClasses: [],
        canonicalCreatorId: null,
        canonicalCollaborationId: null,
        reasonCodes: ["NOT_INSPECTED"],
        evidenceRefs: [],
        negativeEvidence: {
          captionInspected: false,
          requiredSelectedMediaInspected: false,
        },
      }).success,
    ).toBe(false);
  });

  it("enforces high-confidence and multi-signal likely-collab rules", () => {
    const base = {
      canonicalCreatorId: null,
      canonicalCreatorMatch: "NONE",
      canonicalCollaborationId: null,
      canonicalCollaborationMatch: "NONE",
      reasonCodes: [] as string[],
      evidenceRefs: ["evidence:1"],
      negativeEvidence: {
        captionInspected: true,
        requiredSelectedMediaInspected: true,
      },
    };
    expect(
      InstagramLikelyCollabSchema.safeParse({
        ...base,
        state: "LIKELY_COLLAB",
        confidence: "HIGH",
        signalClasses: ["EXPLICIT_CAPTION_COLLAB_LANGUAGE"],
      }).success,
    ).toBe(false);
    expect(
      InstagramLikelyCollabSchema.safeParse({
        ...base,
        state: "LIKELY_COLLAB",
        confidence: "MEDIUM",
        signalClasses: [
          "EXPLICIT_CAPTION_COLLAB_LANGUAGE",
          "JOINT_BRAND_CREATOR_APPEARANCE",
        ],
      }).success,
    ).toBe(true);
    expect(
      InstagramLikelyCollabSchema.safeParse({
        ...base,
        state: "LIKELY_COLLAB",
        confidence: "HIGH",
        signalClasses: ["PROVIDER_COLLABORATOR_RELATION"],
      }).success,
    ).toBe(true);
  });

  it("requires explicit exact-preexisting match state for canonical IDs", () => {
    const media = fixture("instagram-media-observation.ready.json") as {
      offeringPresence: Record<string, unknown>;
      likelyCollab: Record<string, unknown>;
    };
    media.offeringPresence.canonicalOfferingMatch = "NONE";
    expect(InstagramMediaObservationSchema.safeParse(media).success).toBe(
      false,
    );

    const linked = fixture("instagram-media-observation.ready.json") as {
      likelyCollab: Record<string, unknown>;
    };
    linked.likelyCollab.canonicalCreatorId =
      "44444444-4444-4444-8444-444444444444";
    linked.likelyCollab.canonicalCreatorMatch = "NONE";
    expect(InstagramMediaObservationSchema.safeParse(linked).success).toBe(
      false,
    );
  });

  it("rejects possible collaboration without evidence and unknown with positive signals", () => {
    const base = {
      confidence: "LOW",
      canonicalCreatorId: null,
      canonicalCreatorMatch: "NONE",
      canonicalCollaborationId: null,
      canonicalCollaborationMatch: "NONE",
      evidenceRefs: ["evidence:1"],
      negativeEvidence: {
        captionInspected: false,
        requiredSelectedMediaInspected: false,
      },
    };
    expect(
      InstagramLikelyCollabSchema.safeParse({
        ...base,
        state: "POSSIBLE_COLLAB",
        signalClasses: [],
        reasonCodes: [],
      }).success,
    ).toBe(false);
    expect(
      InstagramLikelyCollabSchema.safeParse({
        ...base,
        state: "UNKNOWN",
        confidence: null,
        signalClasses: ["MENTION_ONLY"],
        reasonCodes: ["NOT_INSPECTED"],
      }).success,
    ).toBe(false);
  });

  it("enforces V1 signal and medium-confidence thresholds", () => {
    const base = {
      kind: "SIGNAL",
      semanticId: "format-response",
      statement: "Reels repeatedly received more reach in this window.",
      confidence: "MEDIUM",
      sampleSize: 5,
      comparisonCohortSizes: [3, 3],
      metricCoveragePercent: 70,
      publicationDateCount: 2,
      evidenceRefs: ["evidence:signal:1"],
    };
    expect(InstagramSignalSchema.safeParse(base).success).toBe(true);
    expect(
      InstagramSignalSchema.safeParse({ ...base, sampleSize: 4 }).success,
    ).toBe(false);
    expect(
      InstagramSignalSchema.safeParse({
        ...base,
        confidence: "LOW",
        sampleSize: 3,
        metricCoveragePercent: 50,
        publicationDateCount: 1,
      }).success,
    ).toBe(true);
  });

  it("parses the generation-fenced sync-state contract", () => {
    expect(
      InstagramSyncStateContractSchema.parse({
        contractVersion: "1.0",
        brandProfileId: "22222222-2222-4222-8222-222222222222",
        integrationId: "33333333-3333-4333-8333-333333333333",
        providerAccountId: "ig-account-1",
        authorizationGeneration: 2,
        capabilityClass: "PROFILE_MEDIA_PERFORMANCE",
        status: "BACKOFF",
        trigger: "SCHEDULED",
        lastAttemptAt: "2026-09-10T08:00:00.000Z",
        lastSuccessAt: "2026-09-09T08:00:00.000Z",
        nextDueAt: "2026-09-10T09:00:00.000Z",
        backoffUntil: "2026-09-10T08:15:00.000Z",
        cursor: "cursor-1",
        leaseToken: null,
        leaseExpiresAt: null,
        attemptCount: 2,
        consecutiveFailures: 1,
        lastCompletedGenerationIds: ["generation:1"],
        reasonCodes: ["PROVIDER_TRANSIENT_FAILURE"],
      }).authorizationGeneration,
    ).toBe(2);
  });

  it("rejects unregistered Object component keys", () => {
    const value = fixture("instagram-workspace.partial.json") as {
      objects: Array<{ components: Record<string, unknown> }>;
    };
    value.objects[0].components.pipeline_debug = {
      state: "AVAILABLE",
      value: "must not leak",
    };
    expect(InstagramWorkspaceConsumerSchema.safeParse(value).success).toBe(
      false,
    );
  });

  it("requires explicit absence/value state for every registered Object component", () => {
    const value = fixture("instagram-workspace.partial.json") as {
      objects: Array<{ components: Record<string, unknown> }>;
    };
    delete value.objects[0].components.window;
    expect(InstagramWorkspaceConsumerSchema.safeParse(value).success).toBe(
      false,
    );
  });

  it("parses stale preserved current and exact intentional absence", () => {
    const parsed = InstagramWorkspaceConsumerSchema.parse(
      fixture("instagram-workspace.partial.json"),
    );
    expect(parsed.sync).toMatchObject({
      currentPreserved: true,
      state: "BLOCKED",
    });
    expect(parsed.objects[1].components.follower_audience).toEqual({
      state: "INTENTIONALLY_ABSENT",
      reasonCode: "AUDIENCE_PRIVACY_SUPPRESSED",
    });
  });

  it("rejects duplicate/missing Objects and hidden Brand-lane fields", () => {
    const value = fixture("instagram-workspace.partial.json") as {
      objects: unknown[];
      hiddenBrandSemantics?: unknown;
    };
    value.objects[2] = value.objects[0];
    expect(InstagramWorkspaceConsumerSchema.safeParse(value).success).toBe(
      false,
    );

    const hidden = fixture("instagram-workspace.partial.json") as Record<
      string,
      unknown
    >;
    hidden.hiddenBrandSemantics = [];
    expect(InstagramWorkspaceConsumerSchema.safeParse(hidden).success).toBe(
      false,
    );
  });
});

describe("Instagram-owned Brand processor compatibility", () => {
  it("implements the minimum version map and leaves every website profile at 1.0", () => {
    expect(
      INSTAGRAM_BRAND_SOURCE_PROCESSOR_PROFILES.every(
        (profile) =>
          profile.websiteProcessorVersion === "1.0" &&
          profile.frozenWebsiteBundleMutation === false,
      ),
    ).toBe(true);

    for (const processorId of [
      "brand_character",
      "brand_communication",
      "audience_persona_synthesis",
      "visual_style_synthesis",
    ]) {
      expect(
        INSTAGRAM_BRAND_SOURCE_PROCESSOR_PROFILES.find(
          (profile) => profile.processorId === processorId,
        ),
      ).toMatchObject({
        objectContractVersion: "1.0",
        outputContractVersion: "1.0",
        evidenceContractVersion: "1.0",
        instagramProcessorVersion: "1.1",
        sourceScope: "INSTAGRAM_OWNED",
      });
    }

    for (const processorId of ["brand_meaning", "brand_differentiation"]) {
      expect(
        INSTAGRAM_BRAND_SOURCE_PROCESSOR_PROFILES.find(
          (profile) => profile.processorId === processorId,
        ),
      ).toMatchObject({
        objectContractVersion: "1.0",
        outputContractVersion: "1.1",
        evidenceContractVersion: "1.1",
        instagramProcessorVersion: "1.1",
        sourceScope: "INSTAGRAM_OWNED",
      });
    }
  });

  it("excludes serviceability and matches the machine-readable snapshot", () => {
    expect(
      INSTAGRAM_BRAND_SOURCE_PROCESSOR_PROFILES.find(
        (profile) => profile.processorId === "serviceability_synthesis",
      ),
    ).toMatchObject({
      runPolicy: "EXCLUDED",
      instagramProcessorVersion: null,
      sourceScope: null,
    });

    const snapshot = fixture("instagram-contract-registry.snapshot.json") as {
      objectIds: string[];
      manualRefreshRoles: Record<string, string>;
      brandSourceProfiles: [
        string,
        string | null,
        string | null,
        string | null,
        string,
      ][];
    };
    expect(snapshot.objectIds).toEqual(INSTAGRAM_INTELLIGENCE_OBJECT_IDS);
    expect(snapshot.manualRefreshRoles).toEqual(
      INSTAGRAM_MANUAL_REFRESH_ACTION_AUTHORITY.roles,
    );
    expect(snapshot.brandSourceProfiles).toEqual(
      INSTAGRAM_BRAND_SOURCE_PROCESSOR_PROFILES.map((profile) => [
        profile.processorId,
        profile.objectContractVersion,
        profile.outputContractVersion,
        profile.evidenceContractVersion,
        profile.runPolicy,
      ]),
    );
  });

  it("keeps every reason code unique", () => {
    expect(new Set(INSTAGRAM_INTELLIGENCE_REASON_CODES).size).toBe(
      INSTAGRAM_INTELLIGENCE_REASON_CODES.length,
    );
  });
});
