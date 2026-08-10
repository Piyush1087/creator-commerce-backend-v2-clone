import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";

export const COLLABORATION_THREAD_INCLUDE = {
  campaign: { select: { name: true, brandProfileId: true } },
  brief: { select: { internalTitle: true, creativeGuidelines: true } },
  product: {
    select: {
      id: true,
      productName: true,
      assetType: true,
      skuCode: true,
      imageUrl: true,
    },
  },
  brandProfile: { select: { name: true, id: true, countryCode: true } },
  creatorUser: {
    select: {
      id: true,
      name: true,
      email: true,
      creatorProfile: {
        select: { id: true, displayName: true, instagramHandle: true },
      },
    },
  },
  commercials: true,
  logistics: true,
  finalization: true,
  media: { orderBy: { createdAt: "desc" as const }, take: 5 },
  snapshot: true,
  commercialAgreement: true,
  fulfillment: {
    include: { issues: { orderBy: { sequence: "asc" as const } } },
  },
  financialResolution: true,
  settlement: true,
  deliverables: {
    orderBy: { displayOrder: "asc" as const },
    include: {
      publishing: {
        include: {
          evidenceHistory: { orderBy: { sequence: "asc" as const } },
        },
      },
      submissions: { orderBy: { versionNumber: "asc" as const } },
    },
  },
} as const;

@Injectable()
export class CollaborationAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveBrandProfileId(user: AuthUser): Promise<string> {
    if (user.role !== UserRole.BRAND) {
      throw new ForbiddenException("Brand access required");
    }
    if (!user.organizationId) {
      throw new ForbiddenException("Brand organization not linked");
    }
    const profile = await this.prisma.brandProfile.findFirst({
      where: { organizationId: user.organizationId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }
    return profile.id;
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
