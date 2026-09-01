import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string): string =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("C01-I2 Creator Entry architecture", () => {
  it("exposes only the bounded I2 Creator Entry surface", () => {
    const controller = source(
      "src/features/creator-entry/creator-entry.controller.ts",
    );
    expect(controller).toContain('@Controller("api/v1/creator-entry")');
    expect(controller).toContain('@Post("register/password")');
    expect(controller).toContain('@Post("register/email/otp/request")');
    expect(controller).toContain('@Post("register/email/otp/verify")');
    expect(controller).toContain('@Post("register/google")');
    expect(controller).toContain('@Get("state")');
    expect(controller).not.toMatch(
      /instagram\/(authorize|complete|revalidate)/,
    );
    expect(controller).not.toMatch(/campaign|continuation/i);
  });

  it("keeps password registration outside the session/cookie boundary", () => {
    const controller = source(
      "src/features/creator-entry/creator-entry.controller.ts",
    );
    const passwordMethod = controller.slice(
      controller.indexOf("registerPassword("),
      controller.indexOf("requestEmailOtp("),
    );
    expect(passwordMethod).toContain("this.registration.registerPassword(dto)");
    expect(passwordMethod).not.toContain("withRefreshCookie");
    expect(passwordMethod).not.toContain("setRefreshCookie");
  });

  it("retires legacy Creator signup and verification with a stable 410", () => {
    const controller = source(
      "src/features/creator-onboarding/creator-onboarding.controller.ts",
    );
    const service = source(
      "src/features/creator-onboarding/creator-onboarding.service.ts",
    );
    expect(controller).toContain('@Post("signup")');
    expect(controller).toContain('@Post("verify-otp")');
    expect(controller).toContain("new GoneException");
    expect(controller).toContain("CREATOR_ONBOARDING_ACCOUNT_CREATION_RETIRED");
    expect(controller).not.toContain("this.onboarding.signup(");
    expect(controller).not.toContain("this.onboarding.verifyOtp(");
    expect(service).not.toMatch(/async\s+signup\s*\(/);
    expect(service).not.toMatch(/async\s+verifyOtp\s*\(/);
    expect(service).not.toContain("CreatorSignupOtpService");
  });

  it("makes shared Google sign-in existing-account/link only", () => {
    const google = source("src/features/auth/google-auth.service.ts");
    expect(google).toContain("GOOGLE_REGISTRATION_REQUIRED");
    expect(google).not.toContain("creatorOnboardingTrack");
    expect(google).not.toMatch(/(?:tx|this\.prisma)\.user\.create\s*\(/);
    expect(google).not.toMatch(/organization\.create\s*\(/);
    expect(google).not.toMatch(/creatorProfile\.create\s*\(/);
    expect(google).not.toMatch(/creatorWorkspace\.create\s*\(/);
  });

  it("keeps the I2 state projection read-only and provider-call free", () => {
    const state = source(
      "src/features/creator-entry/creator-entry-state.service.ts",
    );
    expect(state).toContain("socialIntegrations");
    expect(state).not.toMatch(
      /\.(create|update|upsert|delete|connectForUser)\s*\(/,
    );
    expect(state).not.toMatch(/fetch\s*\(|axios|OAuth2Client|graph\.facebook/i);
    expect(state).toContain(
      'onboardingStatus: canEnterCreatorPlatform ? "COMPLETE"',
    );
    expect(state).toContain('identityConnection === "CONNECTED"');
    expect(state).toContain("ProviderAuthorizationHealth.DISCONNECTED");
    expect(state).not.toMatch(
      /identityConnected[\s\S]*OAuthTokenStatus\.ACTIVE/,
    );
  });

  it("centralizes the fail-closed sterile provisional policy", () => {
    const policy = source(
      "src/shared/identity/sterile-provisional-creator.policy.ts",
    );
    expect(policy).toContain("UserAuthState.PROVISIONAL");
    expect(policy).toContain("UserRole.CREATOR");
    expect(policy).toContain("organizationId");
    expect(policy).toContain("creatorProfile");
    expect(policy).toContain("brandTeamMemberships");
    expect(policy).toContain("authSessions");
    expect(policy).toContain("creatorOnboardingTrack");
    expect(policy).toContain("initiatedProviderOAuthTransactions");
  });
});
