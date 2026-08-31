import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import {
  AuthMethodType,
  CreatorTeamRole,
  OnboardingStatus,
  OrganizationKind,
  Prisma,
  SecurityEventType,
  UserAuthState,
  UserRole,
} from "@prisma/client";
import { OAuth2Client, type TokenPayload } from "google-auth-library";

import { PrismaService } from "../../prisma/prisma.service";
import { assignUniquePublicSlug } from "../../shared/creator/assign-public-slug.util";
import { normalizeEmail } from "../../shared/identity/normalize-email";
import { AuthService, type AuthTokenResponse } from "./auth.service";

@Injectable()
export class GoogleAuthService {
  private readonly client = new OAuth2Client();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async signInWithGoogle(args: {
    idToken: string;
    onboardingTrackId?: string;
  }): Promise<AuthTokenResponse> {
    const payload = await this.verifyIdToken(args.idToken);
    const normalizedEmail = normalizeEmail(payload.email!);
    const methodBySubject = await this.prisma.userAuthMethod.findUnique({
      where: { providerSubjectId: payload.sub },
      include: { user: true },
    });
    if (methodBySubject) {
      if (
        methodBySubject.type !== AuthMethodType.GOOGLE ||
        methodBySubject.disabledAt
      ) {
        throw new UnauthorizedException("Google sign-in is not available.");
      }
      if (methodBySubject.providerEmailNormalized !== normalizedEmail) {
        await this.recordConflict(
          methodBySubject.userId,
          "SUBJECT_EMAIL_MISMATCH",
        );
        throw new ConflictException(
          "Google identity conflicts with this account.",
        );
      }
      return this.auth.issueTokenForUserId(methodBySubject.userId);
    }

    const existingByEmail = await this.prisma.user.findUnique({
      where: { normalizedEmail },
      include: {
        authMethods: { where: { type: AuthMethodType.GOOGLE } },
      },
    });
    if (existingByEmail) {
      if (existingByEmail.authState !== UserAuthState.ACTIVE) {
        throw new ConflictException(
          "This account requires recovery before sign-in.",
        );
      }
      const existingGoogle = existingByEmail.authMethods[0];
      if (
        existingGoogle?.providerSubjectId &&
        existingGoogle.providerSubjectId !== payload.sub
      ) {
        await this.recordConflict(
          existingByEmail.id,
          "EMAIL_ALREADY_LINKED_TO_DIFFERENT_SUBJECT",
        );
        throw new ConflictException(
          "Google identity conflicts with this account.",
        );
      }
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.userAuthMethod.create({
            data: {
              userId: existingByEmail.id,
              type: AuthMethodType.GOOGLE,
              providerSubjectId: payload.sub,
              providerEmailNormalized: normalizedEmail,
            },
          });
          await tx.user.update({
            where: { id: existingByEmail.id },
            data: {
              googleSubjectId: payload.sub,
              emailVerifiedAt: existingByEmail.emailVerifiedAt ?? new Date(),
              name: existingByEmail.name ?? payload.name ?? null,
            },
          });
          await tx.securityEvent.create({
            data: {
              userId: existingByEmail.id,
              type: SecurityEventType.GOOGLE_LINKED,
            },
          });
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          await this.recordConflict(existingByEmail.id, "GOOGLE_LINK_RACE");
          throw new ConflictException(
            "Google identity conflicts with this account.",
          );
        }
        throw error;
      }
      return this.auth.issueTokenForUserId(existingByEmail.id);
    }

    if (!args.onboardingTrackId) {
      throw new BadRequestException(
        "Complete the applicable onboarding admission before creating an account.",
      );
    }
    const user = await this.createCreatorFromGoogle({
      email: normalizedEmail,
      name: payload.name ?? normalizedEmail.split("@")[0] ?? "creator",
      googleSubjectId: payload.sub,
      onboardingTrackId: args.onboardingTrackId,
    });
    return this.auth.issueTokenForUserId(user.id);
  }

  async verifyIdTokenPayload(idToken: string): Promise<TokenPayload> {
    return this.verifyIdToken(idToken);
  }

  private async verifyIdToken(idToken: string): Promise<TokenPayload> {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId)
      throw new BadRequestException("Google sign-in is not configured.");
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        throw new UnauthorizedException("Invalid Google sign-in token.");
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("Invalid Google sign-in token.");
    }
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
    if (!track?.isApproved || track.userId) {
      throw new BadRequestException("Invalid onboarding track.");
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
      const organization = await tx.organization.create({
        data: {
          name: `${args.name}'s Studio`,
          kind: OrganizationKind.CREATOR,
        },
      });
      const createdUser = await tx.user.create({
        data: {
          email: args.email,
          normalizedEmail: args.email,
          name: args.name,
          role: UserRole.CREATOR,
          organizationId: organization.id,
          googleSubjectId: args.googleSubjectId,
          emailVerifiedAt: new Date(),
          authState: UserAuthState.ACTIVE,
          authMethods: {
            create: {
              type: AuthMethodType.GOOGLE,
              providerSubjectId: args.googleSubjectId,
              providerEmailNormalized: args.email,
            },
          },
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
        data: { userId: createdUser.id, displayName: args.name },
      });
      const workspace = await tx.creatorWorkspace.create({
        data: {
          ownerProfileId: creatorProfile.id,
          organizationId: organization.id,
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
        data: { userId: createdUser.id, status: OnboardingStatus.OTP_VERIFIED },
      });
      await tx.securityEvent.create({
        data: { userId: createdUser.id, type: SecurityEventType.GOOGLE_LINKED },
      });
      return createdUser;
    });
  }

  private async recordConflict(userId: string, reasonCode: string) {
    await this.prisma.securityEvent.create({
      data: {
        userId,
        type: SecurityEventType.GOOGLE_LINK_CONFLICT,
        outcome: "REJECTED",
        reasonCode,
      },
    });
  }
}
