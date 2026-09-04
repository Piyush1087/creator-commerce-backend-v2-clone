import { BadRequestException } from "@nestjs/common";
import { UceCampaignStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { CanonicalCampaignCreateService } from "./canonical-campaign-create.service";
import {
  canonicalDerivedProjection,
  resolveCanonicalCampaignReadiness,
} from "./canonical-campaign-readiness.resolver";

const payload = {
  strategy: {
    campaign_name: "Summer Collection",
    publishing_schedule: "EVERGREEN",
    publish_from: null,
    publish_until: null,
    core_objective: "PULSE",
    platforms: ["INSTAGRAM"],
    campaign_visibility: "PUBLIC",
  },
  targeting: {
    creator_archetypes: ["EDUCATOR"],
    minimum_followers: 20_000,
    maximum_followers: 250_000,
    audience_age_min: 24,
    audience_age_max: 34,
    audience_gender: "FEMALE",
    audience_affinity_ids: ["SKINCARE"],
    audience_geographies: [
      {
        scope: "COUNTRY",
        label: "India",
        country_code: "IN",
        locality: null,
        region: null,
        radius_km: null,
        is_primary: true,
      },
    ],
  },
  commercials: {
    receives_brand_support: true,
    brand_support_type: "PRODUCT",
    brand_support_estimated_value: 1_299,
    compensation_model: "FIXED",
    commercial_offer: 25_000,
    total_campaign_budget: 500_000,
    advance_payment_percentage: 25,
    payout_terms: "NET_15",
  },
};

function setup(industry = "D2C") {
  const tx = {
    uceCampaign: {
      findFirst: vi.fn().mockResolvedValue({ status: UceCampaignStatus.DRAFT }),
      update: vi.fn().mockResolvedValue({}),
    },
    uceCampaignReportingSnapshot: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    uceCampaign: {
      findFirst: vi.fn().mockResolvedValue({
        id: "campaign-1",
        status: UceCampaignStatus.DRAFT,
      }),
    },
    brandProfile: {
      findUnique: vi.fn().mockResolvedValue({
        id: "brand-1",
        countryCode: "IN",
        industry,
      }),
    },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const legacy = {
    getCampaignShell: vi.fn().mockResolvedValue({ id: "campaign-1" }),
  };

  return {
    prisma,
    tx,
    service: new CanonicalCampaignCreateService(
      prisma as never,
      legacy as never,
      { lockCampaign: vi.fn().mockResolvedValue(undefined) } as never,
    ),
  };
}

describe("CanonicalCampaignCreateService publication readiness integration", () => {
  it("persists the exact projection returned by the shared resolver", async () => {
    const { service, tx } = setup();
    const readiness = resolveCanonicalCampaignReadiness("PULSE", "D2C", "IN");
    if (readiness.status !== "READY") throw new Error("fixture must be ready");

    await service.publishDraft("brand-1", "campaign-1", payload);

    const update = tx.uceCampaign.update.mock.calls[0][0] as {
      data: { canonicalDefinition: { derived: unknown } };
    };
    const canonicalDefinition = update.data.canonicalDefinition;
    expect(canonicalDefinition.derived).toEqual(
      canonicalDerivedProjection(readiness),
    );
    expect(tx.uceCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: UceCampaignStatus.PUBLISHED }),
      }),
    );
  });

  it("retains publication failure when supporting KPI configuration is unavailable", async () => {
    const { service, prisma } = setup("UNKNOWN");

    await expect(
      service.publishDraft("brand-1", "campaign-1", payload),
    ).rejects.toEqual(
      new BadRequestException(
        "Supporting KPI resolution is unavailable for this Brand industry.",
      ),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
