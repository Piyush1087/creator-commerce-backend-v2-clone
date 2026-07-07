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
  CreatorTeamRole,
  OAuthTokenStatus,
  OnboardingStatus,
  SocialNetworkProvider,
  UserRole,
} from "@prisma/client";

import { AuthService } from "../auth/auth.service";
import type { AuthUser } from "../auth/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import { assignUniquePublicSlug } from "../../shared/creator/assign-public-slug.util";
import { InstagramConnectService } from "../instagram/instagram-connect.service";
import { GeminiHandleEligibilityService } from "./eligibility/gemini-handle-eligibility.service";
import { CreatorAiSyncService } from "./services/creator-ai-sync.service";
import { mapDetectedVertical } from "./utils/map-detected-vertical.util";
import { normalizeInstagramHandle } from "./utils/normalize-handle.util";
import { CreatorSignupOtpService } from "./verification/creator-signup-otp.service";

const IP_VALIDATION_CAP = 5;

@Injectable()
export class CreatorOnboardingService {
  private readonly logger = new Logger(CreatorOnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: GeminiHandleEligibilityService,
    private readonly otp: CreatorSignupOtpService,
    private readonly auth: AuthService,
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

  async signup(args: {
    onboardingTrackId: string;
    email: string;
    password: string;
  }) {
    const track = await this.getApprovedTrack(args.onboardingTrackId);
    const email = args.email.trim().toLowerCase();
    const hashedPassword = this.auth.hashPassword(args.password);

    if (track.status === OnboardingStatus.ACCOUNT_CREATED && track.userId) {
      return this.resumeOrRestartSignup(track, email, hashedPassword);
    }

    if (
      track.status !== OnboardingStatus.FEATURES_STAGED &&
      track.status !== OnboardingStatus.ELIGIBILITY_CALCULATED
    ) {
      if (track.status === OnboardingStatus.OTP_VERIFIED) {
        throw new BadRequestException(
          "Email already verified. Continue to Instagram connect.",
        );
      }
      throw new BadRequestException("Complete module staging before signup.");
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException(
        "An account with this email already exists. Sign in or use a different email.",
      );
    }

    return this.createSignupForTrack(track, email, hashedPassword);
  }

  private async resumeOrRestartSignup(
    track: {
      id: string;
      userId: string | null;
      instagramHandle: string;
      stagedModules: ActivatedModule[];
    },
    email: string,
    hashedPassword: string,
  ) {
    if (!track.userId) {
      throw new BadRequestException("Signup session is incomplete. Start again from modules.");
    }

    const linkedUser = await this.prisma.user.findUnique({
      where: { id: track.userId },
    });
    if (!linkedUser) {
      await this.prisma.creatorOnboardingTrack.update({
        where: { id: track.id },
        data: {
          userId: null,
          status: OnboardingStatus.FEATURES_STAGED,
        },
      });
      const refreshedTrack = await this.getApprovedTrack(track.id);
      return this.createSignupForTrack(refreshedTrack, email, hashedPassword);
    }

    if (linkedUser.email === email) {
      await this.prisma.user.update({
        where: { id: linkedUser.id },
        data: { hashedPassword },
      });
      const otpResult = await this.otp.sendOtp(email);
      return {
        userId: linkedUser.id,
        email,
        onboardingTrackId: track.id,
        otp: otpResult,
        message: "Verification code resent. Check your email to continue.",
      };
    }

    const emailTaken = await this.prisma.user.findUnique({ where: { email } });
    if (emailTaken) {
      throw new ConflictException(
        "An account with this email already exists. Sign in or use a different email.",
      );
    }

    await this.prisma.creatorOnboardingTrack.update({
      where: { id: track.id },
      data: { userId: null, status: OnboardingStatus.FEATURES_STAGED },
    });
    await this.prisma.user.delete({ where: { id: linkedUser.id } });

    const refreshedTrack = await this.getApprovedTrack(track.id);
    return this.createSignupForTrack(refreshedTrack, email, hashedPassword);
  }

  private async createSignupForTrack(
    track: {
      id: string;
      instagramHandle: string;
    },
    email: string,
    hashedPassword: string,
  ) {
    const displayName = email.split("@")[0] ?? "creator";
    const publicSlug = await assignUniquePublicSlug(
      this.prisma,
      track.instagramHandle,
    );

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          name: displayName,
          role: UserRole.CREATOR,
          hashedPassword,
        },
      });

      const creatorProfile = await tx.creatorProfile.create({
        data: {
          userId: createdUser.id,
          displayName,
          instagramHandle: track.instagramHandle,
          publicSlug,
        },
      });

      await tx.userProfile.create({
        data: {
          userId: createdUser.id,
          displayName,
        },
      });

      const workspace = await tx.creatorWorkspace.create({
        data: {
          ownerProfileId: creatorProfile.id,
          organizationDisplayName: `${displayName}'s Studio`,
        },
      });

      await tx.creatorWorkspaceMember.create({
        data: {
          workspaceId: workspace.id,
          assignedProfileId: creatorProfile.id,
          associatedEmail: email,
          securityRole: CreatorTeamRole.OWNER,
          isActive: true,
          joinedAt: new Date(),
        },
      });

      await tx.creatorOnboardingTrack.update({
        where: { id: track.id },
        data: {
          userId: createdUser.id,
          status: OnboardingStatus.ACCOUNT_CREATED,
        },
      });

      return createdUser;
    });

    const otpResult = await this.otp.sendOtp(email);
    return {
      userId: user.id,
      email,
      onboardingTrackId: track.id,
      otp: otpResult,
      message: "Account created. Verify your email to continue.",
    };
  }

  async verifyOtp(email: string, otpCode: string) {
    await this.otp.verifyOtp(email, otpCode);
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user || user.role !== UserRole.CREATOR) {
      throw new NotFoundException("Creator account not found.");
    }

    await this.prisma.creatorOnboardingTrack.updateMany({
      where: { userId: user.id },
      data: { status: OnboardingStatus.OTP_VERIFIED },
    });

    return this.auth.issueTokenForUserId(user.id);
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
        message: "AI engine sync started. Dashboard data will populate shortly.",
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
