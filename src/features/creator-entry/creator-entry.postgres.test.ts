import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  AuthMethodType,
  EmailOtpPurpose,
  OrganizationKind,
  OAuthTokenStatus,
  PrismaClient,
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
  SecurityEventType,
  SocialNetworkProvider,
  UserAuthState,
  UserRole,
  type User,
} from "@prisma/client";
import type { TokenPayload } from "google-auth-library";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { MailService } from "../../mail/mail.service";
import type { PrismaService } from "../../prisma/prisma.service";
import { AuthSessionService } from "../auth/auth-session.service";
import { AuthService } from "../auth/auth.service";
import { EmailOtpService } from "../auth/email-otp.service";
import { GoogleAuthService } from "../auth/google-auth.service";
import type { BrandCentreScanService } from "../brand-centre/services/brand-centre-scan.service";
import { BrandVerificationService } from "../brand-onboarding/verification/brand-verification.service";
import { CreatorEntryProvisioningService } from "./creator-entry-provisioning.service";
import { CreatorEntryRegistrationService } from "./creator-entry-registration.service";
import { CreatorEntryStateService } from "./creator-entry-state.service";

const databaseUrl = process.env.C01_I2_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const database = databaseUrl ? describe : describe.skip;

database("C01-I2 account, auth and provisioning", () => {
  const prisma = new PrismaClient({
    transactionOptions: { maxWait: 10_000, timeout: 15_000 },
  });
  const db = prisma as unknown as PrismaService;
  const config = new ConfigService({
    JWT_SECRET: "c01-i2-test-signing-secret",
    JWT_ISSUER: "c01-i2-test-issuer",
    JWT_AUDIENCE: "c01-i2-test-audience",
    JWT_ACCESS_TTL: "15m",
    AUTH_REFRESH_TTL: "30d",
    AUTH_OTP_TTL: "10m",
    AUTH_OTP_PEPPER: "c01-i2-test-otp-pepper",
  });
  const deliveredCodes = new Map<string, string[]>();
  const mail = {
    sendAuthenticationOtp: async (input: { to: string; code: string }) => {
      const codes = deliveredCodes.get(input.to) ?? [];
      codes.push(input.code);
      deliveredCodes.set(input.to, codes);
      return `c01-i2-${randomUUID()}`;
    },
  } as unknown as MailService;
  const sessions = new AuthSessionService(db, new JwtService(), config);
  const emailOtp = new EmailOtpService(db, config, mail);
  const auth = new AuthService(db, sessions, emailOtp);
  const googleAuth = new GoogleAuthService(db, auth);
  const provisioning = new CreatorEntryProvisioningService(db);
  const registration = new CreatorEntryRegistrationService(
    db,
    emailOtp,
    googleAuth,
    provisioning,
    sessions,
  );
  const state = new CreatorEntryStateService(db);
  const googlePayloads = new Map<string, TokenPayload>();
  const scan = {
    enqueueOnboardingDeepScan: vi
      .fn()
      .mockResolvedValue({ jobId: "c01-i2-scan" }),
  } as unknown as BrandCentreScanService;
  const brandVerification = new BrandVerificationService(
    db,
    mail,
    scan,
    auth,
    googleAuth,
  );

  vi.spyOn(googleAuth, "verifyIdTokenPayload").mockImplementation(
    async (idToken) => {
      const payload = googlePayloads.get(idToken);
      if (!payload) throw new Error("Missing C01-I2 Google test identity");
      return payload;
    },
  );

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !/^\/c01_i2_[a-z0-9_]+$/.test(url.pathname)
    ) {
      throw new Error("C01_I2_TEST_REQUIRES_DISPOSABLE_DATABASE");
    }
    await prisma.$connect();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.$disconnect();
  });

  function email(label: string): string {
    return `${label}-${randomUUID()}@creator.example.test`;
  }

  function latestCode(normalizedEmail: string): string {
    const codes = deliveredCodes.get(normalizedEmail) ?? [];
    const code = codes[codes.length - 1];
    if (!code) throw new Error(`No OTP delivered for ${normalizedEmail}`);
    return code;
  }

  function googleIdentity(args: {
    token?: string;
    email: string;
    subject?: string;
    name?: string;
  }): string {
    const token = args.token ?? `token-${randomUUID()}`;
    googlePayloads.set(token, {
      sub: args.subject ?? `subject-${randomUUID()}`,
      email: args.email,
      email_verified: true,
      name: args.name ?? "I2 Creator",
    } as TokenPayload);
    return token;
  }

  function authUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    };
  }

  async function registerPassword(normalizedEmail: string) {
    await registration.registerPassword({
      email: normalizedEmail,
      password: "valid-password-123",
    });
    return prisma.user.findUniqueOrThrow({
      where: { normalizedEmail },
      include: { authMethods: true },
    });
  }

  async function canonicalCreator(normalizedEmail = email("canonical")) {
    const provisional = await registerPassword(normalizedEmail);
    const issued = await registration.verifyEmailOtp(
      normalizedEmail,
      latestCode(normalizedEmail),
    );
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: provisional.id },
      include: {
        organization: true,
        creatorProfile: {
          include: {
            ownedWorkspaces: { include: { members: true } },
          },
        },
      },
    });
    return { user, issued };
  }

  async function inactiveBrandProfile(normalizedEmail: string) {
    const domain = normalizedEmail.split("@")[1]!;
    return prisma.brandProfile.create({
      data: {
        domain,
        name: `I2 Brand ${randomUUID()}`,
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
        verificationEmail: normalizedEmail,
        identityConfirmedAt: new Date(),
      },
    });
  }

  async function activeBrand(normalizedEmail = email("brand")) {
    const organization = await prisma.organization.create({
      data: { name: `I2 Brand ${randomUUID()}`, kind: OrganizationKind.BRAND },
    });
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        normalizedEmail,
        role: UserRole.BRAND,
        authState: UserAuthState.ACTIVE,
        emailVerifiedAt: new Date(),
        organizationId: organization.id,
      },
    });
    return { organization, user };
  }

  async function ageLatestCreatorOtp(normalizedEmail: string) {
    const challenge = await prisma.emailOtpChallenge.findFirstOrThrow({
      where: {
        normalizedEmail,
        purpose: EmailOtpPurpose.CREATOR_EMAIL_VERIFICATION,
      },
      orderBy: { createdAt: "desc" },
    });
    await prisma.emailOtpChallenge.update({
      where: { id: challenge.id },
      data: { createdAt: new Date(Date.now() - 61_000) },
    });
    return challenge;
  }

  describe("password registration and verification", () => {
    it("creates only a sterile provisional identity and no session", async () => {
      const normalizedEmail = email("provisional");
      const result = await registration.registerPassword({
        email: normalizedEmail.toUpperCase(),
        password: "valid-password-123",
      });
      expect(result).toMatchObject({
        accepted: true,
        nextAction: "VERIFY_EMAIL",
      });
      const user = await prisma.user.findUniqueOrThrow({
        where: { normalizedEmail },
        include: { authMethods: true },
      });
      expect(user).toMatchObject({
        role: UserRole.CREATOR,
        authState: UserAuthState.PROVISIONAL,
        organizationId: null,
        emailVerifiedAt: null,
      });
      expect(user.authMethods).toHaveLength(1);
      expect(user.authMethods[0]).toMatchObject({
        type: AuthMethodType.PASSWORD,
      });
      expect(user.authMethods[0].credentialHash).not.toContain(
        "valid-password-123",
      );
      expect(
        await prisma.creatorProfile.count({ where: { userId: user.id } }),
      ).toBe(0);
      expect(
        await prisma.authSession.count({ where: { userId: user.id } }),
      ).toBe(0);
      expect(
        await prisma.organization.count({
          where: { users: { some: { id: user.id } } },
        }),
      ).toBe(0);
    });

    it("reuses one sterile User and replaces its password and live OTP", async () => {
      const normalizedEmail = email("repeat");
      const first = await registerPassword(normalizedEmail);
      const firstHash = first.authMethods[0].credentialHash;
      const firstChallenge = await ageLatestCreatorOtp(normalizedEmail);
      await registration.registerPassword({
        email: normalizedEmail,
        password: "replacement-password-456",
      });
      const users = await prisma.user.findMany({
        where: { normalizedEmail },
        include: { authMethods: true },
      });
      expect(users).toHaveLength(1);
      expect(users[0].id).toBe(first.id);
      expect(users[0].authMethods).toHaveLength(1);
      expect(users[0].authMethods[0].credentialHash).not.toBe(firstHash);
      expect(
        (
          await prisma.emailOtpChallenge.findUniqueOrThrow({
            where: { id: firstChallenge.id },
          })
        ).supersededAt,
      ).not.toBeNull();
      expect(
        await prisma.emailOtpChallenge.count({
          where: {
            normalizedEmail,
            purpose: EmailOtpPurpose.CREATOR_EMAIL_VERIFICATION,
          },
        }),
      ).toBe(2);
      expect(users[0].organizationId).toBeNull();
    });

    it("serializes concurrent duplicate password submissions", async () => {
      const normalizedEmail = email("concurrent-password");
      const attempts = await Promise.allSettled([
        registration.registerPassword({
          email: normalizedEmail,
          password: "valid-password-123",
        }),
        registration.registerPassword({
          email: normalizedEmail,
          password: "valid-password-123",
        }),
      ]);
      expect(attempts.every((attempt) => attempt.status === "fulfilled")).toBe(
        true,
      );
      const users = await prisma.user.findMany({
        where: { normalizedEmail },
        include: { authMethods: true },
      });
      expect(users).toHaveLength(1);
      expect(users[0].authMethods).toHaveLength(1);
      expect(users[0].organizationId).toBeNull();
    });

    it("returns one generic conflict for ACTIVE Brand and Creator accounts", async () => {
      const creator = await canonicalCreator();
      const brand = await activeBrand();
      for (const activeEmail of [creator.user.email, brand.user.email]) {
        await expect(
          registration.registerPassword({
            email: activeEmail,
            password: "valid-password-123",
          }),
        ).rejects.toMatchObject({
          response: {
            code: "ACCOUNT_EXISTS_SIGN_IN_REQUIRED",
            message: "An account already exists. Sign in to continue.",
          },
        });
      }
    });

    it("keeps OTP request enumeration-resistant", async () => {
      const eligibleEmail = email("otp-eligible");
      const unknownEmail = email("otp-unknown");
      await registerPassword(eligibleEmail);
      await ageLatestCreatorOtp(eligibleEmail);
      const eligible = await registration.requestVerificationOtp(eligibleEmail);
      const unknown = await registration.requestVerificationOtp(unknownEmail);
      expect(eligible).toEqual(unknown);
      expect(
        await prisma.emailOtpChallenge.count({
          where: {
            normalizedEmail: unknownEmail,
            purpose: EmailOtpPurpose.CREATOR_EMAIL_VERIFICATION,
          },
        }),
      ).toBe(0);
    });

    it("rejects invalid, expired and replayed OTPs with one stable code", async () => {
      const invalidEmail = email("invalid-otp");
      const invalidUser = await registerPassword(invalidEmail);
      await expect(
        registration.verifyEmailOtp(invalidEmail, "000000"),
      ).rejects.toMatchObject({
        response: { code: "EMAIL_VERIFICATION_INVALID_OR_EXPIRED" },
      });
      expect(
        await prisma.creatorProfile.count({
          where: { userId: invalidUser.id },
        }),
      ).toBe(0);

      const expiredEmail = email("expired-otp");
      const expiredUser = await registerPassword(expiredEmail);
      await prisma.emailOtpChallenge.updateMany({
        where: {
          normalizedEmail: expiredEmail,
          purpose: EmailOtpPurpose.CREATOR_EMAIL_VERIFICATION,
        },
        data: { expiresAt: new Date(Date.now() - 1_000) },
      });
      await expect(
        registration.verifyEmailOtp(expiredEmail, latestCode(expiredEmail)),
      ).rejects.toMatchObject({
        response: { code: "EMAIL_VERIFICATION_INVALID_OR_EXPIRED" },
      });
      expect(
        await prisma.creatorProfile.count({
          where: { userId: expiredUser.id },
        }),
      ).toBe(0);

      const replayEmail = email("replay-otp");
      await registerPassword(replayEmail);
      const code = latestCode(replayEmail);
      await registration.verifyEmailOtp(replayEmail, code);
      await expect(
        registration.verifyEmailOtp(replayEmail, code),
      ).rejects.toMatchObject({
        response: { code: "EMAIL_VERIFICATION_INVALID_OR_EXPIRED" },
      });
    });

    it("atomically creates the canonical context and one concurrent session", async () => {
      const normalizedEmail = email("verify-concurrent");
      const provisional = await registerPassword(normalizedEmail);
      const code = latestCode(normalizedEmail);
      const results = await Promise.allSettled([
        registration.verifyEmailOtp(normalizedEmail, code),
        registration.verifyEmailOtp(normalizedEmail, code),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: provisional.id },
        include: {
          organization: true,
          creatorProfile: {
            include: { ownedWorkspaces: { include: { members: true } } },
          },
        },
      });
      expect(user).toMatchObject({
        authState: UserAuthState.ACTIVE,
        role: UserRole.CREATOR,
        emailVerifiedAt: expect.any(Date),
        organization: { kind: OrganizationKind.CREATOR },
      });
      const workspaces = user.creatorProfile!.ownedWorkspaces;
      expect(workspaces).toHaveLength(1);
      expect(workspaces[0].organizationId).toBe(user.organizationId);
      expect(workspaces[0].members).toHaveLength(1);
      expect(workspaces[0].members[0]).toMatchObject({
        assignedProfileId: user.creatorProfile!.id,
        securityRole: "OWNER",
        isActive: true,
      });
      expect(
        await prisma.authSession.count({ where: { userId: user.id } }),
      ).toBe(1);
    });

    it("rolls provisioning back without a session and remains retryable", async () => {
      const normalizedEmail = email("rollback");
      const provisional = await registerPassword(normalizedEmail);
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION c01_i2_fail_owner_insert()
        RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'C01_I2_FORCED_OWNER_FAILURE';
        END;
        $$ LANGUAGE plpgsql
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER c01_i2_fail_owner_insert_trigger
        BEFORE INSERT ON creator_workspace_members
        FOR EACH ROW EXECUTE FUNCTION c01_i2_fail_owner_insert()
      `);
      try {
        await expect(
          registration.verifyEmailOtp(
            normalizedEmail,
            latestCode(normalizedEmail),
          ),
        ).rejects.toThrow(/C01_I2_FORCED_OWNER_FAILURE/);
      } finally {
        await prisma.$executeRawUnsafe(
          "DROP TRIGGER IF EXISTS c01_i2_fail_owner_insert_trigger ON creator_workspace_members",
        );
        await prisma.$executeRawUnsafe(
          "DROP FUNCTION IF EXISTS c01_i2_fail_owner_insert()",
        );
      }
      const rolledBack = await prisma.user.findUniqueOrThrow({
        where: { id: provisional.id },
      });
      expect(rolledBack).toMatchObject({
        authState: UserAuthState.PROVISIONAL,
        organizationId: null,
        emailVerifiedAt: null,
      });
      expect(
        await prisma.creatorProfile.count({
          where: { userId: provisional.id },
        }),
      ).toBe(0);
      expect(
        await prisma.authSession.count({ where: { userId: provisional.id } }),
      ).toBe(0);

      await ageLatestCreatorOtp(normalizedEmail);
      await registration.requestVerificationOtp(normalizedEmail);
      await registration.verifyEmailOtp(
        normalizedEmail,
        latestCode(normalizedEmail),
      );
      expect(
        await prisma.authSession.count({ where: { userId: provisional.id } }),
      ).toBe(1);
    });
  });

  describe("Google registration and shared sign-in", () => {
    it("creates one canonical Google Creator and signs the same subject in", async () => {
      const normalizedEmail = email("google-new");
      const subject = `subject-${randomUUID()}`;
      const firstToken = googleIdentity({ email: normalizedEmail, subject });
      const secondToken = googleIdentity({ email: normalizedEmail, subject });
      const first = await registration.registerGoogle(firstToken);
      const second = await registration.registerGoogle(secondToken);
      expect(first.user.id).toBe(second.user.id);
      const user = await prisma.user.findUniqueOrThrow({
        where: { normalizedEmail },
        include: {
          authMethods: true,
          organization: true,
          creatorProfile: {
            include: { ownedWorkspaces: { include: { members: true } } },
          },
        },
      });
      expect(user.authMethods).toHaveLength(1);
      expect(user.authMethods[0]).toMatchObject({
        type: AuthMethodType.GOOGLE,
        providerSubjectId: subject,
      });
      expect(user.organization?.kind).toBe(OrganizationKind.CREATOR);
      expect(user.creatorProfile?.ownedWorkspaces).toHaveLength(1);
      expect(
        await prisma.authSession.count({ where: { userId: user.id } }),
      ).toBe(2);
      expect(
        await prisma.creatorSocialIntegration.count({
          where: { creatorProfileId: user.creatorProfile!.id },
        }),
      ).toBe(0);
    });

    it("safely links Google to an ACTIVE canonical password Creator", async () => {
      const creator = await canonicalCreator();
      const subject = `subject-${randomUUID()}`;
      const token = googleIdentity({
        email: creator.user.email,
        subject,
        name: "Linked Creator",
      });
      const result = await registration.registerGoogle(token);
      expect(result.user.id).toBe(creator.user.id);
      expect(
        await prisma.userAuthMethod.findUnique({
          where: {
            userId_type: {
              userId: creator.user.id,
              type: AuthMethodType.GOOGLE,
            },
          },
        }),
      ).toMatchObject({ providerSubjectId: subject });
      expect(
        await prisma.creatorProfile.count({
          where: { userId: creator.user.id },
        }),
      ).toBe(1);
    });

    it("rejects ACTIVE Brand context and both Google identity conflicts", async () => {
      const brand = await activeBrand();
      const brandToken = googleIdentity({ email: brand.user.email });
      await expect(
        registration.registerGoogle(brandToken),
      ).rejects.toMatchObject({
        response: { code: "ACCOUNT_CONTEXT_CONFLICT" },
      });

      const ownerEmail = email("google-owner");
      const ownerSubject = `subject-${randomUUID()}`;
      await registration.registerGoogle(
        googleIdentity({ email: ownerEmail, subject: ownerSubject }),
      );
      const owner = await prisma.user.findUniqueOrThrow({
        where: { normalizedEmail: ownerEmail },
      });
      const otherEmail = email("google-subject-conflict");
      await expect(
        registration.registerGoogle(
          googleIdentity({ email: otherEmail, subject: ownerSubject }),
        ),
      ).rejects.toMatchObject({
        response: { code: "GOOGLE_IDENTITY_CONFLICT" },
      });
      await expect(
        registration.registerGoogle(
          googleIdentity({
            email: ownerEmail,
            subject: `different-${randomUUID()}`,
          }),
        ),
      ).rejects.toMatchObject({
        response: { code: "GOOGLE_IDENTITY_CONFLICT" },
      });
      expect(
        await prisma.securityEvent.count({
          where: {
            userId: owner.id,
            type: SecurityEventType.GOOGLE_LINK_CONFLICT,
          },
        }),
      ).toBe(2);
      expect(
        await prisma.user.count({ where: { normalizedEmail: otherEmail } }),
      ).toBe(0);
    });

    it("reuses a sterile password placeholder and supersedes its Creator OTP", async () => {
      const normalizedEmail = email("google-reuse");
      const provisional = await registerPassword(normalizedEmail);
      const challenge = await prisma.emailOtpChallenge.findFirstOrThrow({
        where: {
          normalizedEmail,
          purpose: EmailOtpPurpose.CREATOR_EMAIL_VERIFICATION,
        },
      });
      const result = await registration.registerGoogle(
        googleIdentity({ email: normalizedEmail }),
      );
      expect(result.user.id).toBe(provisional.id);
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: provisional.id },
      });
      expect(user.authState).toBe(UserAuthState.ACTIVE);
      expect(user.organizationId).not.toBeNull();
      expect(
        (
          await prisma.emailOtpChallenge.findUniqueOrThrow({
            where: { id: challenge.id },
          })
        ).supersededAt,
      ).not.toBeNull();
      expect(await prisma.user.count({ where: { normalizedEmail } })).toBe(1);
    });

    it("serializes concurrent Google registration into one context", async () => {
      const normalizedEmail = email("google-concurrent");
      const subject = `subject-${randomUUID()}`;
      const results = await Promise.allSettled([
        registration.registerGoogle(
          googleIdentity({ email: normalizedEmail, subject }),
        ),
        registration.registerGoogle(
          googleIdentity({ email: normalizedEmail, subject }),
        ),
      ]);
      expect(results.every((result) => result.status === "fulfilled")).toBe(
        true,
      );
      const users = await prisma.user.findMany({
        where: { normalizedEmail },
        include: { creatorProfile: { include: { ownedWorkspaces: true } } },
      });
      expect(users).toHaveLength(1);
      expect(users[0].creatorProfile?.ownedWorkspaces).toHaveLength(1);
    });

    it("does not let legacy onboardingTrackId create via shared Google sign-in", async () => {
      const normalizedEmail = email("legacy-google-bypass");
      const token = googleIdentity({ email: normalizedEmail });
      await expect(
        googleAuth.signInWithGoogle({
          idToken: token,
          onboardingTrackId: randomUUID(),
        }),
      ).rejects.toMatchObject({
        response: { code: "GOOGLE_REGISTRATION_REQUIRED" },
      });
      expect(await prisma.user.count({ where: { normalizedEmail } })).toBe(0);
      expect(
        await prisma.organization.count({
          where: { name: { contains: "legacy-google-bypass" } },
        }),
      ).toBe(0);
    });

    it("preserves shared Google link and sign-in for an existing ACTIVE Brand", async () => {
      const brand = await activeBrand();
      const subject = `brand-subject-${randomUUID()}`;
      const firstToken = googleIdentity({
        email: brand.user.email,
        subject,
        name: "Existing Brand Owner",
      });
      const secondToken = googleIdentity({
        email: brand.user.email,
        subject,
        name: "Existing Brand Owner",
      });
      const first = await googleAuth.signInWithGoogle({ idToken: firstToken });
      const second = await googleAuth.signInWithGoogle({
        idToken: secondToken,
      });
      expect(first.user.id).toBe(brand.user.id);
      expect(second.user.id).toBe(brand.user.id);
      expect(
        await prisma.userAuthMethod.findUnique({
          where: {
            userId_type: {
              userId: brand.user.id,
              type: AuthMethodType.GOOGLE,
            },
          },
        }),
      ).toMatchObject({ providerSubjectId: subject });
      expect(
        (
          await prisma.user.findUniqueOrThrow({
            where: { id: brand.user.id },
          })
        ).role,
      ).toBe(UserRole.BRAND);
      expect(
        await prisma.creatorProfile.count({ where: { userId: brand.user.id } }),
      ).toBe(0);
    });
  });

  describe("Brand/Creator identity reconciliation", () => {
    it("lets verified Brand activation reclaim only a sterile placeholder", async () => {
      const domain = `${randomUUID()}.brand.example.test`;
      const normalizedEmail = `owner@${domain}`;
      const provisional = await registerPassword(normalizedEmail);
      const challenge = await prisma.emailOtpChallenge.findFirstOrThrow({
        where: {
          normalizedEmail,
          purpose: EmailOtpPurpose.CREATOR_EMAIL_VERIFICATION,
        },
      });
      const profile = await inactiveBrandProfile(normalizedEmail);
      const activated = await brandVerification.setPasswordAndActivate(
        profile.id,
        normalizedEmail,
        "brand-password-123",
      );
      expect(activated.user.id).toBe(provisional.id);
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: provisional.id },
        include: { organization: true, brandTeamMemberships: true },
      });
      expect(user).toMatchObject({
        role: UserRole.BRAND,
        authState: UserAuthState.ACTIVE,
        organization: { kind: OrganizationKind.BRAND },
      });
      expect(user.brandTeamMemberships).toHaveLength(1);
      expect(
        (
          await prisma.emailOtpChallenge.findUniqueOrThrow({
            where: { id: challenge.id },
          })
        ).supersededAt,
      ).not.toBeNull();
      await expect(
        registration.verifyEmailOtp(
          normalizedEmail,
          latestCode(normalizedEmail),
        ),
      ).rejects.toMatchObject({
        response: { code: "EMAIL_VERIFICATION_INVALID_OR_EXPIRED" },
      });
      expect(
        await prisma.creatorProfile.count({ where: { userId: user.id } }),
      ).toBe(0);
    });

    it("never reclaims an ACTIVE canonical Creator", async () => {
      const domain = `${randomUUID()}.brand.example.test`;
      const normalizedEmail = `owner@${domain}`;
      const creator = await canonicalCreator(normalizedEmail);
      const profile = await inactiveBrandProfile(normalizedEmail);
      await expect(
        brandVerification.setPasswordAndActivate(
          profile.id,
          normalizedEmail,
          "brand-password-123",
        ),
      ).rejects.toThrow("another account type");
      expect(
        (
          await prisma.user.findUniqueOrThrow({
            where: { id: creator.user.id },
          })
        ).role,
      ).toBe(UserRole.CREATOR);
    });

    it("leaves no live Creator OTP when Brand activation races a resend", async () => {
      const domain = `${randomUUID()}.resend-race.example.test`;
      const normalizedEmail = `owner@${domain}`;
      await registerPassword(normalizedEmail);
      await ageLatestCreatorOtp(normalizedEmail);
      const profile = await inactiveBrandProfile(normalizedEmail);
      const results = await Promise.allSettled([
        registration.requestVerificationOtp(normalizedEmail),
        brandVerification.setPasswordAndActivate(
          profile.id,
          normalizedEmail,
          "brand-password-123",
        ),
      ]);
      expect(results.every((result) => result.status === "fulfilled")).toBe(
        true,
      );
      expect(
        await prisma.emailOtpChallenge.count({
          where: {
            normalizedEmail,
            purpose: EmailOtpPurpose.CREATOR_EMAIL_VERIFICATION,
            consumedAt: null,
            supersededAt: null,
          },
        }),
      ).toBe(0);
      expect(
        (
          await prisma.user.findUniqueOrThrow({
            where: { normalizedEmail },
          })
        ).role,
      ).toBe(UserRole.BRAND);
    });

    it("serializes Brand and Creator activation so exactly one context wins", async () => {
      const domain = `${randomUUID()}.race.example.test`;
      const normalizedEmail = `owner@${domain}`;
      const provisional = await registerPassword(normalizedEmail);
      const profile = await inactiveBrandProfile(normalizedEmail);
      const results = await Promise.allSettled([
        registration.verifyEmailOtp(
          normalizedEmail,
          latestCode(normalizedEmail),
        ),
        brandVerification.setPasswordAndActivate(
          profile.id,
          normalizedEmail,
          "brand-password-123",
        ),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: provisional.id },
        include: { organization: true },
      });
      expect(user.authState).toBe(UserAuthState.ACTIVE);
      expect(user.organization?.kind).toBe(
        user.role === UserRole.BRAND
          ? OrganizationKind.BRAND
          : OrganizationKind.CREATOR,
      );
      expect(
        await prisma.creatorProfile.count({ where: { userId: user.id } }),
      ).toBe(user.role === UserRole.CREATOR ? 1 : 0);
      expect(
        await prisma.brandTeamMember.count({
          where: { userId: user.id, brandProfileId: profile.id },
        }),
      ).toBe(user.role === UserRole.BRAND ? 1 : 0);
      expect(
        await prisma.authSession.count({ where: { userId: user.id } }),
      ).toBe(1);
    });
  });

  describe("read-only C-01 state projection", () => {
    it("projects Brand conflict and malformed Creator recovery without repair", async () => {
      const brand = await activeBrand();
      expect(await state.read(authUser(brand.user))).toMatchObject({
        accountContext: "ACCOUNT_CONTEXT_CONFLICT",
        canEnterCreatorPlatform: false,
        nextAction: "RESOLVE_ACCOUNT_CONTEXT",
      });

      const organization = await prisma.organization.create({
        data: {
          name: `Malformed ${randomUUID()}`,
          kind: OrganizationKind.CREATOR,
        },
      });
      const malformed = await prisma.user.create({
        data: {
          email: email("malformed"),
          role: UserRole.CREATOR,
          authState: UserAuthState.ACTIVE,
          emailVerifiedAt: new Date(),
          organizationId: organization.id,
        },
      });
      expect(await state.read(authUser(malformed))).toMatchObject({
        accountContext: "CONTEXT_RECOVERY_REQUIRED",
        canEnterCreatorPlatform: false,
        nextAction: "RECOVER_CREATOR_CONTEXT",
      });
      expect(
        await prisma.creatorProfile.count({ where: { userId: malformed.id } }),
      ).toBe(0);
    });

    it("projects no Instagram as incomplete without mutating persistence", async () => {
      const creator = await canonicalCreator();
      const before = await prisma.user.findUniqueOrThrow({
        where: { id: creator.user.id },
        include: {
          creatorProfile: { include: { ownedWorkspaces: true } },
        },
      });
      const result = await state.read(authUser(before));
      expect(result).toMatchObject({
        accountContext: "CREATOR_READY",
        onboardingStatus: "INCOMPLETE",
        canEnterCreatorPlatform: false,
        nextAction: "CONNECT_INSTAGRAM",
        instagram: {
          identityConnection: "NOT_CONNECTED",
          basicAuthorization: ProviderCapabilityState.UNKNOWN,
          insightsCapability: ProviderCapabilityState.UNKNOWN,
          authorizationHealth: ProviderAuthorizationHealth.UNKNOWN,
        },
      });
      const after = await prisma.user.findUniqueOrThrow({
        where: { id: creator.user.id },
        include: {
          creatorProfile: { include: { ownedWorkspaces: true } },
        },
      });
      expect(after.updatedAt).toEqual(before.updatedAt);
      expect(after.creatorProfile!.updatedAt).toEqual(
        before.creatorProfile!.updatedAt,
      );
      expect(after.creatorProfile!.ownedWorkspaces[0].updatedAt).toEqual(
        before.creatorProfile!.ownedWorkspaces[0].updatedAt,
      );
    });

    it.each([
      {
        label: "a persisted disconnect timestamp",
        tokenState: OAuthTokenStatus.ACTIVE,
        basic: ProviderCapabilityState.AVAILABLE,
        health: ProviderAuthorizationHealth.UNKNOWN,
        disconnectedAt: new Date(),
        expectedIdentity: "DISCONNECTED",
        expectedAction: "RECONNECT_INSTAGRAM",
      },
      {
        label: "DISCONNECTED authorization health",
        tokenState: OAuthTokenStatus.ACTIVE,
        basic: ProviderCapabilityState.AVAILABLE,
        health: ProviderAuthorizationHealth.DISCONNECTED,
        disconnectedAt: new Date(),
        expectedIdentity: "DISCONNECTED",
        expectedAction: "RECONNECT_INSTAGRAM",
      },
      {
        label: "an expired token requiring reauthorization",
        tokenState: OAuthTokenStatus.EXPIRED,
        basic: ProviderCapabilityState.AVAILABLE,
        health: ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
        disconnectedAt: null,
        expectedIdentity: "CONNECTED",
        expectedAction: "RECONNECT_INSTAGRAM",
      },
      {
        label: "unavailable basic authorization requiring reauthorization",
        tokenState: OAuthTokenStatus.ACTIVE,
        basic: ProviderCapabilityState.UNAVAILABLE,
        health: ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
        disconnectedAt: null,
        expectedIdentity: "CONNECTED",
        expectedAction: "RECONNECT_INSTAGRAM",
      },
      {
        label: "provider-blocked authorization",
        tokenState: OAuthTokenStatus.ACTIVE,
        basic: ProviderCapabilityState.AVAILABLE,
        health: ProviderAuthorizationHealth.PROVIDER_ACCESS_BLOCKED,
        disconnectedAt: null,
        expectedIdentity: "CONNECTED",
        expectedAction: "REVALIDATE_INSTAGRAM",
      },
      {
        label: "unknown authorization health",
        tokenState: OAuthTokenStatus.ACTIVE,
        basic: ProviderCapabilityState.AVAILABLE,
        health: ProviderAuthorizationHealth.UNKNOWN,
        disconnectedAt: null,
        expectedIdentity: "CONNECTED",
        expectedAction: "REVALIDATE_INSTAGRAM",
      },
    ])(
      "keeps $label outside entry without erasing stable identity",
      async ({
        tokenState,
        basic,
        health,
        disconnectedAt,
        expectedIdentity,
        expectedAction,
      }) => {
        const creator = await canonicalCreator();
        await prisma.creatorSocialIntegration.create({
          data: {
            creatorProfileId: creator.user.creatorProfile!.id,
            platformNetwork: SocialNetworkProvider.INSTAGRAM,
            nativePlatformUserId: `ig-${randomUUID()}`,
            channelHandleString: `creator_${randomUUID()}`,
            oauthAccessTokenEncrypted: "test-only-encrypted-token",
            tokenStateCondition: tokenState,
            basicAuthorizationCapability: basic,
            insightsCapability: ProviderCapabilityState.UNKNOWN,
            authorizationHealth: health,
            disconnectedAt,
          },
        });
        expect(await state.read(authUser(creator.user))).toMatchObject({
          accountContext: "CREATOR_READY",
          onboardingStatus: "INCOMPLETE",
          canEnterCreatorPlatform: false,
          nextAction: expectedAction,
          instagram: {
            identityConnection: expectedIdentity,
            basicAuthorization: basic,
            insightsCapability: ProviderCapabilityState.UNKNOWN,
            authorizationHealth: health,
          },
        });
      },
    );

    it.each([
      ProviderCapabilityState.UNAVAILABLE,
      ProviderCapabilityState.UNKNOWN,
    ])(
      "allows entry with usable basic authorization when Insights are %s",
      async (insightsCapability) => {
        const creator = await canonicalCreator();
        const integration = await prisma.creatorSocialIntegration.create({
          data: {
            creatorProfileId: creator.user.creatorProfile!.id,
            platformNetwork: SocialNetworkProvider.INSTAGRAM,
            nativePlatformUserId: `ig-${randomUUID()}`,
            channelHandleString: `creator_${randomUUID()}`,
            oauthAccessTokenEncrypted: "test-only-encrypted-token",
            tokenStateCondition: OAuthTokenStatus.ACTIVE,
            basicAuthorizationCapability: ProviderCapabilityState.AVAILABLE,
            insightsCapability,
            authorizationHealth: ProviderAuthorizationHealth.USABLE,
          },
        });
        const result = await state.read(authUser(creator.user));
        expect(result).toMatchObject({
          accountContext: "CREATOR_READY",
          onboardingStatus: "COMPLETE",
          canEnterCreatorPlatform: true,
          nextAction: "CREATOR_WORKSPACE_ENTRY",
          instagram: {
            identityConnection: "CONNECTED",
            basicAuthorization: ProviderCapabilityState.AVAILABLE,
            insightsCapability,
            authorizationHealth: ProviderAuthorizationHealth.USABLE,
          },
        });
        expect(
          (
            await prisma.creatorSocialIntegration.findUniqueOrThrow({
              where: { id: integration.id },
            })
          ).updatedAt,
        ).toEqual(integration.updatedAt);
      },
    );
  });
});
