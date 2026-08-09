import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { BrandCentreAuthService } from "../../brand-centre/brand-centre-auth.service";
import { BrandSettingsAccessService } from "../../brand-settings/services/brand-settings-access.service";

@Injectable()
export class NotificationAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brandAuth: BrandCentreAuthService,
    private readonly brandSettingsAccess: BrandSettingsAccessService,
  ) {}

  async resolveBrandWorkspace(user: AuthUser) {
    const brandProfileId = await this.brandAuth.resolveBrandProfileId(user);
    await this.brandSettingsAccess.ensureMembership(brandProfileId, user);
    return { brandProfileId, userId: user.id };
  }
}
