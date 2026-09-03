import { ForbiddenException, Injectable } from "@nestjs/common";
import { BrandRole, type BrandTeamMember } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";
import { BrandCentreAuthService } from "./brand-centre-auth.service";

export type BrandWorkspaceContext = {
  brandProfileId: string;
  membership: BrandTeamMember;
};

@Injectable()
export class BrandWorkspaceAuthorizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brandAuth: BrandCentreAuthService,
  ) {}

  /** Resolve the existing Brand scope, then require explicit active membership. */
  async resolveBrandContext(user: AuthUser): Promise<BrandWorkspaceContext> {
    const brandProfileId =
      await this.brandAuth.resolveBrandProfileIdForWorkspace(user);
    const membership = await this.prisma.brandTeamMember.findUnique({
      where: {
        brandProfileId_userId: { brandProfileId, userId: user.id },
      },
    });

    // Membership admission and reactivation belong to Team administration.
    if (
      !membership ||
      !membership.isActive ||
      membership.brandProfileId !== brandProfileId ||
      membership.userId !== user.id
    ) {
      throw new ForbiddenException("Active Brand team membership required");
    }

    return { brandProfileId, membership };
  }

  /** Consumers must scope their mutation to the returned brandProfileId. */
  async assertFinancialMutation(
    user: AuthUser,
  ): Promise<BrandWorkspaceContext> {
    const context = await this.resolveBrandContext(user);
    if (this.isFinancialReadOnly(context.membership.role)) {
      throw new ForbiddenException(
        "Financial mutations require a Brand Owner or Finance Admin",
      );
    }
    return context;
  }

  /** Role projection only; obtain the role from resolveBrandContext first. */
  isFinancialReadOnly(role: BrandRole): boolean {
    return role !== BrandRole.BRAND_OWNER && role !== BrandRole.FINANCE_ADMIN;
  }
}
