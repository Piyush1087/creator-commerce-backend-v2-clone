import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string): string =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("C01-I4 Instagram continuity architecture", () => {
  it("keeps all recovery routes authenticated and outside the platform guard", () => {
    const controller = source(
      "src/features/creator-entry/creator-entry.controller.ts",
    );
    for (const route of [
      "instagram/revalidate",
      "instagram/reconnect/authorize",
      "instagram/reconnect/complete",
    ]) {
      expect(controller).toContain(`@Post("${route}")`);
      expect(controller).toMatch(
        new RegExp(
          `@UseGuards\\(JwtAuthGuard\\)[\\s\\S]{0,120}@Post\\("${route.replaceAll("/", "\\/")}\\"\\)`,
        ),
      );
    }
    expect(controller).not.toContain("CreatorPlatformAccessGuard");
  });

  it("uses only server authority and the shared Creator OAuth transaction", () => {
    const continuity = source(
      "src/features/creator-entry/creator-instagram-continuity.service.ts",
    );
    const dto = source("src/features/creator-entry/dto/creator-entry.dto.ts");
    expect(continuity).toContain("CreatorInstagramOAuthTransactionService");
    expect(continuity).toContain("InstagramOAuthIntent.RECONNECT");
    expect(continuity).toContain("expectedGeneration");
    expect(continuity).toContain("expectedProviderAccountId");
    expect(continuity).toContain("resolveCreatorInstagramRedirectUri");
    expect(dto).not.toMatch(
      /redirectUri|providerAccountId|creatorProfileId|expectedGeneration|instagramHandle/,
    );
  });

  it("fences reconnect and refresh without changing stable identity", () => {
    const continuity = source(
      "src/features/creator-entry/creator-instagram-continuity.service.ts",
    );
    const refresh = source(
      "src/features/creator-entry/creator-instagram-token-refresh.service.ts",
    );
    expect(continuity).toContain("authorizationGeneration: { increment: 1 }");
    expect(continuity).toContain("credentialVersion: { increment: 1 }");
    expect(continuity).not.toMatch(/nativePlatformUserId:\s*args\.me/);
    expect(refresh).toContain("authorizationGeneration:");
    expect(refresh).toContain("credentialVersion:");
    expect(refresh).not.toContain("authorizationGeneration: { increment: 1 }");
    expect(
      source("src/features/creator-entry/creator-entry.module.ts"),
    ).toContain("CreatorInstagramTokenRefreshScheduler");
    expect(
      source(
        "src/features/creator-entry/creator-instagram-token-refresh.scheduler.ts",
      ),
    ).toContain("@Cron(CREATOR_INSTAGRAM_REFRESH_CRON");
  });

  it("keeps continuity provider-only and excludes media, intelligence, and I5", () => {
    const files = [
      "src/features/creator-entry/creator-instagram-continuity.service.ts",
      "src/features/creator-entry/creator-instagram-token-refresh.service.ts",
    ];
    for (const file of files) {
      expect(source(file)).not.toMatch(
        /fetchRecentMedia|fetchMediaInsights|CreatorIntelligence|CreatorAiSync|CampaignCreator|Application/,
      );
    }
  });

  it("increments disconnect fences while retaining the required ciphertext", () => {
    const settings = source(
      "src/features/creator-settings/services/creator-settings.service.ts",
    );
    expect(settings).toContain(
      'authorizationHealthReasonCode: "USER_DISCONNECTED"',
    );
    expect(settings).toContain("authorizationGeneration: { increment: 1 }");
    expect(settings).toContain("credentialVersion: { increment: 1 }");
    expect(settings).not.toMatch(/oauthAccessTokenEncrypted:\s*null/);
  });
});
