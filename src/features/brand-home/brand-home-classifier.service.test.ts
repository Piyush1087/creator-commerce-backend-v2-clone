import { describe, expect, it } from "vitest";

import type { IntelligenceConsumerResult } from "../intelligence-consumer/intelligence-consumer.contract";
import { BrandHomeClassifierService } from "./brand-home-classifier.service";

const now = "2026-09-03T06:00:00.000Z";
const classifier = new BrandHomeClassifierService();

function intelligence(
  objectId: string,
  changedAt: string,
  freshness: "CURRENT" | "STALE" = "CURRENT",
): IntelligenceConsumerResult {
  return {
    contractVersion: "1.0",
    engineId: objectId.startsWith("offering_")
      ? "product_intelligence"
      : "brand_intelligence",
    subject: objectId.startsWith("offering_")
      ? { type: "OFFERING", id: "offering-1" }
      : { type: "BRAND", id: "brand-1" },
    objects: [
      {
        objectId,
        objectState: "CURRENT",
        current: { kind: "VALUE", resultRef: `result:${objectId}` },
        readiness: "READY",
        resultReadiness: "READY",
        freshness,
        changedAt,
        authority: "creator_shop",
      },
    ],
    capabilityAvailability: { status: "AVAILABLE" },
    domainPayloadVersion: "1.0",
    domainPayload: {},
  };
}

describe("Brand Home deterministic classification", () => {
  it("classifies an overdue Brand-owned Collaboration as time-sensitive attention", () => {
    const items = classifier.collaboration(
      {
        collaborationId: "collaboration-1",
        campaign: { id: "campaign-1", name: "Summer Launch" },
        brief: { id: "brief-1", title: "Launch brief" },
        lifecycle: {
          stage: "CONTENT_SUBMISSION",
          status: "ACTIVE_WORKFLOW",
          phase: "PRODUCTION",
          paused: false,
          terminated: false,
        },
        attention: {
          health: "ACTION_OVERDUE",
          actionRequiredBy: "BRAND",
          reasonCodes: ["ACTION_OVERDUE", "BRAND_ACTION_REQUIRED"],
          dueAt: "2026-09-02T06:00:00.000Z",
        },
        stageUpdatedAt: "2026-09-02T05:00:00.000Z",
        updatedAt: "2026-09-02T05:30:00.000Z",
      },
      now,
    );
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sectionId: "NEEDS_ATTENTION",
          reasonCode: "COLLABORATION_ACTION_OVERDUE",
          priorityTier: "DEADLINE_SLA_TIME_SENSITIVE",
          navigation: expect.objectContaining({
            destinationId: "COLLABORATIONS",
          }),
        }),
      ]),
    );
  });

  it("shows a material provider recovery blocker but ignores a ready provider", () => {
    const base = {
      observedAt: now,
      providers: [
        {
          provider: "INSTAGRAM",
          state: "ACTION_REQUIRED",
          reasonCode: "INSTAGRAM_REVALIDATION_REQUIRED",
          affectedProductCapabilities: ["INSIGHTS"],
          humanActionRequired: true,
        },
      ],
    };
    expect(classifier.provider(base, "brand-1", now)[0]).toMatchObject({
      kind: "PROVIDER_RECOVERY",
      priorityTier: "MATERIAL_SETUP_CAPABILITY_BLOCKER",
      navigation: { destinationId: "SETTINGS_INTEGRATIONS" },
    });
    expect(
      classifier.provider(
        {
          ...base,
          providers: [
            {
              ...base.providers[0],
              state: "READY",
              humanActionRequired: false,
            },
          ],
        },
        "brand-1",
        now,
      ),
    ).toEqual([]);
  });

  it("does not promote routine partial workspace setup alongside a material blocker", () => {
    const items = classifier.workspace(
      {
        observedAt: now,
        workspace: { state: "ACTION_REQUIRED" },
        setupItems: [
          {
            reasonCode: "BRAND_WORKSPACE_PARTIAL",
            title: "Complete optional Brand details",
            destinationId: "BRAND_CENTRE",
          },
          {
            reasonCode: "BILLING_PROFILE_INCOMPLETE",
            title: "Complete billing profile",
            destinationId: "SETTINGS_BILLING",
          },
        ],
      },
      "brand-1",
      now,
    );

    expect(items.map((item) => item.reasonCode)).toEqual([
      "BILLING_PROFILE_INCOMPLETE",
    ]);
  });

  it("classifies current Brand Intelligence with canonical changedAt", () => {
    expect(
      classifier.brandIntelligence(
        intelligence("differentiation_and_proof", "2026-09-03T04:00:00.000Z"),
        "brand-1",
        now,
      )[0],
    ).toMatchObject({
      sectionId: "CREATOR_SHOP_HAS_LEARNED",
      freshness: { changedAt: "2026-09-03T04:00:00.000Z" },
    });
  });

  it("classifies only current active Offering actionability as an opportunity", () => {
    const items = classifier.offeringOpportunity(
      { offeringId: "offering-1", name: "Serum", lifecycle: "ACTIVE" },
      intelligence(
        "offering_actionability_profile",
        "2026-09-03T04:30:00.000Z",
      ),
      now,
    );
    expect(items[0]).toMatchObject({
      sectionId: "OPPORTUNITIES_NEXT_ACTIONS",
      priorityTier: "MATERIAL_OPPORTUNITY",
      navigation: { destinationId: "OFFERINGS" },
      recommendation: { nonMutating: true },
    });
    expect(
      classifier.offeringOpportunity(
        { offeringId: "offering-1", name: "Serum", lifecycle: "ACTIVE" },
        intelligence(
          "offering_actionability_profile",
          "2026-09-03T04:30:00.000Z",
          "STALE",
        ),
        now,
      ),
    ).toEqual([]);
  });

  it("classifies only LIVE Campaigns as momentum", () => {
    const live = classifier.campaign(
      {
        campaignId: "campaign-1",
        name: "Momentum",
        status: "LIVE",
        updatedAt: "2026-09-03T05:00:00.000Z",
      },
      now,
    );
    expect(live[0]).toMatchObject({
      sectionId: "CURRENT_MOMENTUM",
      freshness: { changedAt: "2026-09-03T05:00:00.000Z" },
    });
    expect(
      classifier.campaign(
        {
          campaignId: "campaign-2",
          name: "Draft",
          status: "DRAFT",
          updatedAt: now,
        },
        now,
      ),
    ).toEqual([]);
  });
});
