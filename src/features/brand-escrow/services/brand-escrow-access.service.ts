import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";

@Injectable()
export class BrandEscrowAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertBrandProfileAccess(
    user: AuthUser,
    brandProfileId: string,
  ): Promise<void> {
    if (user.role !== UserRole.BRAND) {
      throw new ForbiddenException("Brand access required");
    }
    if (!user.organizationId) {
      throw new ForbiddenException("No organization linked to this account");
    }

    const profile = await this.prisma.brandProfile.findFirst({
      where: {
        id: brandProfileId,
        organizationId: user.organizationId,
      },
      select: { id: true },
    });

    if (!profile) {
      throw new ForbiddenException("Brand profile access denied");
    }
  }

  async assertCollaborationAccess(
    user: AuthUser,
    collaborationId: string,
    brandProfileId: string,
  ) {
    const collaboration = await this.prisma.collaboration.findUnique({
      where: { id: collaborationId },
    });

    if (!collaboration) {
      throw new NotFoundException("Collaboration not found");
    }

    if (collaboration.brandProfileId !== brandProfileId) {
      throw new ForbiddenException("Collaboration access denied");
    }

    return collaboration;
  }
}
