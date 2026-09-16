import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { isUuid } from "../../shared/creator/creator-slug.util";
import { CreatorMediaKitService } from "../creator-media-kit/creator-media-kit.service";

@Injectable()
export class PublicCreatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaKit: CreatorMediaKitService,
  ) {}

  async getPublicMediaKit(slug: string) {
    const profile = await this.resolveCreatorProfile(slug);
    if (!profile) {
      throw new NotFoundException("Creator media kit not found");
    }

    // Legacy true-by-default flags are never publication authority. This route
    // remains only as a fail-closed compatibility alias for an explicitly LIVE
    // V3 aggregate.
    return this.mediaKit.readLegacyLiveForCreatorProfile(profile.id);
  }

  private async resolveCreatorProfile(slug: string) {
    const normalized = decodeURIComponent(slug).trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (isUuid(normalized)) {
      return this.loadProfile({ id: normalized });
    }

    return this.loadProfile({ publicSlug: normalized });
  }

  private async loadProfile(where: { id: string } | { publicSlug: string }) {
    return this.prisma.creatorProfile.findUnique({
      where,
      include: {
        user: {
          include: { userProfile: true },
        },
      },
    });
  }
}
