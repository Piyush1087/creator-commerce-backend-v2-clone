import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import {
  AuthMethodType,
  Prisma,
  SecurityEventType,
  UserAuthState,
} from "@prisma/client";
import { OAuth2Client, type TokenPayload } from "google-auth-library";

import { PrismaService } from "../../prisma/prisma.service";
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
    /** Compatibility-only. This value has no account-creation authority. */
    onboardingTrackId?: string;
  }): Promise<AuthTokenResponse> {
    const payload = await this.verifyIdTokenPayload(args.idToken);
    const normalizedEmail = normalizeEmail(payload.email!);
    const methodBySubject = await this.prisma.userAuthMethod.findUnique({
      where: { providerSubjectId: payload.sub },
      include: { user: true },
    });
    if (methodBySubject) {
      if (
        methodBySubject.type !== AuthMethodType.GOOGLE ||
        methodBySubject.disabledAt ||
        methodBySubject.providerEmailNormalized !== normalizedEmail ||
        methodBySubject.user.normalizedEmail !== normalizedEmail
      ) {
        await this.recordConflict(
          methodBySubject.userId,
          "SUBJECT_EMAIL_MISMATCH",
        );
        this.googleIdentityConflict();
      }
      if (methodBySubject.user.authState !== UserAuthState.ACTIVE) {
        throw new ConflictException({
          code: "ACCOUNT_RECOVERY_REQUIRED",
          message: "This account requires recovery before sign-in.",
        });
      }
      return this.auth.issueTokenForUserId(methodBySubject.userId);
    }

    const existingByEmail = await this.prisma.user.findUnique({
      where: { normalizedEmail },
      include: {
        authMethods: { where: { type: AuthMethodType.GOOGLE } },
      },
    });
    if (!existingByEmail) {
      throw new BadRequestException({
        code: "GOOGLE_REGISTRATION_REQUIRED",
        message: "Create an account before signing in with Google.",
      });
    }
    if (existingByEmail.authState !== UserAuthState.ACTIVE) {
      throw new ConflictException({
        code: "ACCOUNT_RECOVERY_REQUIRED",
        message: "This account requires recovery before sign-in.",
      });
    }
    const existingGoogle = existingByEmail.authMethods[0];
    if (
      (existingGoogle?.providerSubjectId &&
        existingGoogle.providerSubjectId !== payload.sub) ||
      (existingByEmail.googleSubjectId &&
        existingByEmail.googleSubjectId !== payload.sub)
    ) {
      await this.recordConflict(
        existingByEmail.id,
        "EMAIL_ALREADY_LINKED_TO_DIFFERENT_SUBJECT",
      );
      this.googleIdentityConflict();
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.userAuthMethod.upsert({
          where: {
            userId_type: {
              userId: existingByEmail.id,
              type: AuthMethodType.GOOGLE,
            },
          },
          create: {
            userId: existingByEmail.id,
            type: AuthMethodType.GOOGLE,
            providerSubjectId: payload.sub,
            providerEmailNormalized: normalizedEmail,
          },
          update: {
            providerSubjectId: payload.sub,
            providerEmailNormalized: normalizedEmail,
            verifiedAt: new Date(),
            disabledAt: null,
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
        this.googleIdentityConflict();
      }
      throw error;
    }
    return this.auth.issueTokenForUserId(existingByEmail.id);
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

  private googleIdentityConflict(): never {
    throw new ConflictException({
      code: "GOOGLE_IDENTITY_CONFLICT",
      message: "Google identity conflicts with this account.",
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
