import "reflect-metadata";
import { GoneException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  brandFixture,
  campaignFixture,
  creatorFixture,
  applicationHarness,
} from "../../../test/fixtures/c03-application-fixtures";
import type { PrismaService } from "../../prisma/prisma.service";
import { CollaborationProvisionService } from "./services/collaboration-provision.service";
import { CollaborationService } from "./services/collaboration.service";
import { CollaborationAccessService } from "./services/collaboration-access.service";
import { NotificationDispatchService } from "../notifications/services/notification-dispatch.service";
import { NotificationRecipientPolicyService } from "../notifications/services/notification-recipient-policy.service";
import { randomUUID } from "node:crypto";

describe.skipIf(process.env.C03_P14_DATABASE_TEST !== "true")(
  "P1.4 legacy Collaboration compatibility",
  { timeout: 30_000 },
  () => {
    const db = new PrismaClient();
    const h = applicationHarness(db);
    const realtime = { broadcast: vi.fn(async () => {}) };
    const provision = new CollaborationProvisionService(
      db as PrismaService,
      realtime as never,
    );
    beforeAll(() => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (url.hostname !== "localhost" || url.pathname !== "/c03_p14_handoff")
        throw new Error("P14_ISOLATED_DATABASE_REQUIRED");
    });
    afterAll(() => db.$disconnect());
    async function fixture() {
      const owner = await creatorFixture(db),
        brand = await brandFixture(db);
      const c = await campaignFixture(db, brand.brand.id);
      const product = await db.uceCampaignProduct.create({
        data: {
          campaignId: c.campaign.id,
          productName: "Legacy offering",
          inventoryCount: 19,
        },
      });
      const brief = await db.uceCampaignBrief.create({
        data: {
          campaignId: c.campaign.id,
          productId: product.id,
          internalTitle: "Legacy brief",
          creativeGuidelines: "Legacy instructions",
          requiredPlatforms: ["INSTAGRAM"],
        },
      });
      const input = {
        brandProfileId: brand.brand.id,
        campaignId: c.campaign.id,
        creatorUserId: owner.user.id,
        briefId: brief.id,
        productId: product.id,
        initialQuote: 100,
      };
      const workspace = {
        resolveBrandContext: async () => ({ brandProfileId: brand.brand.id }),
      };
      const access = new CollaborationAccessService(
        db as PrismaService,
        workspace as never,
      );
      const notifications = new NotificationDispatchService(
        db as PrismaService,
        new NotificationRecipientPolicyService(db as PrismaService),
      );
      const service = new CollaborationService(
        db as PrismaService,
        access,
        realtime as never,
        notifications,
      );
      return { owner, brand, c, product, brief, input, service };
    }
    it("legacy provision reuses its own row beside multiple canonical rows", async () => {
      const f = await fixture();
      const first = await provision.provisionFromUceApproval(f.input);
      expect(
        (await provision.provisionFromUceApproval(f.input)).collaboration_id,
      ).toBe(first.collaboration_id);
      const app = await h.submit.submit(
        f.owner.user,
        f.c.campaign.id,
        f.c.selection(),
        randomUUID(),
      );
      await h.terminal.decide(
        f.brand.user,
        f.c.campaign.id,
        app.applicationId,
        "APPROVE",
        randomUUID(),
      );
      expect(
        (await provision.provisionFromUceApproval(f.input)).collaboration_id,
      ).toBe(first.collaboration_id);
      expect(
        await db.collaboration.count({
          where: { campaignId: f.c.campaign.id },
        }),
      ).toBe(2);
      expect((await f.service.listThreads(f.owner.user, {})).rows).toHaveLength(
        2,
      );
      expect(
        (await f.service.getThread(f.owner.user, first.collaboration_id)).thread
          .brief.internalTitle,
      ).toBe("Legacy brief");
      expect(
        await db.uceCampaignProduct.findUnique({ where: { id: f.product.id } }),
      ).toMatchObject({ inventoryCount: 19 });
      await expect(
        provision.provisionFromUceApproval({
          ...f.input,
          allowExisting: false,
        }),
      ).rejects.toBeDefined();
    });
    it("concurrent legacy provision cannot create duplicate Campaign/Creator rows", async () => {
      const f = await fixture();
      const results = await Promise.allSettled([
        provision.provisionFromUceApproval(f.input),
        provision.provisionFromUceApproval(f.input),
      ]);
      expect(results.some((r) => r.status === "fulfilled")).toBe(true);
      expect(
        await db.collaboration.count({
          where: { campaignId: f.c.campaign.id, sourceApplicationId: null },
        }),
      ).toBe(1);
    });
    it("legacy messages remain usable; leftover commercial writes are 410", async () => {
      const f = await fixture();
      const { collaboration_id: id } = await provision.provisionFromUceApproval(
        f.input,
      );
      expect(
        await f.service.postMessage(f.owner.user, id, {
          body: "Fixture message",
        }),
      ).toMatchObject({ body: "Fixture message" });
      expect(
        (await f.service.listMessages(f.owner.user, id)).messages,
      ).toHaveLength(2);
      await expect(
        f.service.submitCreatorQuote(f.owner.user, id, {
          total_quote: 150,
        }),
      ).rejects.toBeInstanceOf(GoneException);
      await expect(
        f.service.brandCounterOffer(f.brand.user, id, {
          counter_offer: 125,
        }),
      ).rejects.toBeInstanceOf(GoneException);
      await expect(
        f.service.acceptCommercials(f.owner.user, id, {}),
      ).rejects.toBeInstanceOf(GoneException);
      const row = await db.collaboration.findUniqueOrThrow({
        where: { id },
        include: { commercials: true },
      });
      expect(row.sourceApplicationId).toBeNull();
      expect(row.commercials?.finalQuote?.toString()).not.toBe("125");
    });
    it("leftover logistics, content, and finalization writes are 410", async () => {
      const f = await fixture();
      const { collaboration_id: id } = await provision.provisionFromUceApproval(
        { ...f.input, payoutMode: "BARTER", initialQuote: 0 },
      );
      await expect(
        f.service.acceptCommercials(f.owner.user, id, { final_quote: 0 }),
      ).rejects.toBeInstanceOf(GoneException);
      await expect(
        f.service.dispatchLogistics(f.brand.user, id, {
          tracking_id: "fixture-tracking",
        }),
      ).rejects.toBeInstanceOf(GoneException);
      await expect(
        f.service.confirmReceipt(f.owner.user, id),
      ).rejects.toBeInstanceOf(GoneException);
      await expect(
        f.service.submitMedia(f.owner.user, id, {
          phase: "MEDIA",
          media_url: "https://example.test/fixture.mp4",
        }),
      ).rejects.toBeInstanceOf(GoneException);
      await expect(
        f.service.reviewMedia(f.brand.user, id, { decision: "APPROVED" }),
      ).rejects.toBeInstanceOf(GoneException);
      await expect(
        f.service.submitLivePost(f.owner.user, id, {
          live_post_url: "https://instagram.com/p/fixture",
        }),
      ).rejects.toBeInstanceOf(GoneException);
      await expect(
        f.service.verifyCompliance(f.brand.user, id),
      ).rejects.toBeInstanceOf(GoneException);
      await expect(
        f.service.submitReview(f.owner.user, id, { rating: 5 }),
      ).rejects.toBeInstanceOf(GoneException);
    });
  },
);
