import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  ActivatedModule,
  OAuthTokenStatus,
  OnboardingStatus,
  SocialNetworkProvider,
} from "@prisma/client";

import type { AuthUser } from "../auth/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import { InstagramConnectService } from "../instagram/instagram-connect.service";
import { GeminiHandleEligibilityService } from "./eligibility/gemini-handle-eligibility.service";
import { CreatorAiSyncService } from "./services/creator-ai-sync.service";
import { mapDetectedVertical } from "./utils/map-detected-vertical.util";
import { normalizeInstagramHandle } from "./utils/normalize-handle.util";

const IP_VALIDATION_CAP = 5;

@Injectable()
export class CreatorOnboardingService {
  private readonly logger = new Logger(CreatorOnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: GeminiHandleEligibilityService,
    private readonly instagram: InstagramConnectService,
    private readonly aiSync: CreatorAiSyncService,
  ) {}

  async handleCheck(args: {
    instagramHandle: string;
    clientIp: string;
    userAgent?: string;
  }) {
    const handle = normalizeInstagramHandle(args.instagramHandle);
    await this.assertIpValidationBudget(args.clientIp);

    const evaluation = await this.eligibility.evaluateHandle(handle);
    const detectedVertical = mapDetectedVertical(evaluation.detected_vertical);

    const existingProfile = await this.findExistingHandleOwner(handle);
    const isExistingUserRoute = Boolean(existingProfile);

    if (!evaluation.is_approved) {
      const track = await this.prisma.creatorOnboardingTrack.create({
        data: {
          instagramHandle: handle,
          status: OnboardingStatus.WAITLISTED,
          eligibilityScore: evaluation.eligibility_score,
          percentileRank: evaluation.percentile_rank,
          isApproved: false,
          detectedVertical,
          isExistingUserRoute,
          clientIp: args.clientIp,
          userAgent: args.userAgent,
        },
      });
      return {
        outcome: "waitlisted" as const,
        onboardingTrackId: track.id,
        message:
          "This profile is not eligible for automated onboarding yet. Join the waitlist to be notified.",
      };
    }

    const track = await this.prisma.creatorOnboardingTrack.create({
      data: {
        instagramHandle: handle,
        status: OnboardingStatus.ELIGIBILITY_CALCULATED,
        eligibilityScore: evaluation.eligibility_score,
        percentileRank: evaluation.percentile_rank,
        isApproved: true,
        detectedVertical,
        isExistingUserRoute,
        clientIp: args.clientIp,
        userAgent: args.userAgent,
      },
    });

    return {
      outcome: "approved" as const,
      onboardingTrackId: track.id,
      eligibility: {
        score: evaluation.eligibility_score,
        percentileRank: evaluation.percentile_rank,
        vertical: evaluation.detected_vertical,
      },
      isExistingUserRoute,
    };
  }

  async stageFeatures(
    onboardingTrackId: string,
    stagedModules: ActivatedModule[],
  ) {
    const track = await this.getApprovedTrack(onboardingTrackId);
    const updated = await this.prisma.creatorOnboardingTrack.update({
      where: { id: track.id },
      data: {
        stagedModules,
        status: OnboardingStatus.FEATURES_STAGED,
      },
    });
    return {
      onboardingTrackId: updated.id,
      stagedModules: updated.stagedModules,
    };
  }

  async metaConnect(
    user: AuthUser,
    args: { onboardingTrackId: string; code: string; redirectUri: string },
  ) {
    const track = await this.prisma.creatorOnboardingTrack.findUnique({
      where: { id: args.onboardingTrackId },
    });
    if (!track || track.userId !== user.id) {
      throw new NotFoundException("Onboarding track not found.");
    }
    if (track.status !== OnboardingStatus.OTP_VERIFIED) {
      throw new BadRequestException(
        "Verify your email before connecting Instagram.",
      );
    }

    const result = await this.instagram.connectForUser(user, {
      code: args.code,
      redirectUri: args.redirectUri,
      expectedHandle: track.instagramHandle,
    });

    await this.prisma.creatorOnboardingTrack.update({
      where: { id: track.id },
      data: {
        status: OnboardingStatus.META_OAUTH_SUCCESS,
        instagramMetaId: result.nativePlatformUserId,
      },
    });

    return {
      onboardingTrackId: track.id,
      instagram: {
        username: result.username,
        accountType: result.accountType,
        followersCount: result.followersCount,
      },
      isExistingUserRoute: track.isExistingUserRoute,
    };
  }

  async activateSync(
    user: AuthUser,
    args: {
      onboardingTrackId: string;
      userConfirmedSync: true;
      skipInstagramConnect?: boolean;
    },
  ) {
    const track = await this.prisma.creatorOnboardingTrack.findUnique({
      where: { id: args.onboardingTrackId },
    });
    if (!track || track.userId !== user.id) {
      throw new NotFoundException("Onboarding track not found.");
    }

    if (track.status === OnboardingStatus.META_OAUTH_SUCCESS) {
      void this.aiSync.runActivationSync(user.id, track.id).catch((err) => {
        this.logger.error(`AI sync failed track=${track.id}: ${String(err)}`);
      });
      return {
        onboardingTrackId: track.id,
        status: "processing",
        mode: "instagram" as const,
        message:
          "AI engine sync started. Dashboard data will populate shortly.",
      };
    }

    if (
      args.skipInstagramConnect &&
      track.status === OnboardingStatus.OTP_VERIFIED
    ) {
      void this.aiSync.runStubActivationSync(user.id, track.id).catch((err) => {
        this.logger.error(
          `Stub AI sync failed track=${track.id}: ${String(err)}`,
        );
      });
      return {
        onboardingTrackId: track.id,
        status: "processing",
        mode: "stub" as const,
        message:
          "Workspace build started without Instagram. Connect later in settings for live metrics.",
      };
    }

    throw new BadRequestException(
      track.status === OnboardingStatus.OTP_VERIFIED
        ? "Connect Instagram or choose to continue without it before activating sync."
        : "Connect Instagram before activating sync.",
    );
  }

  async getTrack(trackId: string) {
    const track = await this.prisma.creatorOnboardingTrack.findUnique({
      where: { id: trackId },
      select: {
        id: true,
        instagramHandle: true,
        status: true,
        isApproved: true,
        eligibilityScore: true,
        percentileRank: true,
        detectedVertical: true,
        stagedModules: true,
        isExistingUserRoute: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!track) {
      throw new NotFoundException("Onboarding track not found.");
    }
    return track;
  }

  async joinWaitlist(args: { onboardingTrackId: string; email: string }) {
    const track = await this.prisma.creatorOnboardingTrack.findUnique({
      where: { id: args.onboardingTrackId },
    });
    if (!track) {
      throw new NotFoundException("Onboarding track not found.");
    }

    const waitlist = await this.prisma.waitlistLead.create({
      data: {
        email: args.email.trim().toLowerCase(),
        industryInterest: track.detectedVertical,
      },
    });

    await this.prisma.creatorOnboardingTrack.update({
      where: { id: track.id },
      data: {
        waitlistLeadId: waitlist.id,
        status: OnboardingStatus.WAITLISTED,
      },
    });

    return { waitlistLeadId: waitlist.id };
  }

  private async getApprovedTrack(trackId: string) {
    const track = await this.prisma.creatorOnboardingTrack.findUnique({
      where: { id: trackId },
    });
    if (!track) {
      throw new NotFoundException("Onboarding track not found.");
    }
    if (!track.isApproved) {
      throw new BadRequestException("This onboarding track is not approved.");
    }
    return track;
  }

  private async assertIpValidationBudget(clientIp: string) {
    const row = await this.prisma.ipValidationLimit.findUnique({
      where: { clientIp },
    });
    if (row && row.validationCount >= IP_VALIDATION_CAP) {
      throw new HttpException(
        "Too many handle validations from this network. Try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!row) {
      await this.prisma.ipValidationLimit.create({
        data: { clientIp, validationCount: 1 },
      });
      return;
    }

    await this.prisma.ipValidationLimit.update({
      where: { clientIp },
      data: {
        validationCount: row.validationCount + 1,
        lastAttemptAt: new Date(),
      },
    });
  }

  private async findExistingHandleOwner(handle: string) {
    return this.prisma.creatorProfile.findFirst({
      where: {
        OR: [
          { instagramHandle: { equals: handle, mode: "insensitive" } },
          {
            socialIntegrations: {
              some: {
                platformNetwork: SocialNetworkProvider.INSTAGRAM,
                channelHandleString: { equals: handle, mode: "insensitive" },
                tokenStateCondition: OAuthTokenStatus.ACTIVE,
              },
            },
          },
        ],
      },
      select: { id: true, userId: true },
    });
  }
}
