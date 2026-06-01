import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";

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
    if (user.role !== UserRole.BRAND) {
      throw new ForbiddenException(
        "Brand Centre is available to brand users only",
      );
    }
    if (!user.organizationId) {
      throw new ForbiddenException("No organization linked to this account");
    }

    const profile = await this.prisma.brandProfile.findUnique({
      where: { organizationId: user.organizationId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException(
        "Brand profile not found for this organization",
      );
    }

    await this.sessionEviction.evictIfInactive(profile.id);
    await this.sessionEviction.touchActivity(profile.id);

    return profile.id;
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
