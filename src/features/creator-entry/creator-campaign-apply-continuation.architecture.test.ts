import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string): string =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("C01-I5 Campaign Apply continuation architecture", () => {
  const continuationFiles = [
    "src/features/creator-entry/creator-campaign-apply-continuation.service.ts",
    "src/features/creator-entry/creator-entry-continuation.store.ts",
    "src/features/creator-marketplace/services/campaign-apply-continuation-issuance.service.ts",
  ];

  it("places public issuance under Campaign authority with bounded throttling", () => {
    const controller = source(
      "src/features/creator-marketplace/public-marketplace.controller.ts",
    );
    expect(controller).toContain(
      '@Post("campaigns/:campaignId/apply-continuation")',
    );
    expect(controller).toContain(
      "@Throttle({ default: { limit: 20, ttl: 60_000 } })",
    );
    expect(controller).not.toContain("JwtAuthGuard");
    expect(controller).not.toContain("CreatorPlatformAccessGuard");
  });

  it("keeps authenticated resolution inside Creator Entry and platform-guard exempt", () => {
    const controller = source(
      "src/features/creator-entry/creator-entry.controller.ts",
    );
    expect(controller).toMatch(
      /@UseGuards\(JwtAuthGuard\)[\s\S]{0,120}@Post\("campaign-apply\/continuation\/resolve"\)/,
    );
    expect(controller).not.toContain("CreatorPlatformAccessGuard");
  });

  it("never imports or invokes explicit Campaign Apply authority", () => {
    for (const file of continuationFiles) {
      const contents = source(file);
      expect(contents).not.toMatch(
        /CreatorUceCampaignsService|applyToCampaign|creator-uce\/campaigns/,
      );
    }
  });

  it("contains no Application, CampaignCreator, collaboration, or Campaign mutation", () => {
    for (const file of continuationFiles) {
      expect(source(file)).not.toMatch(
        /uceApplication|uceCampaignCreator|uceCampaignCollaboration|uceCampaign\.update|CREATOR_APPLIED/,
      );
    }
  });

  it("contains no admission, eligibility, Intelligence, brief, or product policy", () => {
    for (const file of continuationFiles) {
      expect(source(file)).not.toMatch(
        /follower|waitlist|CreatorIntelligence|AI_ENGINE_SYNCED|matchScore|briefId|productId|inventory|subscription/i,
      );
    }
  });

  it("accepts no arbitrary return destination or Campaign input during resolve", () => {
    const service = source(
      "src/features/creator-entry/creator-campaign-apply-continuation.service.ts",
    );
    const dto = source("src/features/creator-entry/dto/creator-entry.dto.ts");
    expect(service).not.toMatch(
      /returnUrl|redirectUri|frontendPath|continueTo|inviteToken|briefId|productId/,
    );
    const resolveDto = dto.slice(
      dto.indexOf("export class CreatorCampaignApplyContinuationResolveDto"),
    );
    expect(resolveDto).toContain("continuationToken");
    expect(resolveDto).not.toMatch(
      /campaignId|returnUrl|inviteToken|creatorProfileId|userId|nextAction/,
    );
  });

  it("preserves the separately guarded explicit Apply command and direct entry action", () => {
    const controller = source(
      "src/features/creator-uce/creator-uce.controller.ts",
    );
    expect(controller).toContain(
      "@UseGuards(ThrottlerGuard, JwtAuthGuard, CreatorPlatformAccessGuard)",
    );
    expect(controller).toContain('@Post("campaigns/:campaignId/apply")');
    expect(controller).toContain("this.campaigns.applyToCampaign");
    expect(
      source("src/features/creator-entry/creator-entry-state.service.ts"),
    ).toContain('return "CREATOR_WORKSPACE_ENTRY"');
  });
});
