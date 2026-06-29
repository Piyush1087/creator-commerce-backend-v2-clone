import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BrandRole } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { BrandCentreAuthService } from "../../brand-centre/brand-centre-auth.service";

export const BRAND_SETTINGS_MAX_SEATS = 5;

const FINANCIAL_MUTATION_ROLES: BrandRole[] = [
  BrandRole.BRAND_OWNER,
  BrandRole.FINANCE_ADMIN,
];

@Injectable()
export class BrandSettingsAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brandAuth: BrandCentreAuthService,
  ) {}

  async resolveBrandContext(user: AuthUser) {
    const brandProfileId = await this.brandAuth.resolveBrandProfileId(user);
    const membership = await this.ensureMembership(brandProfileId, user);
    return { brandProfileId, membership };
  }

  async ensureMembership(brandProfileId: string, user: AuthUser) {
    const existing = await this.prisma.brandTeamMember.findUnique({
      where: {
        brandProfileId_userId: {
          brandProfileId,
          userId: user.id,
        },
      },
    });

    if (existing) {
      return existing;
    }

    const memberCount = await this.prisma.brandTeamMember.count({
      where: { brandProfileId, isActive: true },
    });

    return this.prisma.brandTeamMember.create({
      data: {
        brandProfileId,
        userId: user.id,
        role:
          memberCount === 0
            ? BrandRole.BRAND_OWNER
            : BrandRole.CAMPAIGN_MANAGER,
      },
    });
  }

  assertFinancialMutation(role: BrandRole): void {
    if (!FINANCIAL_MUTATION_ROLES.includes(role)) {
      throw new ForbiddenException(
        "Read-only: contact a Finance Admin or Brand Owner to modify billing and withdrawal settings.",
      );
    }
  }

  assertTeamAdmin(role: BrandRole): void {
    if (role === BrandRole.CAMPAIGN_MANAGER) {
      throw new ForbiddenException(
        "Campaign Managers cannot manage team membership.",
      );
    }
  }

  async getMembershipOrThrow(membershipId: string, brandProfileId: string) {
    const membership = await this.prisma.brandTeamMember.findFirst({
      where: { id: membershipId, brandProfileId, isActive: true },
      include: { user: true },
    });
    if (!membership) {
      throw new NotFoundException("Team membership not found");
    }
    return membership;
  }

  isFinancialReadOnly(role: BrandRole): boolean {
    return role === BrandRole.CAMPAIGN_MANAGER;
  }
}
