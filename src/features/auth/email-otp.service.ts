import {
  Injectable,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AuthDeliveryStatus,
  EmailOtpPurpose,
  Prisma,
  SecurityEventType,
} from "@prisma/client";
import {
  createHash,
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

import { MailService } from "../../mail/mail.service";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizeEmail } from "../../shared/identity/normalize-email";
import {
  AUTH_OTP_TTL,
  durationToMs,
  resolveOtpPepper,
} from "./auth-jwt.config";

type IssueOtpInput = {
  email: string;
  purpose: EmailOtpPurpose;
  eligible: boolean;
  displayName?: string;
  userId?: string;
};

@Injectable()
export class EmailOtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async issue(input: IssueOtpInput): Promise<void> {
    const normalizedEmail = normalizeEmail(input.email);
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const expiresAt = new Date(
      Date.now() +
        durationToMs(
          this.config.get<string>("AUTH_OTP_TTL") ?? AUTH_OTP_TTL,
          AUTH_OTP_TTL,
        ),
    );
    const challenge = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, `${input.purpose}:${normalizedEmail}`);
      await this.enforceThrottle(tx, normalizedEmail, `OTP_${input.purpose}`);
      if (!input.eligible) return null;
      const now = new Date();
      const lastChallenge = await tx.emailOtpChallenge.findFirst({
        where: { normalizedEmail, purpose: input.purpose },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (
        lastChallenge &&
        now.getTime() - lastChallenge.createdAt.getTime() < 60_000
      ) {
        throw new HttpException(
          "Try again later.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      await tx.emailOtpChallenge.updateMany({
        where: {
          normalizedEmail,
          purpose: input.purpose,
          consumedAt: null,
          supersededAt: null,
        },
        data: { supersededAt: now },
      });
      const created = await tx.emailOtpChallenge.create({
        data: {
          normalizedEmail,
          purpose: input.purpose,
          digest: "0".repeat(64),
          expiresAt,
        },
      });
      const digest = this.digest(
        created.id,
        normalizedEmail,
        input.purpose,
        code,
      );
      await tx.emailOtpChallenge.update({
        where: { id: created.id },
        data: { digest },
      });
      await tx.securityEvent.create({
        data: {
          userId: input.userId,
          type: SecurityEventType.OTP_ISSUED,
          context: { purpose: input.purpose },
        },
      });
      return created;
    });
    if (!challenge) return;

    try {
      const messageId = await this.mail.sendAuthenticationOtp({
        to: normalizedEmail,
        code,
        displayName: input.displayName ?? "there",
        expiresInMinutes: Math.ceil(
          (expiresAt.getTime() - Date.now()) / 60_000,
        ),
      });
      await this.prisma.emailOtpChallenge.update({
        where: { id: challenge.id },
        data: {
          deliveryStatus: AuthDeliveryStatus.MESSAGE_ACCEPTED,
          providerMessageId: messageId,
        },
      });
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      await this.prisma.emailOtpChallenge.updateMany({
        where: { id: challenge.id, deliveryStatus: AuthDeliveryStatus.PENDING },
        data: {
          deliveryStatus:
            typeof statusCode === "number" &&
            statusCode >= 400 &&
            statusCode < 500
              ? AuthDeliveryStatus.REJECTED
              : AuthDeliveryStatus.DELIVERY_UNKNOWN,
        },
      });
      throw new Error("Authentication email dispatch failed");
    }
  }

  async consume(args: {
    email: string;
    purpose: EmailOtpPurpose;
    code: string;
    userId?: string;
  }): Promise<string> {
    const normalizedEmail = normalizeEmail(args.email);
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, `${args.purpose}:${normalizedEmail}`);
      const challenge = await tx.emailOtpChallenge.findFirst({
        where: {
          normalizedEmail,
          purpose: args.purpose,
          consumedAt: null,
          supersededAt: null,
          deliveryStatus: AuthDeliveryStatus.MESSAGE_ACCEPTED,
        },
        orderBy: { createdAt: "desc" },
      });
      if (!challenge || challenge.expiresAt <= new Date()) {
        throw new UnauthorizedException(
          "Invalid or expired verification code.",
        );
      }
      const actual = Buffer.from(
        this.digest(challenge.id, normalizedEmail, args.purpose, args.code),
        "hex",
      );
      const expected = Buffer.from(challenge.digest, "hex");
      const matches =
        actual.length === expected.length && timingSafeEqual(actual, expected);
      if (!matches) {
        const updated = await tx.emailOtpChallenge.update({
          where: { id: challenge.id },
          data: { attemptCount: { increment: 1 } },
        });
        if (updated.attemptCount >= updated.maxAttempts) {
          await tx.emailOtpChallenge.update({
            where: { id: challenge.id },
            data: { supersededAt: new Date() },
          });
        }
        throw new UnauthorizedException(
          "Invalid or expired verification code.",
        );
      }
      const consumed = await tx.emailOtpChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null, supersededAt: null },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw new UnauthorizedException(
          "Invalid or expired verification code.",
        );
      }
      await tx.securityEvent.create({
        data: {
          userId: args.userId,
          type: SecurityEventType.OTP_VERIFIED,
          context: { purpose: args.purpose },
        },
      });
      return normalizedEmail;
    });
  }

  private digest(
    challengeId: string,
    email: string,
    purpose: EmailOtpPurpose,
    code: string,
  ): string {
    return createHmac("sha256", resolveOtpPepper(this.config))
      .update(`${challengeId}\u0000${email}\u0000${purpose}\u0000${code}`)
      .digest("hex");
  }

  private async lock(tx: Prisma.TransactionClient, key: string): Promise<void> {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
  }

  private async enforceThrottle(
    tx: Prisma.TransactionClient,
    email: string,
    kind: string,
  ): Promise<void> {
    const identifierDigest = createHash("sha256").update(email).digest("hex");
    const existing = await tx.authThrottle.findUnique({
      where: { identifierDigest_kind: { identifierDigest, kind } },
    });
    const now = new Date();
    if (existing?.blockedUntil && existing.blockedUntil > now) {
      throw new HttpException("Try again later.", HttpStatus.TOO_MANY_REQUESTS);
    }
    const withinWindow =
      existing &&
      now.getTime() - existing.windowStartedAt.getTime() < 15 * 60_000;
    const count = withinWindow ? existing.failureCount + 1 : 1;
    await tx.authThrottle.upsert({
      where: { identifierDigest_kind: { identifierDigest, kind } },
      create: { identifierDigest, kind, failureCount: 1 },
      update: {
        failureCount: count,
        windowStartedAt: withinWindow ? existing.windowStartedAt : now,
        blockedUntil: count >= 5 ? new Date(now.getTime() + 15 * 60_000) : null,
      },
    });
    if (count > 5) {
      throw new HttpException("Try again later.", HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
