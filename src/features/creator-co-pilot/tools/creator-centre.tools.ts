import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { CreatorSettingsAccessService } from "../../creator-settings/services/creator-settings-access.service";

@Injectable()
export class CreatorCoPilotToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreatorSettingsAccessService,
  ) {}

  async getCreatorReadContext(user: AuthUser) {
    const creatorProfile = await this.access.resolveCreatorProfile(user);
    const [userProfile, pulses, integrations] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { userId: user.id } }),
      this.prisma.metricPostPulse.findMany({
        where: { userId: user.id },
        orderBy: { engagementDelta: "desc" },
        take: 5,
      }),
      this.prisma.creatorSocialIntegration.findMany({
        where: { creatorProfileId: creatorProfile.id },
      }),
    ]);

    return {
      creatorProfileId: creatorProfile.id,
      handle: creatorProfile.instagramHandle,
      followerCount: creatorProfile.followerCount,
      mediaKit: userProfile,
      topPosts: pulses,
      connectedPlatforms: integrations.map((row) => row.platformNetwork),
      canonicalStats: {
        totalReach:
          userProfile?.totalReachCache ?? creatorProfile.followerCount,
        engagementRate: Number(userProfile?.engagementRateCache ?? 0),
        shortFormVideoRate: Number(userProfile?.shortFormVideoRate ?? 0),
        storyBundleRate: Number(userProfile?.storyBundleRate ?? 0),
      },
    };
  }
}
