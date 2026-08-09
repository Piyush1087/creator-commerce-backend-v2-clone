import { describe, expect, it } from "vitest";
import {
  campaignStep1CompletionSchema,
  campaignStep2CompletionSchema,
  campaignStep3CompletionSchema,
  createCampaignDraftInputSchema,
  updateLiveCampaignInputSchema,
} from "./campaign.schema";

const validStrategy = {
  publishingSchedule: "SCHEDULED" as const,
  publishFrom: new Date("2030-01-01T00:00:00.000Z"),
  publishUntil: new Date("2030-01-31T00:00:00.000Z"),
  coreObjective: "PULSE" as const,
  platforms: ["INSTAGRAM"] as const,
  campaignVisibility: "PUBLIC" as const,
};

const validTargeting = {
  creatorArchetypes: ["ARCHETYPE_1"],
  minimumFollowers: 20_000,
  maximumFollowers: 100_000,
  audienceAgeMin: 18,
  audienceAgeMax: 34,
  audienceGender: "ALL" as const,
  audienceAffinityIds: ["AFFINITY_1"],
  audienceGeographies: [{ scope: "COUNTRY", placeId: "india" }],
};

const validCommercials = {
  receivesBrandSupport: false,
  compensationModel: "FIXED" as const,
  commercialOffer: 10_000,
  totalCampaignBudget: 100_000,
  advancePaymentPercentage: 25 as const,
  payoutTerms: "NET_30" as const,
};

describe("Campaign definition Phase 1D validation", () => {
  it("allows an incomplete manual Draft without fabricating untouched required fields", () => {
    expect(createCampaignDraftInputSchema.safeParse({ brandProfileId: "brand-1" }).success).toBe(true);
  });

  it("does not allow AI_RECOMMENDED through the persisted manual Draft boundary", () => {
    expect(createCampaignDraftInputSchema.safeParse({ brandProfileId: "brand-1", creationSource: "AI_RECOMMENDED" }).success).toBe(false);
  });

  it("enforces Campaign name length 3-60", () => {
    expect(campaignStep1CompletionSchema.safeParse({ name: "ab", strategy: validStrategy }).success).toBe(false);
    expect(campaignStep1CompletionSchema.safeParse({ name: "Summer Glow", strategy: validStrategy }).success).toBe(true);
    expect(campaignStep1CompletionSchema.safeParse({ name: "x".repeat(61), strategy: validStrategy }).success).toBe(false);
  });

  it("keeps KPI fields out of Brand-authored strategy input", () => {
    const parsed = campaignStep1CompletionSchema.parse({
      name: "Summer Glow",
      strategy: { ...validStrategy, primaryKpiId: "should-not-be-authoritative" },
    });
    expect("primaryKpiId" in parsed.strategy).toBe(false);
  });

  it("requires 1-5 archetypes at step completion and age within 13-65", () => {
    expect(campaignStep2CompletionSchema.safeParse({ ...validTargeting, creatorArchetypes: [] }).success).toBe(false);
    expect(campaignStep2CompletionSchema.safeParse({ ...validTargeting, audienceAgeMin: 12 }).success).toBe(false);
    expect(campaignStep2CompletionSchema.safeParse({ ...validTargeting, audienceAgeMax: 66 }).success).toBe(false);
    expect(campaignStep2CompletionSchema.safeParse(validTargeting).success).toBe(true);
  });

  it("requires maximum followers to be greater than minimum when supplied", () => {
    expect(campaignStep2CompletionSchema.safeParse({ ...validTargeting, maximumFollowers: 20_000 }).success).toBe(false);
    expect(campaignStep2CompletionSchema.safeParse(validTargeting).success).toBe(true);
  });

  it("enforces canonical commercial rules", () => {
    expect(campaignStep3CompletionSchema.safeParse(validCommercials).success).toBe(true);
    expect(campaignStep3CompletionSchema.safeParse({ ...validCommercials, totalCampaignBudget: 9_999 }).success).toBe(false);
    expect(campaignStep3CompletionSchema.safeParse({ ...validCommercials, advancePaymentPercentage: 30 }).success).toBe(false);
    expect(campaignStep3CompletionSchema.safeParse({ ...validCommercials, payoutTerms: "IMMEDIATE" }).success).toBe(false);
  });

  it("does not accept user-authored currency in the Campaign commercials result", () => {
    const parsed = campaignStep3CompletionSchema.parse({ ...validCommercials, currency: "INR" });
    expect("currency" in parsed).toBe(false);
  });

  it("supports focused post-publish patches while leaving editability to CampaignService", () => {
    expect(updateLiveCampaignInputSchema.safeParse({ campaignId: "campaign-1", name: "Updated Campaign" }).success).toBe(true);
    expect(updateLiveCampaignInputSchema.safeParse({ campaignId: "campaign-1", strategy: { campaignVisibility: "INVITE_ONLY" } }).success).toBe(true);
    expect(updateLiveCampaignInputSchema.safeParse({ campaignId: "campaign-1" }).success).toBe(false);
  });
});
