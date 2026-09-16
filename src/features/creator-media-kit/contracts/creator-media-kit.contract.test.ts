import { describe, expect, it } from "vitest";
import {
  CreatorMediaKitMutationSchema,
  MEDIA_KIT_CTA_BOUNDARY,
  MEDIA_KIT_LEGACY_CUTOVER,
  MEDIA_KIT_ROLE_POLICY,
  MediaKitPublicShellSchema,
  normalizeMediaKitHttpsUrl,
} from "./creator-media-kit.contract";

describe("Creator Media Kit V3 executable authority", () => {
  it("freezes role actions and the terminal CTA boundary", () => {
    expect(MEDIA_KIT_ROLE_POLICY.OWNER).toMatchObject({
      read: true,
      manage: true,
      publish: true,
      pdf: true,
    });
    expect(MEDIA_KIT_ROLE_POLICY.MANAGER).toEqual(MEDIA_KIT_ROLE_POLICY.OWNER);
    expect(MEDIA_KIT_ROLE_POLICY.ASSISTANT).toMatchObject({
      read: true,
      preview: true,
      manage: false,
      publish: false,
      pdf: false,
    });
    expect(MEDIA_KIT_CTA_BOUNDARY).toMatchObject({
      workWithCreatorTerminatesAtClick: true,
      createsEnquiry: false,
      createsCampaign: false,
      createsCollaboration: false,
      triggersIntelligence: false,
    });
  });

  it("never carries legacy public state into V3 LIVE", () => {
    expect(MEDIA_KIT_LEGACY_CUTOVER).toEqual({
      legacyPublicFlagAuthoritative: false,
      legacyPublicFlagMigratedToLive: false,
      newAggregateLifecycle: "DRAFT",
      legacyPublicRouteRequiresV3LiveAggregate: true,
    });
  });

  it("rejects unbounded, duplicate and ephemeral selections", () => {
    const base = {
      intent: "UPDATE_CONFIGURATION",
      expectedRevision: 0,
      idempotencyKey: "38f0e2df-259e-4c62-9de3-0bbcf4b2e0d1",
      visibility: {
        audience: true,
        content: true,
        portfolio: true,
        rateCard: true,
      },
      publicVisuals: [],
      featuredPortfolioItemIds: [],
    };
    expect(
      CreatorMediaKitMutationSchema.safeParse({
        ...base,
        publicVisuals: Array.from({ length: 4 }, (_, index) => ({
          visualId: `v-${index}`,
          sourceDestination: `https://example.com/source/${index}`,
          staticAssetUrl: null,
          altText: "Creator work",
        })),
      }).success,
    ).toBe(false);
    expect(() =>
      normalizeMediaKitHttpsUrl("https://cdn.example.com/a.jpg?token=secret"),
    ).toThrow("MEDIA_KIT_EPHEMERAL_URL");
  });

  it("keeps the anonymous shell strictly minimized", () => {
    const value = MediaKitPublicShellSchema.parse({
      contractVersion: "creator-media-kit-public-v3.1",
      publicId: "abc123abc123abc123abc123",
      lifecycle: "LIVE",
      identity: {
        name: "Ava",
        avatarUrl: null,
        instagramHandle: "ava",
        headline: null,
        bio: null,
        niches: [],
        visualStyle: [],
      },
      visuals: [],
      callsToAction: [
        {
          action: "WORK_WITH_CREATOR",
          label: "Work with Creator",
          subtext: "Start a collaboration",
        },
        {
          action: "REVEAL_EMAIL_ID",
          label: "Reveal Email ID",
          subtext: "Agencies and email enquiries",
        },
      ],
    });
    expect(value).not.toHaveProperty("audience");
    expect(value).not.toHaveProperty("portfolio");
    expect(value).not.toHaveProperty("rateCard");
    expect(value).not.toHaveProperty("email");
    expect(
      MediaKitPublicShellSchema.safeParse({ ...value, secret: "no" }).success,
    ).toBe(false);
  });
});
