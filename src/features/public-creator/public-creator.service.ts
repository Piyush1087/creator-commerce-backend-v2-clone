import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { serializeMediaKit } from "../../shared/creator/media-kit-serializer";
import { isUuid } from "../../shared/creator/creator-slug.util";

@Injectable()
export class PublicCreatorService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicMediaKit(slug: string) {
    const profile = await this.resolveCreatorProfile(slug);
    if (!profile) {
      throw new NotFoundException("Creator media kit not found");
    }

    if (!profile.isMediaKitPublic) {
      throw new NotFoundException("Creator media kit not found");
    }

    const userProfile = profile.user.userProfile;
    if (!userProfile) {
      throw new NotFoundException("Creator media kit not found");
    }

    return {
      slug: profile.publicSlug,
      creator_id: profile.id,
      media_kit: serializeMediaKit(userProfile, {
        instagramHandle: profile.instagramHandle,
        avatarUrl: profile.avatarUrl,
        displayName: profile.displayName,
      }),
    };
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

  private async loadProfile(
    where: { id: string } | { publicSlug: string },
  ) {
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
