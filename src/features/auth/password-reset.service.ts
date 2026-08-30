import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AuthDeliveryStatus,
  AuthMethodType,
  SecurityEventType,
  UserAuthState,
} from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

import { AuthMailDeliveryError, MailService } from "../../mail/mail.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  hashPasswordAsync,
  verifyPasswordAsync,
} from "../../shared/crypto/password.util";
import { normalizeEmail } from "../../shared/identity/normalize-email";
import { resetTtlMs } from "./auth-jwt.config";

const GENERIC_RESET_RESPONSE = {
  message:
    "If an eligible account exists, a password reset email has been sent.",
};

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async request(email: string): Promise<typeof GENERIC_RESET_RESPONSE> {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { normalizedEmail },
      include: {
        authMethods: {
          where: { type: AuthMethodType.PASSWORD, disabledAt: null },
        },
      },
    });
    if (
      !user ||
      user.authState === UserAuthState.DISABLED ||
      user.authMethods.length === 0
    ) {
      return GENERIC_RESET_RESPONSE;
    }
    const rawToken = randomBytes(32).toString("base64url");
    const tokenDigest = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + resetTtlMs(this.config));
    const challenge = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`RESET:${normalizedEmail}`}, 0))::text`;
      const recent = await tx.passwordResetChallenge.count({
        where: {
          userId: user.id,
          createdAt: { gt: new Date(Date.now() - 15 * 60_000) },
        },
      });
      if (recent >= 3) return null;
      await tx.passwordResetChallenge.updateMany({
        where: { userId: user.id, consumedAt: null, supersededAt: null },
        data: { supersededAt: new Date() },
      });
      const created = await tx.passwordResetChallenge.create({
        data: { userId: user.id, normalizedEmail, tokenDigest, expiresAt },
      });
      await tx.securityEvent.create({
        data: {
          userId: user.id,
          type: SecurityEventType.PASSWORD_RESET_REQUESTED,
        },
      });
      return created;
    });
    if (!challenge) return GENERIC_RESET_RESPONSE;
    try {
      const messageId = await this.mail.sendPasswordReset({
        to: normalizedEmail,
        rawToken,
        displayName: user.name ?? "there",
        expiresInMinutes: Math.ceil(
          (expiresAt.getTime() - Date.now()) / 60_000,
        ),
      });
      await this.prisma.passwordResetChallenge.update({
        where: { id: challenge.id },
        data: {
          deliveryStatus: AuthDeliveryStatus.MESSAGE_ACCEPTED,
          providerMessageId: messageId,
        },
      });
    } catch (error: unknown) {
      await this.prisma.passwordResetChallenge.updateMany({
        where: { id: challenge.id, deliveryStatus: AuthDeliveryStatus.PENDING },
        data: {
          deliveryStatus:
            error instanceof AuthMailDeliveryError &&
            error.classification === "REJECTED"
              ? AuthDeliveryStatus.REJECTED
              : AuthDeliveryStatus.DELIVERY_UNKNOWN,
        },
      });
    }
    return GENERIC_RESET_RESPONSE;
  }

  async complete(rawToken: string, newPassword: string): Promise<void> {
    const tokenDigest = createHash("sha256").update(rawToken).digest("hex");
    const passwordHash = await hashPasswordAsync(newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`RESET_TOKEN:${tokenDigest}`}, 0))::text`;
      const challenge = await tx.passwordResetChallenge.findUnique({
        where: { tokenDigest },
      });
      if (
        !challenge ||
        challenge.consumedAt ||
        challenge.supersededAt ||
        challenge.expiresAt <= new Date() ||
        challenge.deliveryStatus !== AuthDeliveryStatus.MESSAGE_ACCEPTED
      ) {
        throw new UnauthorizedException("Invalid or expired reset token.");
      }
      await tx.userAuthMethod.upsert({
        where: {
          userId_type: {
            userId: challenge.userId,
            type: AuthMethodType.PASSWORD,
          },
        },
        create: {
          userId: challenge.userId,
          type: AuthMethodType.PASSWORD,
          credentialHash: passwordHash,
        },
        update: { credentialHash: passwordHash, disabledAt: null },
      });
      await tx.user.update({
        where: { id: challenge.userId },
        data: {
          hashedPassword: passwordHash,
          authState: UserAuthState.ACTIVE,
        },
      });
      await tx.passwordResetChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      await tx.authSession.updateMany({
        where: { userId: challenge.userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revocationReason: "PASSWORD_RESET",
        },
      });
      await tx.securityEvent.create({
        data: {
          userId: challenge.userId,
          type: SecurityEventType.PASSWORD_RESET_COMPLETED,
        },
      });
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const method = await this.prisma.userAuthMethod.findUnique({
      where: { userId_type: { userId, type: AuthMethodType.PASSWORD } },
    });
    if (
      !method?.credentialHash ||
      !(await verifyPasswordAsync(currentPassword, method.credentialHash))
    ) {
      throw new UnauthorizedException("Current password is incorrect.");
    }
    const passwordHash = await hashPasswordAsync(newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.userAuthMethod.update({
        where: { id: method.id },
        data: { credentialHash: passwordHash },
      });
      await tx.user.update({
        where: { id: userId },
        data: { hashedPassword: passwordHash },
      });
      await tx.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revocationReason: "PASSWORD_CHANGED" },
      });
      await tx.securityEvent.create({
        data: { userId, type: SecurityEventType.PASSWORD_CHANGED },
      });
    });
  }
}
