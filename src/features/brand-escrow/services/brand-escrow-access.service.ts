import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { BrandWorkspaceAuthorizationService } from "../../brand-centre/brand-workspace-authorization.service";

@Injectable()
export class BrandEscrowAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: BrandWorkspaceAuthorizationService,
  ) {}

  async assertBrandProfileAccess(
    user: AuthUser,
    brandProfileId: string,
  ): Promise<void> {
    const context = await this.workspace.resolveBrandContext(user);
    if (context.brandProfileId !== brandProfileId) {
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
