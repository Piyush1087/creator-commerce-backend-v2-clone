import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { BrandRole, UserRole, type BrandTeamMember } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";
import { BrandCentreAuthService } from "./brand-centre-auth.service";
import { BrandWorkspaceAuthorizationService } from "./brand-workspace-authorization.service";
import type { BrandCentreSessionEvictionService } from "./services/brand-centre-session-eviction.service";

describe("BrandWorkspaceAuthorizationService", () => {
  const user: AuthUser = {
    id: "user-1",
    email: "brand@example.test",
    name: "Brand user",
    role: UserRole.BRAND,
    organizationId: "organization-1",
  };
  const member: BrandTeamMember = {
    id: "membership-1",
    brandProfileId: "brand-1",
    userId: user.id,
    role: BrandRole.BRAND_OWNER,
    isActive: true,
    joinedAt: new Date("2026-08-26T00:00:00Z"),
    updatedAt: new Date("2026-08-26T00:00:00Z"),
  };
  const writes = {
    create: vi.fn(),
    createMany: vi.fn(),
    createManyAndReturn: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    updateManyAndReturn: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  };
  const prisma = {
    brandProfile: { findUnique: vi.fn() },
    brandTeamMember: { findUnique: vi.fn(), ...writes },
  };
  const sessions = {
    evictIfInactive: vi.fn(),
    touchActivity: vi.fn(),
  };
  // Partial test doubles; exercise the real Brand resolver and authorization.
  const auth = new BrandCentreAuthService(
    prisma as unknown as PrismaService,
    sessions as unknown as BrandCentreSessionEvictionService,
  );
  const service = new BrandWorkspaceAuthorizationService(
    prisma as unknown as PrismaService,
    auth,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.brandProfile.findUnique.mockResolvedValue({ id: "brand-1" });
    prisma.brandTeamMember.findUnique.mockResolvedValue(member);
  });

  afterEach(() => {
    // Every success and denial must leave admission, roles and active state intact.
    for (const write of Object.values(writes)) {
      expect(write).not.toHaveBeenCalled();
    }
  });

  it.each([
    [BrandRole.BRAND_OWNER, false],
    [BrandRole.FINANCE_ADMIN, false],
    [BrandRole.CAMPAIGN_MANAGER, true],
  ])(
    "resolves active %s membership and financial read-only state",
    async (role, readOnly) => {
      const membership = { ...member, role };
      prisma.brandTeamMember.findUnique.mockResolvedValue(membership);

      const context = await service.resolveBrandContext(user);

      expect(context).toEqual({ brandProfileId: "brand-1", membership });
      expect(service.isFinancialReadOnly(context.membership.role)).toBe(
        readOnly,
      );
      expect(prisma.brandProfile.findUnique).toHaveBeenCalledWith({
        where: { organizationId: user.organizationId },
        select: { id: true },
      });
      expect(prisma.brandTeamMember.findUnique).toHaveBeenCalledOnce();
      expect(prisma.brandTeamMember.findUnique).toHaveBeenCalledWith({
        where: {
          brandProfileId_userId: { brandProfileId: "brand-1", userId: user.id },
        },
      });
      expect(sessions.evictIfInactive).toHaveBeenCalledWith("brand-1");
      expect(sessions.touchActivity).toHaveBeenCalledWith("brand-1");
    },
  );

  it.each([BrandRole.BRAND_OWNER, BrandRole.FINANCE_ADMIN])(
    "allows financial mutation for active %s in the current Brand",
    async (role) => {
      const membership = { ...member, role };
      prisma.brandTeamMember.findUnique.mockResolvedValue(membership);

      await expect(service.assertFinancialMutation(user)).resolves.toEqual({
        brandProfileId: "brand-1",
        membership,
      });
      expect(prisma.brandTeamMember.findUnique).toHaveBeenCalledOnce();
    },
  );

  it.each([BrandRole.CAMPAIGN_MANAGER, "UNKNOWN_ROLE" as BrandRole])(
    "denies financial mutation for %s",
    async (role) => {
      prisma.brandTeamMember.findUnique.mockResolvedValue({ ...member, role });

      await expect(
        service.assertFinancialMutation(user),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(service.isFinancialReadOnly(role)).toBe(true);
    },
  );

  describe.each(["resolveBrandContext", "assertFinancialMutation"] as const)(
    "%s membership boundary",
    (method) => {
      it.each([
        ["missing", null],
        ["inactive", { ...member, isActive: false }],
        ["cross-Brand", { ...member, brandProfileId: "brand-other" }],
        ["wrong-user", { ...member, userId: "user-other" }],
      ])(
        "rejects %s membership without creating or repairing it",
        async (_label, membership) => {
          prisma.brandTeamMember.findUnique.mockResolvedValue(membership);

          await expect(service[method](user)).rejects.toBeInstanceOf(
            ForbiddenException,
          );
        },
      );

      it.each([UserRole.CREATOR, UserRole.ADMIN])(
        "rejects a %s actor before membership lookup",
        async (role) => {
          await expect(
            service[method]({ ...user, role }),
          ).rejects.toBeInstanceOf(ForbiddenException);
          expect(prisma.brandProfile.findUnique).not.toHaveBeenCalled();
          expect(prisma.brandTeamMember.findUnique).not.toHaveBeenCalled();
        },
      );

      it("preserves denial of an actor without an organization", async () => {
        await expect(
          service[method]({ ...user, organizationId: null }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.brandTeamMember.findUnique).not.toHaveBeenCalled();
      });

      it("preserves rejection of an organization without a Brand profile", async () => {
        prisma.brandProfile.findUnique.mockResolvedValue(null);

        await expect(service[method](user)).rejects.toBeInstanceOf(
          NotFoundException,
        );
        expect(prisma.brandTeamMember.findUnique).not.toHaveBeenCalled();
      });

      it("propagates lookup failure without creating a membership", async () => {
        const failure = new Error("Membership lookup unavailable");
        prisma.brandTeamMember.findUnique.mockRejectedValue(failure);

        await expect(service[method](user)).rejects.toBe(failure);
      });
    },
  );
});
