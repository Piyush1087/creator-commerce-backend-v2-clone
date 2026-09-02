import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CreatorPayoutObligationService } from "./creator-payout-obligation.service";
import { EscrowFinancialAllocationService } from "./escrow-financial-allocation.service";

describe.skipIf(process.env.RUN_BS09_POSTGRES_TESTS !== "true")(
  "BS09 PostgreSQL financial allocation serialization",
  () => {
    const db = new PrismaClient();
    const suffix = randomUUID();
    const brandId = `bs09-brand-${suffix}`;
    const creatorUserId = `bs09-user-${suffix}`;
    const creatorProfileId = `bs09-creator-${suffix}`;
    const campaignId = `bs09-campaign-${suffix}`;
    const briefId = `bs09-brief-${suffix}`;
    const collaborationId = `bs09-collab-${suffix}`;
    let service: CreatorPayoutObligationService;

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !url.pathname.toLowerCase().includes("bs09")
      ) {
        throw new Error(
          "BS09 PostgreSQL tests require a disposable loopback bs09 database",
        );
      }
      await db.brandProfile.create({
        data: {
          id: brandId,
          domain: `${suffix}.bs09.example`,
          name: "BS09 test brand",
          industry: "D2C",
          brandValues: [],
          policyFlags: [],
        },
      });
      await db.user.create({
        data: {
          id: creatorUserId,
          email: `${suffix}@bs09.example`,
          role: "CREATOR",
        },
      });
      await db.creatorProfile.create({
        data: { id: creatorProfileId, userId: creatorUserId },
      });
      await db.uceCampaign.create({
        data: { id: campaignId, brandProfileId: brandId, name: "BS09" },
      });
      await db.uceCampaignBrief.create({
        data: {
          id: briefId,
          campaignId,
          internalTitle: "BS09",
          creativeGuidelines: "Test only",
          requiredPlatforms: [],
        },
      });
      await db.collaboration.create({
        data: {
          id: collaborationId,
          brandProfileId: brandId,
          creatorUserId,
          campaignId,
          briefId,
          industry: "D2C_ECOMMERCE",
        },
      });
      await db.brandEscrowVault.create({
        data: {
          brandProfileId: brandId,
          currency: "INR",
          totalPooledBalance: 100,
          lockedCampaignFunds: 100,
        },
      });
      await db.collaborationEscrowLock.create({
        data: {
          collaborationId,
          brandProfileId: brandId,
          grossCreatorQuote: 100,
          platformCommissionFee: 0,
          totalEscrowLockedAmount: 100,
          netCreatorPayoutPool: 100,
        },
      });
      service = new CreatorPayoutObligationService(
        db as never,
        { enqueueWithinTransaction: async () => undefined } as never,
        new EscrowFinancialAllocationService(),
        { allocateCreatorObligation: async () => undefined } as never,
      );
    });

    afterAll(async () => {
      await db.creatorPayoutObligation.deleteMany({
        where: { collaborationId },
      });
      await db.creatorPayoutProfile.deleteMany({
        where: { creatorProfileId },
      });
      await db.collaborationEscrowLock.deleteMany({
        where: { collaborationId },
      });
      await db.brandEscrowVault.deleteMany({
        where: { brandProfileId: brandId },
      });
      await db.collaboration.deleteMany({ where: { id: collaborationId } });
      await db.uceCampaignBrief.deleteMany({ where: { id: briefId } });
      await db.uceCampaign.deleteMany({ where: { id: campaignId } });
      await db.creatorProfile.deleteMany({ where: { id: creatorProfileId } });
      await db.user.deleteMany({ where: { id: creatorUserId } });
      await db.brandProfile.deleteMany({ where: { id: brandId } });
      await db.$disconnect();
    });

    it("allows only one economic result when concurrent 60 + 60 instructions race", async () => {
      const base = {
        collaborationId,
        brandProfileId: brandId,
        creatorProfileId,
        obligationType: "RESOLUTION" as const,
        entitlementAmount: 60,
        currency: "INR",
        issuedAt: new Date(),
      };
      const results = await Promise.allSettled([
        service.consumeSettlementInstruction({
          ...base,
          instructionId: `resolution:${suffix}:a`,
        }),
        service.consumeSettlementInstruction({
          ...base,
          instructionId: `resolution:${suffix}:b`,
        }),
      ]);
      const failures = results
        .filter((result) => result.status === "rejected")
        .map((result) => String(result.reason));

      expect(
        results.filter((result) => result.status === "fulfilled"),
        failures.join("\n"),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      await expect(
        db.creatorPayoutObligation.count({ where: { collaborationId } }),
      ).resolves.toBe(1);
    });
  },
);
