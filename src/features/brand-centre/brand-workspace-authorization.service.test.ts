import { ForbiddenException } from "@nestjs/common";
import {
  BrandRole,
  UserAuthState,
  UserRole,
  type BrandTeamMember,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";
import { BrandCentreAuthService } from "./brand-centre-auth.service";
import { BrandWorkspaceAuthorizationService } from "./brand-workspace-authorization.service";
import type { BrandCentreSessionEvictionService } from "./services/brand-centre-session-eviction.service";

describe("BrandWorkspaceAuthorizationService current authority", () => {
  const actor: AuthUser = {
    id: "user-1",
    email: "stale-token@example.test",
    name: "Stale token projection",
    role: UserRole.CREATOR,
    organizationId: "stale-organization",
  };
  const membership: BrandTeamMember = {
    id: "membership-1",
    brandProfileId: "brand-1",
    userId: actor.id,
    role: BrandRole.BRAND_OWNER,
    isActive: true,
    joinedAt: new Date("2026-08-26T00:00:00Z"),
    updatedAt: new Date("2026-08-26T00:00:00Z"),
  };
  const prisma = {
    user: { findUnique: vi.fn() },
    brandProfile: { findUnique: vi.fn() },
    brandTeamMember: { findUnique: vi.fn() },
  };
  const sessions = {
    evictIfInactive: vi.fn(),
    touchActivity: vi.fn(),
  };
  const auth = new BrandCentreAuthService(
    prisma as unknown as PrismaService,
    sessions as unknown as BrandCentreSessionEvictionService,
  );
  const service = new BrandWorkspaceAuthorizationService(
    prisma as unknown as PrismaService,
    auth,
  );

  function currentUser(overrides: Record<string, unknown> = {}) {
    return {
      id: actor.id,
      role: UserRole.BRAND,
      authState: UserAuthState.ACTIVE,
      organizationId: "organization-1",
      brandTeamMemberships: [
        {
          ...membership,
          brandProfile: {
            id: membership.brandProfileId,
            organizationId: "organization-1",
          },
        },
      ],
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.user.findUnique.mockResolvedValue(currentUser());
    prisma.brandTeamMember.findUnique.mockResolvedValue(membership);
  });

  it.each([
    [BrandRole.BRAND_OWNER, false],
    [BrandRole.FINANCE_ADMIN, false],
    [BrandRole.CAMPAIGN_MANAGER, true],
  ])(
    "uses current %s membership, not stale JWT claims",
    async (role, readOnly) => {
      const currentMembership = { ...membership, role };
      prisma.brandTeamMember.findUnique.mockResolvedValue(currentMembership);
      const context = await service.resolveBrandContext(actor);
      expect(context).toEqual({
        brandProfileId: "brand-1",
        membership: currentMembership,
      });
      expect(service.isFinancialReadOnly(role)).toBe(readOnly);
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: actor.id } }),
      );
    },
  );

  it("denies immediately after current membership removal", async () => {
    prisma.user.findUnique.mockResolvedValue(
      currentUser({ brandTeamMemberships: [] }),
    );
    await expect(service.resolveBrandContext(actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.brandTeamMember.findUnique).not.toHaveBeenCalled();
  });

  it.each([UserAuthState.DISABLED, UserAuthState.PROVISIONAL])(
    "denies current %s authentication state",
    async (authState) => {
      prisma.user.findUnique.mockResolvedValue(currentUser({ authState }));
      await expect(service.resolveBrandContext(actor)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    },
  );

  it("denies an inactive membership even if the identity query was stale", async () => {
    prisma.brandTeamMember.findUnique.mockResolvedValue({
      ...membership,
      isActive: false,
    });
    await expect(service.resolveBrandContext(actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("allows financial mutation only for current Owner or Finance role", async () => {
    prisma.brandTeamMember.findUnique.mockResolvedValue({
      ...membership,
      role: BrandRole.CAMPAIGN_MANAGER,
    });
    await expect(service.assertFinancialMutation(actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
