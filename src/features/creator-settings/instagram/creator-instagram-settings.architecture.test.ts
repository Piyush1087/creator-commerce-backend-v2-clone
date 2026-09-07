import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) =>
  readFileSync(join(process.cwd(), file), "utf8");

describe("C05-P1C Creator Instagram Settings boundaries", () => {
  it("keeps the facade authenticated and feature-local for P2 registration", () => {
    const controller = source(
      "src/features/creator-settings/instagram/creator-instagram-settings.controller.ts",
    );
    expect(controller).toContain(
      '@Controller("api/v1/creator/settings/instagram")',
    );
    expect(controller).toContain("@UseGuards(ThrottlerGuard, JwtAuthGuard)");
    expect(source("src/app.module.ts")).not.toContain(
      "CreatorInstagramSettingsController",
    );
  });

  it("uses canonical C01 identity, health, OAuth transaction, and encrypted-token primitives", () => {
    const service = source(
      "src/features/creator-settings/instagram/creator-instagram-settings.service.ts",
    );
    for (const primitive of [
      "CreatorInstagramOAuthTransactionService",
      "ProviderAuthorizationHealth",
      "ProviderCapabilityState",
      "nativePlatformUserId",
      "authorizationGeneration",
      "credentialVersion",
      "encryptField",
      "decryptField",
    ]) {
      expect(service).toContain(primitive);
    }
  });

  it("never replaces a stable identity or broadens to non-Instagram platforms", () => {
    const service = source(
      "src/features/creator-settings/instagram/creator-instagram-settings.service.ts",
    );
    expect(service).not.toMatch(/nativePlatformUserId:\s*args\.me/);
    expect(service).not.toMatch(/TIKTOK|YOUTUBE|MARKETPLACE/);
    expect(service).toContain("INSTAGRAM_DIFFERENT_ACCOUNT_BLOCKED");
    expect(service).toContain("manualReviewRequired: true");
  });

  it("does not own schema, provider configuration, or downstream modules", () => {
    const files = [
      "src/features/creator-settings/instagram/creator-instagram-settings.controller.ts",
      "src/features/creator-settings/instagram/creator-instagram-settings.service.ts",
    ];
    for (const file of files) {
      expect(source(file)).not.toMatch(
        /CampaignApplication|CollaborationState|PayoutExecution|Kyc|Beneficiary/,
      );
    }
  });

  it("leaves initial permanent-identity creation to the accepted C01 path", () => {
    const service = source(
      "src/features/creator-settings/instagram/creator-instagram-settings.service.ts",
    );
    expect(service).not.toContain("InstagramOAuthIntent.INITIAL_CONNECT");
    expect(service).toContain('actor.actorRole === "MANAGER"');
  });
});
