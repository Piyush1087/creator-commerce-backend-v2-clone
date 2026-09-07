import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string): string =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("C01-I3 legacy Creator onboarding authority architecture", () => {
  it("makes every legacy route a dependency-free retirement response", () => {
    const controller = source(
      "src/features/creator-onboarding/creator-onboarding.controller.ts",
    );

    for (const route of [
      "handle-check",
      "stage-features",
      "signup",
      "verify-otp",
      "meta-connect",
      "activate-sync",
      "waitlist",
    ]) {
      expect(controller).toContain(`@Post("${route}")`);
    }
    expect(controller).toContain('@Get("track/:trackId")');
    expect(controller).not.toContain("CreatorOnboardingService");
    expect(controller).not.toContain("InstagramConnectService");
    expect(controller).not.toContain("this.onboarding");
    expect(controller).not.toContain("redirectUri");
    expect(controller).not.toContain("skipInstagramConnect");
    expect(controller).not.toContain("CreatorAiSyncService");
    expect(controller).not.toContain("ZodValidationPipe");
  });

  it("keeps Creator Entry shared OAuth as the sole active Creator connection authority", () => {
    const entryController = source(
      "src/features/creator-entry/creator-entry.controller.ts",
    );
    const entryService = source(
      "src/features/creator-entry/creator-instagram-connection.service.ts",
    );
    const transactionAdapter = source(
      "src/features/provider-oauth/creator-instagram-oauth-transaction.service.ts",
    );
    const onboardingController = source(
      "src/features/creator-onboarding/creator-onboarding.controller.ts",
    );

    expect(entryController).toContain('@Post("instagram/authorize")');
    expect(entryController).toContain('@Post("instagram/complete")');
    expect(entryController).toContain("CreatorInstagramConnectionService");
    expect(entryService).toContain("CreatorInstagramOAuthTransactionService");
    expect(transactionAdapter).toContain("ProviderOAuthTransactionService");
    expect(onboardingController).not.toMatch(/return\s+this\.[\s\S]*connect/i);
    expect(onboardingController).not.toMatch(/@(?:Get|Post)\(".*callback/i);
  });
});
