import {
  GoneException,
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthMethodType, EmailOtpPurpose, UserAuthState } from "@prisma/client";
import { createHash } from "node:crypto";

import { PrismaService } from "../../prisma/prisma.service";
import {
  hashPassword,
  hashPasswordAsync,
  verifyPassword,
  verifyPasswordAsync,
} from "../../shared/crypto/password.util";
import { normalizeEmail } from "../../shared/identity/normalize-email";
import {
  AuthSessionService,
  type SessionIssueResult,
} from "./auth-session.service";
import { LoginDto } from "./dto/login.dto";
import { EmailOtpService } from "./email-otp.service";
import type { AuthUser } from "./types/auth-user";

export type AuthTokenResponse = SessionIssueResult;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: AuthSessionService,
    private readonly emailOtp: EmailOtpService,
  ) {}

  async login(dto: LoginDto): Promise<AuthTokenResponse> {
    const normalizedEmail = normalizeEmail(dto.email);
    await this.assertNotThrottled(normalizedEmail, "PASSWORD_LOGIN");
    const user = await this.prisma.user.findUnique({
      where: { normalizedEmail },
      include: {
        authMethods: {
          where: { type: AuthMethodType.PASSWORD, disabledAt: null },
        },
      },
    });
    const credentialHash = user?.authMethods[0]?.credentialHash;
    const valid = credentialHash
      ? await verifyPasswordAsync(dto.password, credentialHash)
      : await this.performDummyPasswordWork(dto.password);
    if (
      !user ||
      !credentialHash ||
      !valid ||
      user.authState !== UserAuthState.ACTIVE
    ) {
      await this.recordFailure(normalizedEmail, "PASSWORD_LOGIN");
      throw new UnauthorizedException("Invalid email or password.");
    }
    await this.clearThrottle(normalizedEmail, "PASSWORD_LOGIN");
    return this.sessions.create(user.id);
  }

  async requestLoginOtp(email: string): Promise<{ message: string }> {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { normalizedEmail },
    });
    try {
      await this.emailOtp.issue({
        email: normalizedEmail,
        purpose: EmailOtpPurpose.LOGIN,
        eligible: user?.authState === UserAuthState.ACTIVE,
        displayName: user?.name ?? undefined,
        userId: user?.id,
      });
    } catch {
      // Public response is deliberately identical for unknown, suppressed,
      // rejected and ambiguous-delivery recipients.
    }
    return { message: "If an eligible account exists, a code has been sent." };
  }

  async loginWithOtp(email: string, code: string): Promise<AuthTokenResponse> {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { normalizedEmail },
    });
    if (!user || user.authState !== UserAuthState.ACTIVE) {
      throw new UnauthorizedException("Invalid or expired verification code.");
    }
    await this.emailOtp.consume({
      email: normalizedEmail,
      purpose: EmailOtpPurpose.LOGIN,
      code,
      userId: user.id,
    });
    await this.prisma.userAuthMethod.upsert({
      where: {
        userId_type: { userId: user.id, type: AuthMethodType.EMAIL_OTP },
      },
      create: { userId: user.id, type: AuthMethodType.EMAIL_OTP },
      update: { verifiedAt: new Date(), disabledAt: null },
    });
    return this.sessions.create(user.id);
  }

  async completeBrandRegistration(): Promise<never> {
    throw new GoneException(
      "This registration endpoint has been retired. Complete verified onboarding instead.",
    );
  }

  async getMe(authUser: AuthUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: authUser.id },
      include: {
        authMethods: {
          where: { disabledAt: null },
          select: { type: true, verifiedAt: true },
        },
        creatorProfile: {
          select: {
            id: true,
            displayName: true,
            ownedWorkspaces: {
              select: { id: true, organizationDisplayName: true },
            },
          },
        },
        brandTeamMemberships: {
          where: { isActive: true },
          select: { brandProfileId: true, role: true, isActive: true },
        },
      },
    });
    if (!user || user.authState !== UserAuthState.ACTIVE) {
      throw new UnauthorizedException("Session is not active.");
    }
    const session = authUser.sessionId
      ? await this.prisma.authSession.findUnique({
          where: { id: authUser.sessionId },
          select: {
            id: true,
            createdAt: true,
            lastUsedAt: true,
            absoluteExpiresAt: true,
            revokedAt: true,
          },
        })
      : null;
    return {
      id: user.id,
      sessionId: authUser.sessionId,
      email: user.email,
      name: user.name,
      role: user.role,
      authState: user.authState,
      authMethods: user.authMethods,
      creatorProfile: user.creatorProfile,
      brandMemberships: user.brandTeamMemberships,
      session,
    };
  }

  hashPassword(plain: string): string {
    return hashPassword(plain);
  }

  verifyPassword(plain: string, storedHash: string): boolean {
    return verifyPassword(plain, storedHash);
  }

  async issueTokenForUserId(userId: string): Promise<AuthTokenResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found.");
    return this.sessions.create(user.id);
  }

  async issueTokenForUser(user: { id: string }): Promise<AuthTokenResponse> {
    return this.sessions.create(user.id);
  }

  private async performDummyPasswordWork(password: string): Promise<boolean> {
    await hashPasswordAsync(password);
    return false;
  }

  private throttleDigest(email: string): string {
    return createHash("sha256").update(email).digest("hex");
  }

  private async assertNotThrottled(email: string, kind: string): Promise<void> {
    const throttle = await this.prisma.authThrottle.findUnique({
      where: {
        identifierDigest_kind: {
          identifierDigest: this.throttleDigest(email),
          kind,
        },
      },
    });
    if (throttle?.blockedUntil && throttle.blockedUntil > new Date()) {
      throw new HttpException("Try again later.", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async recordFailure(email: string, kind: string): Promise<void> {
    const identifierDigest = this.throttleDigest(email);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${kind}:${identifierDigest}`}, 0))::text`;
      const existing = await tx.authThrottle.findUnique({
        where: { identifierDigest_kind: { identifierDigest, kind } },
      });
      const now = new Date();
      const inWindow =
        existing &&
        now.getTime() - existing.windowStartedAt.getTime() < 15 * 60_000;
      const failures = inWindow ? existing.failureCount + 1 : 1;
      await tx.authThrottle.upsert({
        where: { identifierDigest_kind: { identifierDigest, kind } },
        create: { identifierDigest, kind, failureCount: 1 },
        update: {
          failureCount: failures,
          windowStartedAt: inWindow ? existing.windowStartedAt : now,
          blockedUntil:
            failures >= 5 ? new Date(now.getTime() + 15 * 60_000) : null,
        },
      });
    });
  }

  private async clearThrottle(email: string, kind: string): Promise<void> {
    await this.prisma.authThrottle.deleteMany({
      where: { identifierDigest: this.throttleDigest(email), kind },
    });
  }
}
