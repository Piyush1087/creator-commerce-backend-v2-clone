import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import {
  CreatorTeamRole,
  OnboardingStatus,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { assignUniquePublicSlug } from "../../shared/creator/assign-public-slug.util";
import { AuthService, type AuthTokenResponse } from "./auth.service";

type GoogleTokenPayload = {
  sub: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  aud?: string;
};

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async signInWithGoogle(args: {
    idToken: string;
    onboardingTrackId?: string;
  }): Promise<AuthTokenResponse> {
    const payload = await this.verifyIdToken(args.idToken);
    if (!payload.email) {
      throw new BadRequestException("Google account must include an email.");
    }

    const email = payload.email.trim().toLowerCase();
    const emailVerified =
      payload.email_verified === true || payload.email_verified === "true";

    if (!emailVerified) {
      throw new BadRequestException("Google email is not verified.");
    }

    const existingByGoogle = await this.prisma.user.findUnique({
      where: { googleSubjectId: payload.sub },
    });
    if (existingByGoogle) {
      return this.auth.issueTokenForUserId(existingByGoogle.id);
    }

    const existingByEmail = await this.prisma.user.findUnique({
      where: { email },
      include: { creatorProfile: true },
    });

    if (existingByEmail) {
      if (existingByEmail.role !== UserRole.CREATOR) {
        throw new ConflictException(
          "This email is registered for a different account type.",
        );
      }
      await this.prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          googleSubjectId: payload.sub,
          emailVerifiedAt: existingByEmail.emailVerifiedAt ?? new Date(),
          name: existingByEmail.name ?? payload.name ?? null,
        },
      });
      return this.auth.issueTokenForUserId(existingByEmail.id);
    }

    if (!args.onboardingTrackId) {
      throw new BadRequestException(
        "Complete handle check before signing up with Google.",
      );
    }

    const user = await this.createCreatorFromGoogle({
      email,
      name: payload.name ?? email.split("@")[0] ?? "creator",
      googleSubjectId: payload.sub,
      onboardingTrackId: args.onboardingTrackId,
    });

    return this.auth.issueTokenForUserId(user.id);
  }

  private async createCreatorFromGoogle(args: {
    email: string;
    name: string;
    googleSubjectId: string;
    onboardingTrackId: string;
  }) {
    const track = await this.prisma.creatorOnboardingTrack.findUnique({
      where: { id: args.onboardingTrackId },
    });
    if (!track || !track.isApproved) {
      throw new BadRequestException("Invalid onboarding track.");
    }
    if (track.userId) {
      throw new ConflictException("This onboarding track is already linked.");
    }
    if (
      track.status !== OnboardingStatus.FEATURES_STAGED &&
      track.status !== OnboardingStatus.ELIGIBILITY_CALCULATED
    ) {
      throw new BadRequestException("Complete module staging before signup.");
    }

    const publicSlug = await assignUniquePublicSlug(
      this.prisma,
      track.instagramHandle,
    );

    return this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: args.email,
          name: args.name,
          role: UserRole.CREATOR,
          googleSubjectId: args.googleSubjectId,
          emailVerifiedAt: new Date(),
        },
      });

      const creatorProfile = await tx.creatorProfile.create({
        data: {
          userId: createdUser.id,
          displayName: args.name,
          instagramHandle: track.instagramHandle,
          publicSlug,
        },
      });

      await tx.userProfile.create({
        data: {
          userId: createdUser.id,
          displayName: args.name,
        },
      });

      const workspace = await tx.creatorWorkspace.create({
        data: {
          ownerProfileId: creatorProfile.id,
          organizationDisplayName: `${args.name}'s Studio`,
        },
      });

      await tx.creatorWorkspaceMember.create({
        data: {
          workspaceId: workspace.id,
          assignedProfileId: creatorProfile.id,
          associatedEmail: args.email,
          securityRole: CreatorTeamRole.OWNER,
          isActive: true,
          joinedAt: new Date(),
        },
      });

      await tx.creatorOnboardingTrack.update({
        where: { id: track.id },
        data: {
          userId: createdUser.id,
          status: OnboardingStatus.OTP_VERIFIED,
        },
      });

      return createdUser;
    });
  }

  /** Public helper for brand onboarding identity confirmation (no user creation). */
  async verifyIdTokenPayload(idToken: string): Promise<GoogleTokenPayload> {
    return this.verifyIdToken(idToken);
  }

  private async verifyIdToken(idToken: string): Promise<GoogleTokenPayload> {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
      throw new BadRequestException("Google sign-in is not configured.");
    }

    const url = new URL("https://oauth2.googleapis.com/tokeninfo");
    url.searchParams.set("id_token", idToken);

    const res = await fetch(url);
    if (!res.ok) {
      this.logger.warn(`Google tokeninfo failed: ${res.status}`);
      throw new UnauthorizedException("Invalid Google sign-in token.");
    }

    const payload = (await res.json()) as GoogleTokenPayload;
    if (payload.aud !== clientId) {
      throw new UnauthorizedException("Google token audience mismatch.");
    }
    if (!payload.sub) {
      throw new UnauthorizedException("Invalid Google token payload.");
    }

    return payload;
  }
}
