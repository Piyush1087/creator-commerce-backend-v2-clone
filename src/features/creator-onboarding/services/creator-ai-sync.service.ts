import { Injectable, Logger } from "@nestjs/common";

import { CoPilotFormatType, OnboardingStatus, Prisma } from "@prisma/client";

import { randomUUID } from "crypto";



import { GeminiJsonClient } from "../../brand-onboarding/integrations/gemini/gemini-json.client";

import { PrismaService } from "../../../prisma/prisma.service";

import { InstagramGraphClient } from "../../instagram/instagram-graph.client";

import { InstagramConnectService } from "../../instagram/instagram-connect.service";

import { assignUniquePublicSlug } from "../../../shared/creator/assign-public-slug.util";

import { loadCreatorOnboardingPrompt } from "../prompts/prompt-loader";



type MediaMetricRow = {

  row: {

    id: string;

    mediaType: string;

    mediaUrl: string | null;

    thumbnailUrl: string | null;

    caption: string | null;

    timestamp: string;

  };

  insights: {

    impressions: number;

    reach: number;

    saves: number;

    shares: number;

    views: number;

  };

  impressions: number;

  engagementRate: number;

};



const SYNC_TX_TIMEOUT_MS = 20_000;



@Injectable()

export class CreatorAiSyncService {

  private readonly logger = new Logger(CreatorAiSyncService.name);



  constructor(

    private readonly prisma: PrismaService,

    private readonly graph: InstagramGraphClient,

    private readonly instagram: InstagramConnectService,

    private readonly gemini: GeminiJsonClient,

  ) {}



  async runActivationSync(

    userId: string,

    onboardingTrackId: string,

  ): Promise<void> {

    const track = await this.prisma.creatorOnboardingTrack.findUnique({

      where: { id: onboardingTrackId },

      include: {

        user: { include: { creatorProfile: true, userProfile: true } },

      },

    });

    if (!track?.userId || track.userId !== userId) {

      throw new Error("Onboarding track not found for user");

    }



    try {

      const token = await this.instagram.getActiveAccessTokenForUser(userId);

      const profile = await this.graph.fetchMe(token);

      const media = await this.graph.fetchRecentMedia(token, 30);

      const mediaMetrics = await this.collectMediaMetrics(media, token);



      const baseline =

        mediaMetrics.length > 0

          ? mediaMetrics.reduce((sum, item) => sum + item.engagementRate, 0) /

            mediaMetrics.length

          : 0;



      const creatorProfile = track.user?.creatorProfile;

      let publicSlug: string | undefined;

      if (!creatorProfile?.publicSlug) {

        publicSlug = await assignUniquePublicSlug(

          this.prisma,

          profile.username,

          creatorProfile?.id,

        );

      }



      const engagementRateCache = Number((baseline * 100).toFixed(2));



      await this.prisma.$transaction(

        async (tx: Prisma.TransactionClient) => {

          for (const metric of mediaMetrics) {

            const engagementDelta =

              baseline > 0

                ? Number(

                    ((metric.engagementRate / baseline - 1) * 100).toFixed(2),

                  )

                : 0;



            const aiPerformanceNote = this.buildPostPulseNote({

              postType: metric.row.mediaType,

              engagementDelta,

              savesCount: metric.insights.saves,

              sharesCount: metric.insights.shares,

            });



            await tx.metricPostPulse.upsert({

              where: { metaPostId: metric.row.id },

              create: {

                userId,

                metaPostId: metric.row.id,

                postType: metric.row.mediaType,

                mediaThumbnailUrl:

                  metric.row.thumbnailUrl ?? metric.row.mediaUrl ?? "",

                captionContent: metric.row.caption,

                publishedAt: new Date(metric.row.timestamp),

                viewsCount: metric.insights.views,

                impressionsCount: metric.impressions,

                savesCount: metric.insights.saves,

                sharesCount: metric.insights.shares,

                engagementDelta,

                aiPerformanceNote,

              },

              update: {

                viewsCount: metric.insights.views,

                impressionsCount: metric.impressions,

                savesCount: metric.insights.saves,

                sharesCount: metric.insights.shares,

                engagementDelta,

                aiPerformanceNote,

              },

            });

          }



          await tx.userProfile.upsert({

            where: { userId },

            create: {

              userId,

              displayName: profile.name ?? profile.username,

              totalReachCache: profile.followersCount,

              engagementRateCache,

            },

            update: {

              displayName: profile.name ?? profile.username,

              totalReachCache: profile.followersCount,

              engagementRateCache,

            },

          });



          await tx.creatorProfile.update({

            where: { userId },

            data: {

              displayName: profile.name ?? profile.username,

              instagramHandle: profile.username,

              avatarUrl: profile.profilePictureUrl,

              followerCount: profile.followersCount,

              ...(publicSlug ? { publicSlug } : {}),

            },

          });



          await tx.creatorOnboardingTrack.update({

            where: { id: onboardingTrackId },

            data: { status: OnboardingStatus.AI_ENGINE_SYNCED },

          });

        },

        { timeout: SYNC_TX_TIMEOUT_MS },

      );



      const pulses = await this.prisma.metricPostPulse.findMany({

        where: { userId },

        orderBy: { publishedAt: "desc" },

        take: 30,

      });



      const welcomeText = await this.generateWelcomeInsight({

        instagramHandle: profile.username,

        detectedVertical: track.detectedVertical,

        eligibilityScore: track.eligibilityScore,

        engagementRateCache,

        pulses,

      });



      await this.seedCoPilotWelcome(userId, welcomeText);

      this.logger.log(

        `Creator AI sync completed userId=${userId} pulses=${mediaMetrics.length}`,

      );

    } catch (err) {

      this.logger.error(

        `AI sync failed track=${onboardingTrackId}: ${String(err)}`,

      );

      await this.markTrackSyncedBestEffort(onboardingTrackId);

    }

  }



  private async collectMediaMetrics(
    media: Array<{
      id: string;
      mediaType: string;
      mediaUrl: string | null;
      thumbnailUrl: string | null;
      caption: string | null;
      timestamp: string;
    }>,
    token: string,
  ): Promise<MediaMetricRow[]> {
    const rows: MediaMetricRow[] = [];
    let skipInsightsForOlderPosts = false;
    let skippedPreConversionCount = 0;

    for (const row of media) {
      let insights;
      if (skipInsightsForOlderPosts) {
        skippedPreConversionCount += 1;
        insights = {
          impressions: 0,
          reach: 0,
          saves: 0,
          shares: 0,
          views: 0,
        };
      } else {
        insights = await this.graph.fetchMediaInsights(row.id, token, row.mediaType);
        if (insights.unavailableReason === "pre_business_conversion") {
          skipInsightsForOlderPosts = true;
          skippedPreConversionCount += 1;
        }
      }

      const impressions = Math.max(insights.impressions, insights.reach, 1);
      const engagementRate =
        impressions > 0
          ? (insights.saves + insights.shares) / impressions
          : this.estimateEngagementRate(row);

      rows.push({
        row,
        insights,
        impressions,
        engagementRate,
      });
    }

    if (skippedPreConversionCount > 0) {
      this.logger.log(
        `Skipped Instagram insights for ${skippedPreConversionCount} post(s) published before the account was switched to a professional account.`,
      );
    }

    return rows;
  }



  private async markTrackSyncedBestEffort(

    onboardingTrackId: string,

  ): Promise<void> {

    try {

      await this.prisma.creatorOnboardingTrack.update({

        where: { id: onboardingTrackId },

        data: { status: OnboardingStatus.AI_ENGINE_SYNCED },

      });

    } catch (markErr) {

      this.logger.warn(

        `Could not mark track synced after failure: ${String(markErr)}`,

      );

    }

  }



  async runStubActivationSync(

    userId: string,

    onboardingTrackId: string,

  ): Promise<void> {

    const track = await this.prisma.creatorOnboardingTrack.findUnique({

      where: { id: onboardingTrackId },

      include: {

        user: { include: { creatorProfile: true, userProfile: true } },

      },

    });

    if (!track?.userId || track.userId !== userId) {

      throw new Error("Onboarding track not found for user");

    }



    const handle = track.instagramHandle;

    const creatorProfile = track.user?.creatorProfile;

    let publicSlug: string | undefined;

    if (!creatorProfile?.publicSlug) {

      publicSlug = await assignUniquePublicSlug(

        this.prisma,

        handle,

        creatorProfile?.id,

      );

    }



    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {

      await tx.userProfile.upsert({

        where: { userId },

        create: {

          userId,

          displayName: creatorProfile?.displayName ?? handle,

        },

        update: {

          displayName: creatorProfile?.displayName ?? handle,

        },

      });



      await tx.creatorProfile.update({

        where: { userId },

        data: {

          instagramHandle: handle,

          ...(publicSlug ? { publicSlug } : {}),

        },

      });



      await tx.creatorOnboardingTrack.update({

        where: { id: onboardingTrackId },

        data: { status: OnboardingStatus.AI_ENGINE_SYNCED },

      });

    });



    const welcomeText = `Hey @${handle}, your workspace shell is live. Connect Instagram in settings when you're ready — we'll sync your media kit and performance data automatically.`;



    await this.seedCoPilotWelcome(userId, welcomeText);

    this.logger.log(`Creator stub sync completed userId=${userId}`);

  }



  private estimateEngagementRate(row: { mediaType: string }): number {

    return row.mediaType === "VIDEO" || row.mediaType === "REEL" ? 0.06 : 0.03;

  }



  private buildPostPulseNote(metrics: {

    postType: string;

    engagementDelta: number;

    savesCount: number;

    sharesCount: number;

  }): string {

    if (metrics.savesCount + metrics.sharesCount === 0) {

      return "Insights limited for this post — metrics may be unavailable for content posted before your professional account switch.";

    }

    if (metrics.engagementDelta > 50) {

      return "Saves and shares are driving this push.";

    }

    return "On track with your recent baseline.";

  }



  private async generateWelcomeInsight(args: {

    instagramHandle: string;

    detectedVertical: string;

    eligibilityScore: number;

    engagementRateCache: number;

    pulses: Array<{ metaPostId: string; engagementDelta: unknown }>;

  }): Promise<string> {

    try {

      const systemInstruction = loadCreatorOnboardingPrompt(

        "welcome-insight.prompt.md",

      );

      const userText = [

        `Instagram Handle: @${args.instagramHandle}`,

        `Vertical: ${args.detectedVertical}`,

        `Eligibility Score: ${args.eligibilityScore}`,

        `Engagement Rate Cache: ${args.engagementRateCache}%`,

        `Posts: ${JSON.stringify(args.pulses)}`,

      ].join("\n");

      return (

        await this.gemini.generateText({

          systemInstruction,

          userText,

          temperature: 0.2,

        })

      ).trim();

    } catch {

      return `Hey @${args.instagramHandle}, your studio engine is live. Review your top post pulse cards to set your next brand rate.`;

    }

  }



  private async seedCoPilotWelcome(userId: string, narrativeText: string) {

    const creatorProfile = await this.prisma.creatorProfile.findUnique({

      where: { userId },

    });

    if (!creatorProfile) {

      return;

    }



    const now = new Date();

    const thread = await this.prisma.creatorCoPilotThread.create({

      data: {

        creatorProfileId: creatorProfile.id,

        createdByUserId: userId,

        title: "IG Ingestion & Velocity Scan",

        lastMessageAt: now,

      },

    });



    const messageId = randomUUID();

    const payload = {

      messageId,

      threadId: thread.id,

      timestamp: now.toISOString(),

      formatType: "CONVERSATIONAL_NARRATIVE",

      narrativeText,

    };



    await this.prisma.creatorCoPilotMessage.create({

      data: {

        threadId: thread.id,

        role: "ASSISTANT",

        textContent: narrativeText,

        payloadJson: payload as Prisma.InputJsonValue,

        formatType: CoPilotFormatType.CONVERSATIONAL_NARRATIVE,

      },

    });



    await this.prisma.historicChatThread.create({

      data: {

        userId,

        threadTitle: thread.title,

        lastActiveAt: now,

        messagesJson: [

          {

            role: "assistant",

            timestamp: now.toISOString(),

            content: narrativeText,

          },

        ],

      },

    });

  }

}


