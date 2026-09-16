import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaService } from "../../prisma/prisma.service";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import { portfolioTestOwner } from "../creator-portfolio/testing/portfolio.fixture";
import { CreatorBusinessEmailProjectionService } from "../creator-settings/services/creator-business-email-projection.service";
import { CreatorMediaKitService } from "./creator-media-kit.service";

describe.skipIf(process.env.CREATOR_MEDIA_KIT_DATABASE_TEST !== "true")(
  "Creator Media Kit V3 PostgreSQL lifecycle",
  () => {
    const db = new PrismaClient();
    const prisma = db as unknown as PrismaService;
    const actors = new CreatorWorkspaceActorService(prisma);
    const available = <T>(value: T) => ({
      read: async () => value,
    });
    const service = new CreatorMediaKitService(
      prisma,
      actors,
      available({
        state: "UNCONFIGURED",
        identity: {},
        profile: null,
      }) as never,
      available({
        status: "UNAVAILABLE",
        overview: { facts: [] },
        freshness: { capturedAt: null },
      }) as never,
      available({
        status: "UNAVAILABLE",
        whatYouCreate: { themes: [] },
        performance: { claims: [] },
        freshness: { capturedAt: null },
      }) as never,
      available({ items: [] }) as never,
      available({ state: "UNCONFIGURED", values: null }) as never,
      available({
        state: "UNCONFIGURED",
        values: null,
        country: { canonicalRateCardCurrency: null },
      }) as never,
      new CreatorBusinessEmailProjectionService(prisma),
      { resolveBrandContextReadOnly: async () => undefined } as never,
    );

    beforeAll(async () => {
      const route = new URL(process.env.DATABASE_URL ?? "");
      if (route.hostname !== "127.0.0.1" || route.pathname !== "/media_kit_v3")
        throw new Error("TASK_OWNED_MEDIA_KIT_DATABASE_REQUIRED");
      await db.$connect();
      expect(
        await db.$queryRaw<Array<{ n: number }>>`
          SELECT count(*)::int n
          FROM _prisma_migrations
          WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
        `,
      ).toEqual([{ n: 106 }]);
    });

    afterAll(async () => db.$disconnect());

    it("creates DRAFT despite the true-by-default legacy flag and does not expose it", async () => {
      const fixture = await portfolioTestOwner(db);
      expect(fixture.profile.isMediaKitPublic).toBe(true);
      const first = await service.readCreator(fixture.owner.auth);
      expect(first.configuration).toMatchObject({
        lifecycle: "DRAFT",
        revision: 0,
      });
      const kit = await db.creatorMediaKit.findUniqueOrThrow({
        where: { workspaceId: fixture.workspace.id },
      });
      await expect(service.readPublic(kit.publicId)).rejects.toThrow(
        "Creator media kit not found",
      );
      await expect(
        service.readLegacyLiveForCreatorProfile(fixture.profile.id),
      ).rejects.toThrow("Creator media kit not found");
    });

    it("enforces roles, CAS, actor-bound idempotency and one-Kit uniqueness", async () => {
      const fixture = await portfolioTestOwner(db);
      const update = {
        intent: "UPDATE_CONFIGURATION" as const,
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
        visibility: {
          audience: false,
          content: false,
          portfolio: false,
          rateCard: false,
        },
        publicVisuals: [],
        featuredPortfolioItemIds: [],
      };
      await expect(
        service.mutate(fixture.assistant.auth, update),
      ).rejects.toThrow();
      const first = await service.mutate(fixture.owner.auth, update);
      expect(first).toMatchObject({
        reused: false,
        configuration: { revision: 1, lifecycle: "DRAFT" },
      });
      expect(await service.mutate(fixture.owner.auth, update)).toMatchObject({
        reused: true,
        configuration: { revision: 1 },
      });
      await expect(
        service.mutate(fixture.manager.auth, update),
      ).rejects.toThrow();
      expect(
        await db.creatorMediaKit.count({
          where: { workspaceId: fixture.workspace.id },
        }),
      ).toBe(1);
      expect(
        await db.creatorMediaKitRevision.count({
          where: { mediaKit: { workspaceId: fixture.workspace.id } },
        }),
      ).toBe(1);
    });

    it("serializes concurrent publish, serves minimized LIVE, and unpublishes fail closed", async () => {
      const fixture = await portfolioTestOwner(db);
      await service.readCreator(fixture.owner.auth);
      const outcomes = await Promise.allSettled([
        service.mutate(fixture.owner.auth, {
          intent: "PUBLISH",
          expectedRevision: 0,
          idempotencyKey: randomUUID(),
        }),
        service.mutate(fixture.manager.auth, {
          intent: "PUBLISH",
          expectedRevision: 0,
          idempotencyKey: randomUUID(),
        }),
      ]);
      expect(
        outcomes.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        outcomes.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      const kit = await db.creatorMediaKit.findUniqueOrThrow({
        where: { workspaceId: fixture.workspace.id },
      });
      const shell = await service.readPublic(kit.publicId);
      expect(shell).toMatchObject({
        lifecycle: "LIVE",
        publicId: kit.publicId,
        visuals: [],
      });
      expect(shell).not.toHaveProperty("sections");
      expect(shell).not.toHaveProperty("email");
      const before = {
        applications: await db.uceApplication.count(),
        campaigns: await db.uceCampaign.count(),
        collaborations: await db.collaboration.count(),
      };
      expect(
        await service.recordPublicEvent(
          kit.publicId,
          "WORK_WITH_CREATOR_CLICK",
        ),
      ).toEqual({ accepted: true, terminal: true });
      expect({
        applications: await db.uceApplication.count(),
        campaigns: await db.uceCampaign.count(),
        collaborations: await db.collaboration.count(),
      }).toEqual(before);
      await service.mutate(fixture.owner.auth, {
        intent: "UNPUBLISH",
        expectedRevision: 1,
        idempotencyKey: randomUUID(),
      });
      await expect(service.readPublic(kit.publicId)).rejects.toThrow(
        "Creator media kit not found",
      );
    });

    it("permits incremental draft curation but enforces four-to-six at publication", async () => {
      const fixture = await portfolioTestOwner(db);
      const portfolioId = randomUUID();
      const portfolio = await db.$transaction(async (tx) => {
        const created = await tx.creatorPortfolio.create({
          data: {
            id: portfolioId,
            workspaceId: fixture.workspace.id,
            ownerProfileId: fixture.profile.id,
            currentRevision: 1,
          },
        });
        await tx.creatorPortfolioRevision.create({
          data: {
            portfolioId,
            revision: 1,
            previousRevision: 0,
            snapshot: { fixture: true },
            actorUserId: fixture.owner.auth.id,
            actorMembershipId: fixture.owner.membership.id,
            actorRole: "OWNER",
            origin: "MANUAL",
            idempotencyKey: randomUUID(),
            commandHash: "a".repeat(64),
          },
        });
        return created;
      });
      const itemIds = Array.from(
        { length: 4 },
        () => `portfolio-item:${randomBytes(32).toString("hex")}`,
      );
      await db.creatorPortfolioItem.createMany({
        data: itemIds.map((id, index) => ({
          id,
          portfolioId: portfolio.id,
          kind: "EXTERNAL",
          destination: `https://example.test/work/${index}`,
          title: `Work ${index + 1}`,
          state: "INCLUDED",
          sources: ["CREATOR_PROVIDED"],
          provenance: [{ source: "test" }],
          lastRevision: 1,
        })),
      });
      await service.readCreator(fixture.owner.auth);
      const partial = await service.mutate(fixture.owner.auth, {
        intent: "UPDATE_CONFIGURATION",
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
        visibility: {
          audience: false,
          content: false,
          portfolio: true,
          rateCard: false,
        },
        publicVisuals: [],
        featuredPortfolioItemIds: itemIds.slice(0, 1),
      });
      expect(partial.configuration).toMatchObject({ revision: 1 });
      await expect(
        service.mutate(fixture.owner.auth, {
          intent: "PUBLISH",
          expectedRevision: 1,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toMatchObject({
        response: {
          code: "MEDIA_KIT_PORTFOLIO_SELECTION_REQUIRES_FOUR_TO_SIX",
        },
      });
      await service.mutate(fixture.owner.auth, {
        intent: "UPDATE_CONFIGURATION",
        expectedRevision: 1,
        idempotencyKey: randomUUID(),
        visibility: {
          audience: false,
          content: false,
          portfolio: true,
          rateCard: false,
        },
        publicVisuals: [],
        featuredPortfolioItemIds: itemIds,
      });
      await expect(
        service.mutate(fixture.owner.auth, {
          intent: "PUBLISH",
          expectedRevision: 2,
          idempotencyKey: randomUUID(),
        }),
      ).resolves.toMatchObject({
        configuration: { lifecycle: "LIVE", revision: 3 },
      });
    });

    it("reveals only the Settings-owned business email and isolates Creators", async () => {
      const first = await portfolioTestOwner(db);
      const second = await portfolioTestOwner(db);
      await service.readCreator(first.owner.auth);
      await service.readCreator(second.owner.auth);
      await service.mutate(first.owner.auth, {
        intent: "PUBLISH",
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
      });
      const firstKit = await db.creatorMediaKit.findUniqueOrThrow({
        where: { workspaceId: first.workspace.id },
      });
      const secondKit = await db.creatorMediaKit.findUniqueOrThrow({
        where: { workspaceId: second.workspace.id },
      });
      expect(await service.revealEmail(firstKit.publicId)).toEqual({
        state: "AVAILABLE",
        email: first.owner.auth.email,
      });
      await expect(service.revealEmail(secondKit.publicId)).rejects.toThrow();
      expect(firstKit.ownerProfileId).not.toBe(secondKit.ownerProfileId);
    });

    it("requires a server-resolved active verified Brand context for commercial projection and PDF", async () => {
      const creator = await portfolioTestOwner(db);
      await service.readCreator(creator.owner.auth);
      await service.mutate(creator.owner.auth, {
        intent: "PUBLISH",
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
      });
      const kit = await db.creatorMediaKit.findUniqueOrThrow({
        where: { workspaceId: creator.workspace.id },
      });
      const organization = await db.organization.create({
        data: {
          name: "Verified Brand",
          kind: "BRAND",
        },
      });
      const brand = await db.brandProfile.create({
        data: {
          organizationId: organization.id,
          domain: `${randomUUID()}.example.com`,
          name: "Verified Brand",
          industry: "D2C",
          brandValues: [],
          policyFlags: [],
          isVerified: true,
          verifiedAt: new Date(),
        },
      });
      const brandUser = await db.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          role: "BRAND",
          authState: "ACTIVE",
          organizationId: organization.id,
          emailVerifiedAt: new Date(),
        },
      });
      const auth = {
        id: brandUser.id,
        email: brandUser.email,
        role: brandUser.role,
        name: brandUser.name,
        organizationId: organization.id,
      };
      const verifiedService = new CreatorMediaKitService(
        prisma,
        actors,
        available({
          state: "UNCONFIGURED",
          identity: {},
          profile: null,
        }) as never,
        available({
          status: "UNAVAILABLE",
          overview: { facts: [] },
          freshness: { capturedAt: null },
        }) as never,
        available({
          status: "UNAVAILABLE",
          whatYouCreate: { themes: [] },
          performance: { claims: [] },
          representatives: [],
          freshness: { capturedAt: null },
        }) as never,
        available({ items: [] }) as never,
        available({ state: "UNCONFIGURED", values: null }) as never,
        available({
          state: "UNCONFIGURED",
          values: null,
          country: { canonicalRateCardCurrency: null },
        }) as never,
        new CreatorBusinessEmailProjectionService(prisma),
        {
          resolveBrandContextReadOnly: async () => ({
            brandProfileId: brand.id,
            membership: { isActive: true, userId: brandUser.id },
          }),
        } as never,
      );
      expect(
        await verifiedService.readVerified(auth, kit.publicId),
      ).toMatchObject({
        contractVersion: "creator-media-kit-verified-v3.1",
        viewer: { kind: "VERIFIED_BRAND", brandId: brand.id },
      });
      const pdf = await verifiedService.recordVerifiedPdf(auth, kit.publicId);
      expect(pdf).toMatchObject({
        contractVersion: "creator-media-kit-pdf-v3.1",
        publicId: kit.publicId,
      });
      expect(pdf.projection).not.toHaveProperty("contractVersion");
      await db.brandProfile.update({
        where: { id: brand.id },
        data: { isVerified: false, verifiedAt: null },
      });
      await expect(
        verifiedService.readVerified(auth, kit.publicId),
      ).rejects.toThrow("Verified Brand access required");
    });
  },
);
