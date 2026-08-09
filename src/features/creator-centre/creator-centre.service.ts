import { Injectable, NotFoundException } from "@nestjs/common";
import { DesignTheme } from "@prisma/client";

import type { AuthUser } from "../auth/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import { serializeMediaKit } from "../../shared/creator/media-kit-serializer";
import { CreatorSettingsAccessService } from "../creator-settings/services/creator-settings-access.service";
import type { z } from "zod";
import type { MediaKitSaveSchema } from "./schemas/creator-centre.schema";



@Injectable()

export class CreatorCentreService {

  constructor(

    private readonly prisma: PrismaService,

    private readonly access: CreatorSettingsAccessService,

  ) {}



  async getMediaKit(user: AuthUser) {

    const creatorProfile = await this.access.resolveCreatorProfile(user);

    const profile = await this.prisma.userProfile.findUnique({

      where: { userId: user.id },

    });

    if (!profile) {

      throw new NotFoundException("User profile not found.");

    }

    return {

      ...serializeMediaKit(profile, {

        instagramHandle: creatorProfile.instagramHandle,

        avatarUrl: creatorProfile.avatarUrl,

        displayName: creatorProfile.displayName,

      }),

      publicLink: this.buildPublicLink(creatorProfile.publicSlug),

    };

  }



  async getPublicLink(user: AuthUser) {

    const creatorProfile = await this.access.resolveCreatorProfile(user);

    return {

      publicSlug: creatorProfile.publicSlug,

      publicPath: this.buildPublicLink(creatorProfile.publicSlug),

      isMediaKitPublic: creatorProfile.isMediaKitPublic,

    };

  }



  async saveMediaKit(

    user: AuthUser,

    input: z.infer<typeof MediaKitSaveSchema>,

  ) {

    const creatorProfile = await this.access.resolveCreatorProfile(user);

    const updated = await this.prisma.userProfile.update({

      where: { userId: user.id },

      data: {

        customBioOverride: input.customBioOverride,

        activeTheme: input.activeTheme as DesignTheme,

        showTotalReach: input.showTotalReach,

        showEngagementRate: input.showEngagementRate,

        showViewsMetric: input.showViewsMetric,

        showRatesColumn: input.showRatesColumn,

        shortFormVideoRate: input.shortFormVideoRate,

        storyBundleRate: input.storyBundleRate,

        pastBrandLogos: input.pastBrandLogos,

      },

    });



    if (typeof input.isMediaKitPublic === "boolean") {

      await this.prisma.creatorProfile.update({

        where: { id: creatorProfile.id },

        data: { isMediaKitPublic: input.isMediaKitPublic },

      });

    }



    return {

      ...serializeMediaKit(updated, {

        instagramHandle: creatorProfile.instagramHandle,

        avatarUrl: creatorProfile.avatarUrl,

        displayName: creatorProfile.displayName,

      }),

      publicLink: this.buildPublicLink(creatorProfile.publicSlug),

    };

  }



  async getAnalyticsPulse(user: AuthUser, limitCount: number) {

    await this.access.resolveCreatorProfile(user);

    const [profile, pulses] = await Promise.all([

      this.prisma.userProfile.findUnique({ where: { userId: user.id } }),

      this.prisma.metricPostPulse.findMany({

        where: { userId: user.id },

        orderBy: { publishedAt: "desc" },

        take: limitCount,

      }),

    ]);



    return {

      summary: {

        totalReach: profile?.showTotalReach ? profile.totalReachCache : null,

        engagementRate: profile?.showEngagementRate

          ? Number(profile.engagementRateCache)

          : null,

        topLocation: profile?.topLocationCache ?? null,

      },

      pulses: pulses.map((row) => ({

        id: row.id,

        metaPostId: row.metaPostId,

        postType: row.postType,

        mediaThumbnailUrl: row.mediaThumbnailUrl,

        captionContent: row.captionContent,

        publishedAt: row.publishedAt.toISOString(),

        viewsCount: profile?.showViewsMetric ? row.viewsCount : null,

        impressionsCount: row.impressionsCount,

        savesCount: row.savesCount,

        sharesCount: row.sharesCount,

        engagementDelta: Number(row.engagementDelta),

        velocityLabel: this.velocityLabel(Number(row.engagementDelta)),

        aiPerformanceNote: row.aiPerformanceNote,

      })),

    };

  }



  private buildPublicLink(publicSlug: string | null): string | null {

    if (!publicSlug) {

      return null;

    }

    return `/api/v1/public/creators/${publicSlug}/media-kit`;

  }



  private velocityLabel(delta: number): string {

    if (delta > 50) {

      return `Over-performing by ${delta.toFixed(0)}% vs baseline`;

    }

    if (delta < -20) {

      return `Under-performing by ${Math.abs(delta).toFixed(0)}% vs baseline`;

    }

    return "On track with your 30-day baseline";

  }

}


