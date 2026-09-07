import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(
  resolve(process.cwd(), "prisma/schema.prisma"),
  "utf8",
);
const continuation = schema.slice(
  schema.indexOf("model CreatorEntryContinuation"),
  schema.indexOf("model UceCampaignAsset"),
);

describe("C01-I1 persistence-only scope", () => {
  it("contains no arbitrary return URL or competing Campaign public authority", () => {
    expect(continuation).not.toMatch(/returnUrl|redirectUrl|publicCampaignId/i);
    expect(continuation).toContain("campaignId");
    expect(continuation).toContain("UceCampaign");
  });

  it("does not introduce I2/I3/I5 controllers or guards", () => {
    const files = [
      "src/features/provider-oauth/provider-oauth-transaction.service.ts",
      "src/features/provider-oauth/creator-instagram-oauth-transaction.service.ts",
      "src/features/creator-entry/creator-entry-continuation.store.ts",
    ]
      .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
      .join("\n");
    expect(files).not.toMatch(
      /@Controller|CreatorPlatformAccessGuard|fetchMe|exchangeAuthorizationCode/,
    );
  });
});
