import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string): string =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("C01-I3 Creator Instagram architecture", () => {
  it("keeps authorize and completion authenticated and server-authoritative", () => {
    const controller = source(
      "src/features/creator-entry/creator-entry.controller.ts",
    );
    const service = source(
      "src/features/creator-entry/creator-instagram-connection.service.ts",
    );
    expect(controller).toContain('@Post("instagram/authorize")');
    expect(controller).toContain('@Post("instagram/complete")');
    expect(controller).toMatch(
      /@UseGuards\(JwtAuthGuard\)[\s\S]*@Post\("instagram\/authorize"\)/,
    );
    expect(controller).toMatch(
      /@UseGuards\(JwtAuthGuard\)[\s\S]*@Post\("instagram\/complete"\)/,
    );
    expect(service).toContain("CREATOR_INSTAGRAM_REDIRECT_URI");
    expect(service).toContain("CreatorInstagramOAuthTransactionService");
    expect(service).toContain("InstagramOAuthIntent.INITIAL_CONNECT");
    expect(service).not.toMatch(/redirectUri:\s*input|input\.redirectUri/);
    expect(service).not.toMatch(/graph\.facebook\.com|Facebook Login/i);
  });

  it("uses user_id as stable identity and never username as ownership authority", () => {
    const service = source(
      "src/features/creator-entry/creator-instagram-connection.service.ts",
    );
    expect(service).toContain("nativePlatformUserId: args.me.userId");
    expect(service).toContain("channelHandleString: args.me.username");
    expect(service).toContain("platformNetwork_nativePlatformUserId");
    expect(service).not.toMatch(/nativePlatformUserId:\s*args\.me\.username/);
  });

  it("keeps Basic separate from Insights and excludes Insights from entry", () => {
    const connection = source(
      "src/features/creator-entry/creator-instagram-connection.service.ts",
    );
    const state = source(
      "src/features/creator-entry/creator-entry-state.service.ts",
    );
    expect(connection).toContain("instagram_business_basic");
    expect(connection).toContain("instagram_business_manage_insights");
    expect(connection).toContain("ProviderCapabilityState.UNKNOWN");
    expect(state).not.toMatch(
      /canEnterCreatorPlatform[\s\S]{0,300}insightsCapability\s*===/,
    );
  });

  it("guards normal Creator product surfaces without guarding recovery or Settings", () => {
    const guarded = [
      "src/features/creator-centre/creator-centre.controller.ts",
      "src/features/creator-co-pilot/creator-co-pilot.controller.ts",
      "src/features/creator-payouts/creator-payouts.controller.ts",
      "src/features/creator-marketplace/creator-marketplace.controller.ts",
      "src/features/creator-marketplace/creator-campaigns.controller.ts",
      "src/features/creator-uce/creator-uce.controller.ts",
    ];
    for (const file of guarded) {
      expect(source(file)).toContain("CreatorPlatformAccessGuard");
    }
    expect(
      source("src/features/creator-entry/creator-entry.controller.ts"),
    ).not.toContain("CreatorPlatformAccessGuard");
    expect(
      source("src/features/creator-settings/creator-settings.controller.ts"),
    ).not.toContain("CreatorPlatformAccessGuard");
  });

  it("adds no I4, I5, intelligence, media ingestion, or schema authority", () => {
    const service = source(
      "src/features/creator-entry/creator-instagram-connection.service.ts",
    );
    expect(service).not.toMatch(
      /refreshLongLivedToken|fetchRecentMedia|fetchMediaInsights|CampaignCreator|Application|Intelligence/i,
    );
    expect(service).not.toMatch(/RECONNECT|ACCOUNT_CHANGE/);
  });
});
