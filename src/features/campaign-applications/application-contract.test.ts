import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { ThrottlerGuard } from "@nestjs/throttler";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  applicationSelectionSchema,
  blocksApplicationReapply,
  commandIdentity,
} from "./application-command";
import { CampaignApplicationsController } from "./campaign-applications.controller";
import { privateApplicationResponse } from "./campaign-applications.module";
import { CreatorUceController } from "../creator-uce/creator-uce.controller";
import { CreatorUceCampaignsService } from "../creator-uce/services/creator-uce-campaigns.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreatorPlatformAccessGuard } from "../creator-entry/creator-platform-access.guard";

describe("P1.3 command and HTTP boundaries", () => {
  it.each(["PENDING", "APPROVED", "REJECTED", "SUPERSEDED"] as const)(
    "%s blocks same-opportunity reapply",
    (status) => expect(blocksApplicationReapply(status)).toBe(true),
  );
  it.each(["WITHDRAWN", "EXPIRED"] as const)(
    "%s permits a fresh row subject to quota",
    (status) => expect(blocksApplicationReapply(status)).toBe(false),
  );
  it.each([
    undefined,
    "",
    "short",
    "x".repeat(129),
    "invalid key including spaces",
    "x".repeat(24) + "\n",
  ])("rejects invalid key without echoing it", (key) => {
    expect(() => commandIdentity(key, {})).toThrow();
  });
  it("fingerprints canonical fields independently of insertion order and stores no raw key", () => {
    const key = randomUUID();
    const a = commandIdentity(key, { campaignId: "a", briefId: "b" });
    expect(a).toEqual(commandIdentity(key, { briefId: "b", campaignId: "a" }));
    expect(JSON.stringify(a)).not.toContain(key);
    expect(a.requestFingerprint).not.toBe(
      commandIdentity(key, { campaignId: "a", briefId: "c" })
        .requestFingerprint,
    );
  });
  it.each([
    "subjectCreatorProfileId",
    "workspaceId",
    "actorUserId",
    "actorRole",
    "brandProfileId",
    "source",
    "status",
    "commercialOffer",
    "proposedAmount",
    "invitationId",
  ])("rejects client %s authority", (field) => {
    expect(
      applicationSelectionSchema.safeParse({
        campaignAssetId: randomUUID(),
        briefId: randomUUID(),
        [field]: "forged",
      }).success,
    ).toBe(false);
  });
  it("history requires authentication without mounting a provider guard", () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      CampaignApplicationsController,
    ) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).not.toContain(CreatorPlatformAccessGuard);
    const source = readFileSync(
      "src/features/campaign-applications/application-history.service.ts",
      "utf8",
    );
    expect(source).not.toMatch(
      /creatorSocialIntegration|campaignOpportunityInvitation|CampaignOpportunityPolicy/,
    );
  });
  it("retired legacy POST returns HTTP 410 and cannot invoke mutation services", async () => {
    const mutate = vi.fn(() => {
      throw new Error("RETIRED_MUTATION_INVOKED");
    });
    const module = await Test.createTestingModule({
      controllers: [CreatorUceController],
      providers: [
        {
          provide: CreatorUceCampaignsService,
          useValue: { applyToCampaign: mutate },
        },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CreatorPlatformAccessGuard)
      .useValue({ canActivate: () => false })
      .compile();
    const app = module.createNestApplication({ logger: false });
    app.use(privateApplicationResponse);
    try {
      await app.listen(0, "127.0.0.1");
      const response = await fetch(
        `${await app.getUrl()}/api/v1/creator-uce/campaigns/${randomUUID()}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: randomUUID(),
            proposedAmount: 100,
          }),
        },
      );
      expect(response.status).toBe(410);
      expect(await response.json()).toMatchObject({
        code: "LEGACY_APPLICATION_ENDPOINT_RETIRED",
      });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("vary")).toContain("Authorization");
      expect(mutate).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it("canonical implementation has no provider, legacy handoff, inventory or external notification dispatch", () => {
    for (const file of [
      "application-submit.service.ts",
      "application-submit-context.service.ts",
      "application-terminal.service.ts",
    ]) {
      const source = readFileSync(
        `src/features/campaign-applications/${file}`,
        "utf8",
      );
      expect(source).not.toMatch(
        /fetch\(|axios|\.log\(|\.warn\(|\.error\(|uceCampaignCollaboration\.(create|update)|inventoryCount|notifications\.dispatch\(|provisionFromUceApproval/,
      );
    }
  });
});
