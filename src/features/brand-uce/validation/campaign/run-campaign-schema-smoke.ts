/**
 * Lightweight Phase 1D campaign Zod smoke checks (no vitest in this package).
 * Run: npx ts-node -r dotenv/config src/features/brand-uce/validation/campaign/run-campaign-schema-smoke.ts
 */
import assert from "node:assert/strict";

import {
  campaignStep1CompletionSchema,
  campaignStep3CompletionSchema,
  createCampaignDraftInputSchema,
} from "./campaign.schema";

const validStrategy = {
  publishingSchedule: "SCHEDULED" as const,
  publishFrom: new Date("2030-01-01T00:00:00.000Z"),
  publishUntil: new Date("2030-01-31T00:00:00.000Z"),
  coreObjective: "PULSE" as const,
  platforms: ["INSTAGRAM"] as const,
  campaignVisibility: "PUBLIC" as const,
};

assert.equal(
  createCampaignDraftInputSchema.safeParse({ brandProfileId: "brand-1" })
    .success,
  true,
);
assert.equal(
  campaignStep1CompletionSchema.safeParse({
    name: "Summer Glow",
    strategy: validStrategy,
  }).success,
  true,
);
assert.equal(
  campaignStep3CompletionSchema.safeParse({
    receivesBrandSupport: false,
    compensationModel: "FIXED",
    commercialOffer: 10_000,
    totalCampaignBudget: 100_000,
    advancePaymentPercentage: 25,
    payoutTerms: "NET_30",
  }).success,
  true,
);

console.log("campaign schema smoke checks passed");
