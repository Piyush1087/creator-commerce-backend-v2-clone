import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UserAuthState, UserRole, type Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";
import { BrandCentreSessionEvictionService } from "./services/brand-centre-session-eviction.service";

@Injectable()
export class BrandCentreAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionEviction: BrandCentreSessionEvictionService,
  ) {}

  async resolveBrandProfileId(user: AuthUser): Promise<string> {
    const brandProfileId = await this.resolveBrandProfileIdInTransaction(
      this.prisma,
      user,
    );
    await this.sessionEviction.evictIfInactive(brandProfileId);
    await this.sessionEviction.touchActivity(brandProfileId);
    return brandProfileId;
  }

  /** Reuse current Brand membership authority without session side effects. */
  async resolveBrandProfileIdInTransaction(
    tx: Prisma.TransactionClient,
    user: AuthUser,
  ): Promise<string> {
    const current = await tx.user.findUnique({
      where: { id: user.id },
      include: {
        brandTeamMemberships: {
          where: { isActive: true },
          include: {
            brandProfile: { select: { id: true, organizationId: true } },
          },
        },
      },
    });
    if (
      !current ||
      current.role !== UserRole.BRAND ||
      current.authState !== UserAuthState.ACTIVE
    ) {
      throw new ForbiddenException(
        "Brand Centre is available to active brand users only",
      );
    }
    const candidates = current.brandTeamMemberships.filter(
      (membership) =>
        !current.organizationId ||
        membership.brandProfile.organizationId === current.organizationId,
    );
    if (candidates.length !== 1) {
      throw new ForbiddenException("Active Brand team membership required");
    }
    return candidates[0].brandProfileId;
  }

  async resolveBrandProfile(user: AuthUser) {
    const brandProfileId = await this.resolveBrandProfileId(user);
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }
    return profile;
  }
}
