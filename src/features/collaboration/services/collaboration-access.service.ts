import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { BrandWorkspaceAuthorizationService } from "../../brand-centre/brand-workspace-authorization.service";

export const COLLABORATION_THREAD_INCLUDE = {
  sourceApplication: { select: { canonicalBriefId: true, snapshot: true } },
  campaign: { select: { name: true, brandProfileId: true } },
  brief: { select: { internalTitle: true, creativeGuidelines: true } },
  brandProfile: { select: { name: true, id: true } },
  creatorUser: {
    select: {
      id: true,
      name: true,
      email: true,
      creatorProfile: {
        select: { displayName: true, instagramHandle: true },
      },
    },
  },
  commercials: true,
  logistics: true,
  finalization: true,
  media: { orderBy: { createdAt: "desc" as const }, take: 5 },
} as const;

@Injectable()
export class CollaborationAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: BrandWorkspaceAuthorizationService,
  ) {}

  async resolveBrandProfileId(user: AuthUser): Promise<string> {
    return (await this.workspace.resolveBrandContext(user)).brandProfileId;
  }

  async assertThreadForUser(user: AuthUser, collaborationId: string) {
    const thread = await this.prisma.collaboration.findUnique({
      where: { id: collaborationId },
      include: COLLABORATION_THREAD_INCLUDE,
    });
    if (!thread) {
      throw new NotFoundException("Collaboration not found");
    }

    if (user.role === UserRole.BRAND) {
      const brandProfileId = await this.resolveBrandProfileId(user);
      if (thread.brandProfileId !== brandProfileId) {
        throw new NotFoundException("Collaboration not found");
      }
    } else if (user.role === UserRole.CREATOR) {
      if (thread.creatorUserId !== user.id) {
        throw new NotFoundException("Collaboration not found");
      }
    } else {
      throw new ForbiddenException("Unsupported role for collaboration access");
    }

    return thread;
  }
}
