import "reflect-metadata";
import { HEADERS_METADATA } from "@nestjs/common/constants";
import type { CreatorProfile, UceCampaignTargeting } from "@prisma/client";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  CampaignOpportunityController,
  CreatorOpportunitiesController,
} from "./campaign-opportunity.controller";
import { CampaignOpportunityPolicyService } from "./campaign-opportunity-policy.service";
import { evaluateCanonicalEligibility } from "./campaign-opportunity-eligibility";
import {
  normalizeCampaignAttribution,
  CampaignIngressService,
} from "./campaign-ingress.service";
import { evaluateInstagramOpportunity } from "../../shared/creator/instagram-opportunity-capability";
import type { CampaignOpportunityService } from "./campaign-opportunity.service";

describe("C03 transport and dependency contracts", () => {
  it.each([
    CampaignOpportunityController.prototype.detail,
    CampaignOpportunityController.prototype.continuation,
    CreatorOpportunitiesController.prototype.collection,
  ])("marks route %# private/no-store and varying by identity", (method) => {
    const headers = Reflect.getMetadata(HEADERS_METADATA, method);
    expect(headers).toContainEqual({
      name: "Cache-Control",
      value: "private, no-store",
    });
    expect(headers).toContainEqual({
      name: "Vary",
      value: "Authorization, Cookie",
    });
  });
  it("serializes a generic unknown response with structurally absent dossiers", async () => {
    const projection = new CampaignOpportunityPolicyService().evaluate({
      campaign: null,
      actor: null,
      now: new Date(),
      requestClass: "ANONYMOUS",
      instagram: evaluateInstagramOpportunity(null, new Date()),
      invitation: "ABSENT",
      eligibility: {
        result: "UNAVAILABLE",
        targetingVersion: null,
        creatorFactsVersion: null,
      },
      applicationBlockedReason: null,
    });
    const controller = new CampaignOpportunityController({
      detail: vi.fn().mockResolvedValue(projection),
    } as unknown as CampaignOpportunityService);
    const raw = JSON.stringify(await controller.detail("unknown", {} as never));
    expect(JSON.parse(raw)).toEqual({
      schemaVersion: 1,
      state: "LOCKED",
      reason: "OPPORTUNITY_NOT_AVAILABLE",
      recoveryAction: null,
    });
    expect(raw).not.toMatch(
      /commercial|brief|provider|targeting|token|digest|integration|invitation/i,
    );
  });
  it("never returns an ephemeral continuation credential in JSON", async () => {
    const token = "t".repeat(43);
    const controller = new CampaignOpportunityController({
      issue: vi.fn().mockResolvedValue({
        intent: "CAMPAIGN_APPLY",
        continuationToken: token,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    } as unknown as CampaignOpportunityService);
    const cookie = vi.fn();
    const result = await controller.continuation("campaign", {} as never, {}, {
      cookie,
    } as never);
    expect(JSON.stringify(result)).not.toContain(token);
    expect(cookie).toHaveBeenCalledWith(
      "tcs_creator_apply_continuation",
      token,
      expect.objectContaining({ httpOnly: true, sameSite: "lax" }),
    );
  });
  it("normalizes only frozen ingress fields", () => {
    expect(
      normalizeCampaignAttribution({
        utm_source: "  Ａ\u0000Ｂ  ",
        utm_term: "x".repeat(250),
        invitationCredential: "discard",
        internal: "discard",
      }),
    ).toEqual({ utm_source: "AB", utm_term: "x".repeat(200) });
  });
  it("does not block continuation on analytics persistence failure", async () => {
    const service = new CampaignIngressService({
      campaignIngressTouch: {
        create: vi.fn().mockRejectedValue(new Error("fixture")),
      },
    } as never);
    await expect(
      service.capture(
        "campaign",
        {
          schemaVersion: 1,
          entrySurface: "DIRECT_CAMPAIGN_LINK",
          entryAuthority: { kind: "DIRECT" },
        },
        {},
        null,
        new Date(),
      ),
    ).resolves.toBeUndefined();
  });
  it("keeps credentials and provider calls outside the policy and HMAC helper", () => {
    for (const file of [
      "invitation-identity.ts",
      "campaign-opportunity-policy.service.ts",
      "campaign-opportunity-eligibility.ts",
    ]) {
      const source = readFileSync(
        `src/features/campaign-opportunities/${file}`,
        "utf8",
      );
      expect(source).not.toMatch(
        /AUTH_OTP_PEPPER|JWT_SECRET|APP_SECRET|RAZORPAY|createHash|fetch\(|axios|console\.|\.log\(/,
      );
    }
  });
});

describe("C03 canonical eligibility", () => {
  const target = {
    targetingVersion: 4,
    creatorArchetypes: [],
    disqualifyingKeywords: [],
    audienceAgeMin: 18,
    audienceAgeMax: 65,
    audienceGender: "ALL",
    followerTiers: [],
    targetLocations: [],
  } as unknown as UceCampaignTargeting;
  const facts = {
    followerCount: 15000,
    primaryRegion: "IN",
    audienceDemographicsMatrix: { top_countries: { IN: 0.8 } },
    updatedAt: new Date("2030-01-01"),
  } as unknown as CreatorProfile;
  it("preserves the canonical versions and never uses a QA email or score", () => {
    expect(evaluateCanonicalEligibility(target, facts)).toEqual({
      result: "ELIGIBLE",
      targetingVersion: 4,
      creatorFactsVersion: "2030-01-01T00:00:00.000Z",
    });
    expect(
      evaluateCanonicalEligibility(
        { ...target, followerTiers: ["MEGA"] },
        facts,
      ).result,
    ).toBe("INELIGIBLE");
  });
  it("fails closed on absent facts and unsupported evidence", () => {
    expect(evaluateCanonicalEligibility(target, null).result).toBe(
      "UNAVAILABLE",
    );
    expect(
      evaluateCanonicalEligibility(
        { ...target, creatorArchetypes: ["expert"] },
        facts,
      ).result,
    ).toBe("UNAVAILABLE");
    expect(
      evaluateCanonicalEligibility(
        { ...target, targetLocations: ["IN"] },
        { ...facts, audienceDemographicsMatrix: {} },
      ).result,
    ).toBe("UNAVAILABLE");
  });
  it("evaluates canonical geography instead of discovery scores", () => {
    expect(
      evaluateCanonicalEligibility(
        { ...target, targetLocations: ["IN"] },
        facts,
      ).result,
    ).toBe("ELIGIBLE");
    expect(
      evaluateCanonicalEligibility(
        { ...target, targetLocations: ["US"] },
        facts,
      ).result,
    ).toBe("INELIGIBLE");
  });
});
