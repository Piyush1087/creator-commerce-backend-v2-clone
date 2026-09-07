import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  AuthDeliveryStatus,
  AuthMethodType,
  BrandRole,
  EmailOtpPurpose,
  PrismaClient,
  UserAuthState,
  UserRole,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  AuthMailDeliveryError,
  type MailService,
} from "../../mail/mail.service";
import type { PrismaService } from "../../prisma/prisma.service";
import { hashPasswordAsync } from "../../shared/crypto/password.util";
import { AuthSessionService } from "./auth-session.service";
import { EmailOtpService } from "./email-otp.service";
import { PasswordResetService } from "./password-reset.service";
import { BrandCentreAuthService } from "../brand-centre/brand-centre-auth.service";
import { BrandWorkspaceAuthorizationService } from "../brand-centre/brand-workspace-authorization.service";
import { BrandCentreSessionEvictionService } from "../brand-centre/services/brand-centre-session-eviction.service";

describe.skipIf(process.env.BS12_DATABASE_TEST !== "true")(
  "BS-12 PostgreSQL authentication concurrency",
  () => {
    const prisma = new PrismaClient({
      transactionOptions: { maxWait: 10_000, timeout: 10_000 },
    });
    const db = prisma as unknown as PrismaService;
    const config = new ConfigService({
      JWT_SECRET: "bs12-test-signing-secret",
      JWT_ISSUER: "bs12-test-issuer",
      JWT_AUDIENCE: "bs12-test-audience",
      AUTH_OTP_PEPPER: "bs12-test-otp-pepper",
      JWT_ACCESS_TTL: "15m",
      AUTH_REFRESH_TTL: "30d",
      AUTH_OTP_TTL: "10m",
      AUTH_RESET_TTL: "30m",
    });
    const sessions = new AuthSessionService(db, new JwtService(), config);
    const userIds: string[] = [];
    const emails: string[] = [];
    const brandIds: string[] = [];
    const organizationIds: string[] = [];

    beforeAll(() => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !url.pathname.startsWith("/bs12")
      ) {
        throw new Error(
          "BS-12 tests require a disposable local bs12* database",
        );
      }
    });

    afterAll(async () => {
      await prisma.emailOtpChallenge.deleteMany({
        where: { normalizedEmail: { in: emails } },
      });
      await prisma.brandProfile.deleteMany({ where: { id: { in: brandIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.organization.deleteMany({
        where: { id: { in: organizationIds } },
      });
      await prisma.$disconnect();
    });

    async function activeUser() {
      const id = randomUUID();
      const email = `${id}@example.test`;
      userIds.push(id);
      emails.push(email);
      const hash = await hashPasswordAsync("correct-password");
      const organization = await prisma.organization.create({
        data: { name: `BS12 Creator ${id}`, kind: "CREATOR" },
      });
      organizationIds.push(organization.id);
      return prisma.user.create({
        data: {
          id,
          email,
          normalizedEmail: email,
          role: UserRole.CREATOR,
          organizationId: organization.id,
          authState: UserAuthState.ACTIVE,
          emailVerifiedAt: new Date(),
          hashedPassword: hash,
          authMethods: {
            create: {
              type: AuthMethodType.PASSWORD,
              credentialHash: hash,
            },
          },
        },
      });
    }

    async function issueOtp(args: {
      email: string;
      purpose: EmailOtpPurpose;
      userId?: string;
      deliveredCodes?: string[];
    }) {
      let deliveredCode = "";
      const mail = {
        sendAuthenticationOtp: async (input: { code: string }) => {
          deliveredCode = input.code;
          args.deliveredCodes?.push(input.code);
          return "otp-message-id";
        },
      } as unknown as MailService;
      const otp = new EmailOtpService(db, config, mail);
      await otp.issue({
        email: args.email,
        purpose: args.purpose,
        eligible: true,
        userId: args.userId,
      });
      return { otp, deliveredCode };
    }

    it("rotates refresh credentials and revokes on replay", async () => {
      const user = await activeUser();
      const first = await sessions.create(user.id);
      const decoded = new JwtService().decode(first.accessToken) as {
        sid?: string;
      };
      expect(decoded.sid).toBe(first.user.sessionId);
      const second = await sessions.refresh(first.refreshToken);
      expect(second.refreshToken).not.toBe(first.refreshToken);
      await expect(sessions.refresh(first.refreshToken)).rejects.toThrow();
      await expect(
        sessions.validate(user.id, second.user.sessionId!),
      ).rejects.toThrow();
    });

    it("allows one concurrent refresh winner and detects duplicate use", async () => {
      const user = await activeUser();
      const issued = await sessions.create(user.id);
      const results = await Promise.allSettled([
        sessions.refresh(issued.refreshToken),
        sessions.refresh(issued.refreshToken),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
    });

    it("atomically consumes one OTP and stores only an HMAC digest", async () => {
      const user = await activeUser();
      let deliveredCode = "";
      const mail = {
        sendAuthenticationOtp: async (args: { code: string }) => {
          deliveredCode = args.code;
          return "otp-message-id";
        },
      } as unknown as MailService;
      const otp = new EmailOtpService(db, config, mail);
      await otp.issue({
        email: user.email,
        purpose: EmailOtpPurpose.LOGIN,
        eligible: true,
        userId: user.id,
      });
      const stored = await prisma.emailOtpChallenge.findFirstOrThrow({
        where: { normalizedEmail: user.email, purpose: EmailOtpPurpose.LOGIN },
        orderBy: { createdAt: "desc" },
      });
      expect(stored.digest).not.toBe(deliveredCode);
      expect(stored.providerMessageId).toBe("otp-message-id");
      const results = await Promise.allSettled([
        otp.consume({
          email: user.email,
          purpose: EmailOtpPurpose.LOGIN,
          code: deliveredCode,
          userId: user.id,
        }),
        otp.consume({
          email: user.email,
          purpose: EmailOtpPurpose.LOGIN,
          code: deliveredCode,
          userId: user.id,
        }),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
    });

    it("commits each wrong attempt and exhausts exactly at five", async () => {
      const user = await activeUser();
      const { otp, deliveredCode } = await issueOtp({
        email: user.email,
        purpose: EmailOtpPurpose.LOGIN,
        userId: user.id,
      });
      const invalid = () =>
        otp.consume({
          email: user.email,
          purpose: EmailOtpPurpose.LOGIN,
          code: "not-a-valid-code",
          userId: user.id,
        });

      await expect(invalid()).rejects.toThrow(
        "Invalid or expired verification code.",
      );
      let stored = await prisma.emailOtpChallenge.findFirstOrThrow({
        where: { normalizedEmail: user.email, purpose: EmailOtpPurpose.LOGIN },
        orderBy: { createdAt: "desc" },
      });
      expect(stored.attemptCount).toBe(1);
      expect(stored.supersededAt).toBeNull();

      for (let attempt = 2; attempt <= 5; attempt += 1) {
        await expect(invalid()).rejects.toThrow(
          "Invalid or expired verification code.",
        );
      }
      stored = await prisma.emailOtpChallenge.findUniqueOrThrow({
        where: { id: stored.id },
      });
      expect(stored.attemptCount).toBe(5);
      expect(stored.maxAttempts).toBe(5);
      expect(stored.supersededAt).not.toBeNull();

      await expect(
        otp.consume({
          email: user.email,
          purpose: EmailOtpPurpose.LOGIN,
          code: deliveredCode,
          userId: user.id,
        }),
      ).rejects.toThrow("Invalid or expired verification code.");
      await expect(invalid()).rejects.toThrow(
        "Invalid or expired verification code.",
      );
      expect(
        (
          await prisma.emailOtpChallenge.findUniqueOrThrow({
            where: { id: stored.id },
          })
        ).attemptCount,
      ).toBe(5);
    });

    it("serializes concurrent wrong attempts without exceeding the ceiling", async () => {
      const user = await activeUser();
      const { otp } = await issueOtp({
        email: user.email,
        purpose: EmailOtpPurpose.LOGIN,
        userId: user.id,
      });
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () =>
          otp.consume({
            email: user.email,
            purpose: EmailOtpPurpose.LOGIN,
            code: "not-a-valid-code",
            userId: user.id,
          }),
        ),
      );
      expect(results.every((result) => result.status === "rejected")).toBe(
        true,
      );
      const stored = await prisma.emailOtpChallenge.findFirstOrThrow({
        where: { normalizedEmail: user.email, purpose: EmailOtpPurpose.LOGIN },
        orderBy: { createdAt: "desc" },
      });
      expect(stored.attemptCount).toBe(stored.maxAttempts);
      expect(stored.attemptCount).toBe(5);
      expect(stored.supersededAt).not.toBeNull();
    });

    it("keeps an older challenge superseded across a wrong-attempt/resend race", async () => {
      const user = await activeUser();
      const deliveredCodes: string[] = [];
      const issued = await issueOtp({
        email: user.email,
        purpose: EmailOtpPurpose.LOGIN,
        userId: user.id,
        deliveredCodes,
      });
      const original = await prisma.emailOtpChallenge.findFirstOrThrow({
        where: { normalizedEmail: user.email, purpose: EmailOtpPurpose.LOGIN },
        orderBy: { createdAt: "desc" },
      });
      await prisma.emailOtpChallenge.update({
        where: { id: original.id },
        data: { createdAt: new Date(Date.now() - 61_000) },
      });

      const race = await Promise.allSettled([
        issued.otp.consume({
          email: user.email,
          purpose: EmailOtpPurpose.LOGIN,
          code: "not-a-valid-code",
          userId: user.id,
        }),
        issued.otp.issue({
          email: user.email,
          purpose: EmailOtpPurpose.LOGIN,
          eligible: true,
          userId: user.id,
        }),
      ]);
      expect(
        race.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        race.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      const challenges = await prisma.emailOtpChallenge.findMany({
        where: { normalizedEmail: user.email, purpose: EmailOtpPurpose.LOGIN },
        orderBy: { createdAt: "asc" },
      });
      expect(challenges).toHaveLength(2);
      expect(
        challenges.filter(
          (challenge) => !challenge.consumedAt && !challenge.supersededAt,
        ),
      ).toHaveLength(1);
      expect(
        challenges.find((challenge) => challenge.id === original.id)
          ?.supersededAt,
      ).not.toBeNull();
      await expect(
        issued.otp.consume({
          email: user.email,
          purpose: EmailOtpPurpose.LOGIN,
          code: deliveredCodes.at(-1)!,
          userId: user.id,
        }),
      ).resolves.toBe(user.email);
    });

    it("uses the same committed attempt behavior for every OTP purpose", async () => {
      const user = await activeUser();
      const purposes = [
        EmailOtpPurpose.LOGIN,
        EmailOtpPurpose.BRAND_VERIFICATION,
        EmailOtpPurpose.CREATOR_EMAIL_VERIFICATION,
        EmailOtpPurpose.TEAM_INVITE,
        EmailOtpPurpose.SOCIAL_SYNC_INVITE,
      ];
      for (const purpose of purposes) {
        const { otp } = await issueOtp({
          email: user.email,
          purpose,
          userId: user.id,
        });
        await expect(
          otp.consume({
            email: user.email,
            purpose,
            code: "not-a-valid-code",
            userId: user.id,
          }),
        ).rejects.toThrow("Invalid or expired verification code.");
        await expect(
          prisma.emailOtpChallenge.findFirst({
            where: { normalizedEmail: user.email, purpose, attemptCount: 1 },
          }),
        ).resolves.not.toBeNull();
      }
    });

    it("persists deterministic and ambiguous auth-email outcomes", async () => {
      const rejectedUser = await activeUser();
      const rejectedMail = {
        sendAuthenticationOtp: async () => {
          throw new AuthMailDeliveryError("REJECTED");
        },
      } as unknown as MailService;
      await expect(
        new EmailOtpService(db, config, rejectedMail).issue({
          email: rejectedUser.email,
          purpose: EmailOtpPurpose.LOGIN,
          eligible: true,
          userId: rejectedUser.id,
        }),
      ).resolves.toBeUndefined();
      await expect(
        prisma.emailOtpChallenge.findFirstOrThrow({
          where: {
            normalizedEmail: rejectedUser.email,
            purpose: EmailOtpPurpose.LOGIN,
          },
        }),
      ).resolves.toMatchObject({ deliveryStatus: AuthDeliveryStatus.REJECTED });

      const ambiguousUser = await activeUser();
      const ambiguousMail = {
        sendAuthenticationOtp: async () => {
          throw new AuthMailDeliveryError("DELIVERY_UNKNOWN");
        },
      } as unknown as MailService;
      await expect(
        new EmailOtpService(db, config, ambiguousMail).issue({
          email: ambiguousUser.email,
          purpose: EmailOtpPurpose.LOGIN,
          eligible: true,
          userId: ambiguousUser.id,
        }),
      ).resolves.toBeUndefined();
      await expect(
        prisma.emailOtpChallenge.findFirstOrThrow({
          where: {
            normalizedEmail: ambiguousUser.email,
            purpose: EmailOtpPurpose.LOGIN,
          },
        }),
      ).resolves.toMatchObject({
        deliveryStatus: AuthDeliveryStatus.DELIVERY_UNKNOWN,
      });

      for (const classification of ["REJECTED", "DELIVERY_UNKNOWN"] as const) {
        const user = await activeUser();
        const mail = {
          sendPasswordReset: async () => {
            throw new AuthMailDeliveryError(classification);
          },
        } as unknown as MailService;
        await new PasswordResetService(db, config, mail).request(user.email);
        await expect(
          prisma.passwordResetChallenge.findFirstOrThrow({
            where: { userId: user.id },
          }),
        ).resolves.toMatchObject({
          deliveryStatus:
            classification === "REJECTED"
              ? AuthDeliveryStatus.REJECTED
              : AuthDeliveryStatus.DELIVERY_UNKNOWN,
        });
      }
    });

    it("atomically consumes reset once, replaces password, and revokes sessions", async () => {
      const user = await activeUser();
      const session = await sessions.create(user.id);
      let deliveredToken = "";
      const mail = {
        sendPasswordReset: async (args: { rawToken: string }) => {
          deliveredToken = args.rawToken;
          return "reset-message-id";
        },
      } as unknown as MailService;
      const reset = new PasswordResetService(db, config, mail);
      await reset.request(user.email);
      const results = await Promise.allSettled([
        reset.complete(deliveredToken, "new-correct-password"),
        reset.complete(deliveredToken, "different-password"),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      await expect(
        sessions.validate(user.id, session.user.sessionId!),
      ).rejects.toThrow();
    });

    it("denies the same unexpired session immediately after Brand membership removal", async () => {
      const organization = await prisma.organization.create({
        data: { name: "BS12 revocation test", kind: "BRAND" },
      });
      organizationIds.push(organization.id);
      const brand = await prisma.brandProfile.create({
        data: {
          name: "BS12 revocation Brand",
          domain: `${randomUUID()}.example.test`,
          industry: "D2C",
          organizationId: organization.id,
          isVerified: true,
        },
      });
      brandIds.push(brand.id);
      const id = randomUUID();
      const email = `${id}@example.test`;
      userIds.push(id);
      emails.push(email);
      await prisma.user.create({
        data: {
          id,
          email,
          normalizedEmail: email,
          role: UserRole.BRAND,
          organizationId: organization.id,
          authState: UserAuthState.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });
      const membership = await prisma.brandTeamMember.create({
        data: {
          brandProfileId: brand.id,
          userId: id,
          role: BrandRole.BRAND_OWNER,
        },
      });
      const issued = await sessions.create(id);
      const resolver = new BrandWorkspaceAuthorizationService(
        db,
        new BrandCentreAuthService(
          db,
          new BrandCentreSessionEvictionService(db),
        ),
      );
      const tokenUser = await sessions.validate(id, issued.user.sessionId!);
      await expect(
        resolver.resolveBrandContext(tokenUser),
      ).resolves.toMatchObject({
        brandProfileId: brand.id,
      });
      await prisma.brandTeamMember.update({
        where: { id: membership.id },
        data: { isActive: false },
      });
      const sameTokenUser = await sessions.validate(id, issued.user.sessionId!);
      await expect(resolver.resolveBrandContext(sameTokenUser)).rejects.toThrow(
        "Active Brand team membership required",
      );
    });
  },
);
