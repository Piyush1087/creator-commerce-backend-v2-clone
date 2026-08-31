import { randomUUID } from "node:crypto";
import { ForbiddenException } from "@nestjs/common";
import {
  BrandRole,
  PrismaClient,
  UserAuthState,
  UserRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaService } from "../../prisma/prisma.service";
import { BrandCentreAuthService } from "./brand-centre-auth.service";
import { BrandWorkspaceAuthorizationService } from "./brand-workspace-authorization.service";
import { BrandCentreSessionEvictionService } from "./services/brand-centre-session-eviction.service";

// Opt in only against a disposable, loopback PostgreSQL database named bs07_*.
describe.skipIf(process.env.BRAND_WORKSPACE_DATABASE_TEST !== "true")(
  "Brand workspace authorization PostgreSQL isolation",
  () => {
    const prisma = new PrismaClient({
      log: [{ emit: "event", level: "query" }],
    });
    const queries: string[] = [];
    prisma.$on("query", (event) => queries.push(event.query));
    const db = prisma as unknown as PrismaService;
    const service = new BrandWorkspaceAuthorizationService(
      db,
      new BrandCentreAuthService(db, new BrandCentreSessionEvictionService(db)),
    );
    const brandIds: string[] = [];
    const userIds: string[] = [];
    const organizationIds: string[] = [];

    beforeAll(() => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !url.pathname.startsWith("/bs07_")
      ) {
        throw new Error(
          "BS-07 tests require a disposable local bs07_* database",
        );
      }
    });

    afterAll(async () => {
      try {
        // Delete only this suite's fixtures, never reset a shared database.
        if (brandIds.length) {
          await prisma.brandProfile.deleteMany({
            where: { id: { in: brandIds } },
          });
        }
        if (userIds.length) {
          await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        }
        if (organizationIds.length) {
          await prisma.organization.deleteMany({
            where: { id: { in: organizationIds } },
          });
        }
      } finally {
        await prisma.$disconnect();
      }
    });

    async function workspace(role: UserRole = UserRole.BRAND) {
      const organization = await prisma.organization.create({
        data: { name: "BS-07 disposable authorization test", kind: "BRAND" },
      });
      organizationIds.push(organization.id);
      const brand = await prisma.brandProfile.create({
        data: {
          organizationId: organization.id,
          domain: `${randomUUID()}.example.test`,
          name: "BS-07 test Brand",
          industry: "D2C",
        },
      });
      brandIds.push(brand.id);
      const actorOrganization =
        role === UserRole.CREATOR
          ? await prisma.organization.create({
              data: {
                name: "BS-07 Creator authorization test",
                kind: "CREATOR",
              },
            })
          : null;
      if (actorOrganization) organizationIds.push(actorOrganization.id);
      const user = await prisma.user.create({
        data: {
          organizationId:
            role === UserRole.BRAND
              ? organization.id
              : (actorOrganization?.id ?? null),
          email: `${randomUUID()}@example.test`,
          role,
          authState: UserAuthState.ACTIVE,
        },
      });
      userIds.push(user.id);
      return { brand, user };
    }

    async function withoutMembershipWrites(action: () => Promise<void>) {
      const membershipSnapshot = () =>
        prisma.brandTeamMember.findMany({
          where: { brandProfileId: { in: brandIds } },
          orderBy: { id: "asc" },
        });
      const before = await membershipSnapshot();
      const queryOffset = queries.length;
      await action();
      const membershipQueries = queries
        .slice(queryOffset)
        .filter((query) => query.includes('"brand_team_members"'));
      expect(
        membershipQueries.filter((query) =>
          /\b(INSERT|UPDATE|DELETE|MERGE)\b/iu.test(query),
        ),
      ).toEqual([]);
      expect(await membershipSnapshot()).toEqual(before);
    }

    it.each([BrandRole.BRAND_OWNER, BrandRole.FINANCE_ADMIN])(
      "allows active %s without modifying any membership",
      async (role) => {
        const { brand, user } = await workspace();
        const membership = await prisma.brandTeamMember.create({
          data: { brandProfileId: brand.id, userId: user.id, role },
        });

        await withoutMembershipWrites(async () => {
          await expect(service.assertFinancialMutation(user)).resolves.toEqual({
            brandProfileId: brand.id,
            membership,
          });
        });
      },
    );

    it("allows Campaign Manager context but denies financial mutation", async () => {
      const { brand, user } = await workspace();
      const membership = await prisma.brandTeamMember.create({
        data: {
          brandProfileId: brand.id,
          userId: user.id,
          role: BrandRole.CAMPAIGN_MANAGER,
        },
      });

      await withoutMembershipWrites(async () => {
        const context = await service.resolveBrandContext(user);
        expect(context.membership).toEqual(membership);
        expect(service.isFinancialReadOnly(context.membership.role)).toBe(true);
        await expect(
          service.assertFinancialMutation(user),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });
    });

    it("does not infer or create membership for a user in the Brand organization", async () => {
      const { brand, user } = await workspace();

      await withoutMembershipWrites(async () => {
        await expect(service.resolveBrandContext(user)).rejects.toBeInstanceOf(
          ForbiddenException,
        );
        await expect(
          service.assertFinancialMutation(user),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });
      expect(
        await prisma.brandTeamMember.count({
          where: { brandProfileId: brand.id },
        }),
      ).toBe(0);
    });

    it("does not reactivate an inactive Owner membership", async () => {
      const { brand, user } = await workspace();
      await prisma.brandTeamMember.create({
        data: {
          brandProfileId: brand.id,
          userId: user.id,
          role: BrandRole.BRAND_OWNER,
          isActive: false,
        },
      });

      await withoutMembershipWrites(async () => {
        await expect(service.resolveBrandContext(user)).rejects.toBeInstanceOf(
          ForbiddenException,
        );
        await expect(
          service.assertFinancialMutation(user),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });
    });

    it("rejects an Owner membership belonging to another Brand", async () => {
      const current = await workspace();
      const foreign = await workspace();
      await prisma.brandTeamMember.create({
        data: {
          brandProfileId: foreign.brand.id,
          userId: current.user.id,
          role: BrandRole.BRAND_OWNER,
        },
      });

      await withoutMembershipWrites(async () => {
        await expect(
          service.resolveBrandContext(current.user),
        ).rejects.toBeInstanceOf(ForbiddenException);
        await expect(
          service.assertFinancialMutation(current.user),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });
    });

    it("does not borrow another user's Owner membership in the same Brand", async () => {
      const { brand, user } = await workspace();
      const teammate = await prisma.user.create({
        data: {
          organizationId: user.organizationId,
          email: `${randomUUID()}@example.test`,
          role: UserRole.BRAND,
          authState: UserAuthState.ACTIVE,
        },
      });
      userIds.push(teammate.id);
      await prisma.brandTeamMember.create({
        data: {
          brandProfileId: brand.id,
          userId: teammate.id,
          role: BrandRole.BRAND_OWNER,
        },
      });

      await withoutMembershipWrites(async () => {
        await expect(
          service.assertFinancialMutation(user),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });
    });

    it("uses the current Brand role even when the same user owns another Brand", async () => {
      const current = await workspace();
      const foreign = await workspace();
      await prisma.brandTeamMember.createMany({
        data: [
          {
            brandProfileId: current.brand.id,
            userId: current.user.id,
            role: BrandRole.CAMPAIGN_MANAGER,
          },
          {
            brandProfileId: foreign.brand.id,
            userId: current.user.id,
            role: BrandRole.BRAND_OWNER,
          },
        ],
      });

      await withoutMembershipWrites(async () => {
        const context = await service.resolveBrandContext(current.user);
        expect(context.brandProfileId).toBe(current.brand.id);
        expect(context.membership.role).toBe(BrandRole.CAMPAIGN_MANAGER);
        await expect(
          service.assertFinancialMutation(current.user),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });
    });

    it.each([UserRole.CREATOR, UserRole.ADMIN])(
      "rejects a %s actor even with an active Owner membership",
      async (role) => {
        const { brand, user } = await workspace(role);
        await prisma.brandTeamMember.create({
          data: {
            brandProfileId: brand.id,
            userId: user.id,
            role: BrandRole.BRAND_OWNER,
          },
        });

        await withoutMembershipWrites(async () => {
          await expect(
            service.resolveBrandContext(user),
          ).rejects.toBeInstanceOf(ForbiddenException);
          await expect(
            service.assertFinancialMutation(user),
          ).rejects.toBeInstanceOf(ForbiddenException);
        });
      },
    );
  },
);
