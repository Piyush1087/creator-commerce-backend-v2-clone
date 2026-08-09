import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { addMinutes } from "date-fns";

import { MailService } from "../../../mail/mail.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuthService } from "../../auth/auth.service";
import { GoogleAuthService } from "../../auth/google-auth.service";
import { BrandCentreScanService } from "../../brand-centre/services/brand-centre-scan.service";
import {
  emailDomainFromAddress,
  emailDomainMatchesBrandDomain,
  emailLocalPart,
  isBannedPublicEmailProvider,
  isValidVerificationEmail,
  normalizeVerificationEmail,
  verificationCodeIdentifier,
} from "./brand-verification-email.util";

/** Pre-prod stub code. PROD: set BRAND_VERIFICATION_USE_REAL_OTP=true in .env */
const STUB_OTP_CODE = "123456";

const OTP_TTL_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 3;
const SEND_LIMIT_PER_WINDOW = 3;
const SEND_WINDOW_MS = 60_000;

type PostmarkInactiveError = {
  statusCode?: number;
  message?: string;
};

/**
 * @see docs/brand-onboarding/VERIFICATION_OTP_TOGGLE.md
 */
function isRealBrandVerificationOtpEnabled(): boolean {
  return process.env.BRAND_VERIFICATION_USE_REAL_OTP === "true";
}

@Injectable()
export class BrandVerificationService {
  private readonly logger = new Logger(BrandVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly brandCentreScan: BrandCentreScanService,
    private readonly auth: AuthService,
    private readonly googleAuth: GoogleAuthService,
  ) {}

  async sendOtp(brandProfileId: string, rawEmail: string) {
    if (!isRealBrandVerificationOtpEnabled()) {
      return this.sendOtpStub(brandProfileId, rawEmail);
    }
    return this.sendOtpReal(brandProfileId, rawEmail);
  }

  async verifyOtp(brandProfileId: string, rawEmail: string, rawOtp: string) {
    if (!isRealBrandVerificationOtpEnabled()) {
      return this.verifyOtpStub(brandProfileId, rawEmail, rawOtp);
    }
    return this.verifyOtpReal(brandProfileId, rawEmail, rawOtp);
  }

  /**
   * Path B: Google Workspace identity confirmation (does not create User / set isVerified).
   */
  async confirmGoogleIdentity(brandProfileId: string, idToken: string) {
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { id: true, domain: true, isVerified: true },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }
    if (profile.isVerified) {
      throw new BadRequestException(
        "This brand is already verified. Please sign in.",
      );
    }

    const payload = await this.googleAuth.verifyIdTokenPayload(idToken);
    if (!payload.email) {
      throw new BadRequestException("Google account must include an email.");
    }
    const email = normalizeVerificationEmail(payload.email);
    const emailVerified =
      payload.email_verified === true || payload.email_verified === "true";
    if (!emailVerified) {
      throw new BadRequestException("Google email is not verified.");
    }

    if (isBannedPublicEmailProvider(email)) {
      throw new BadRequestException(
        "Public consumer accounts cannot be used for brand verification. Please sign in with your official corporate Google Workspace account.",
      );
    }

    if (!emailDomainMatchesBrandDomain(email, profile.domain)) {
      const emailDomain = emailDomainFromAddress(email);
      throw new BadRequestException(
        `The authenticated Google account (@${emailDomain}) does not match your registered brand website domain (${profile.domain}). Please sign in with the correct workspace account.`,
      );
    }

    await this.markIdentityConfirmed(brandProfileId, email);

    return {
      identityConfirmed: true,
      brandProfileId: profile.id,
      domain: profile.domain,
      email,
      nextStep: "password" as const,
    };
  }

  /**
   * Unified password gate for OTP + Google paths.
   * Creates Brand User with hashedPassword, sets isVerified, enqueues deep scan.
   */
  async setPasswordAndActivate(
    brandProfileId: string,
    rawEmail: string,
    rawPassword: string,
  ) {
    const email = normalizeVerificationEmail(rawEmail);
    const password = rawPassword;
    if (password.trim().length === 0) {
      throw new BadRequestException(
        "Passwords cannot consist entirely of blank spaces. Please enter at least 8 visible characters.",
      );
    }
    if (password.length < 8) {
      throw new BadRequestException(
        "Password must be at least 8 characters long.",
      );
    }

    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: {
        id: true,
        name: true,
        domain: true,
        isVerified: true,
        verificationEmail: true,
        identityConfirmedAt: true,
        organizationId: true,
        planStartedAt: true,
      },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }
    if (!profile.identityConfirmedAt || !profile.verificationEmail) {
      throw new BadRequestException(
        "Confirm your work email (OTP or Google) before setting a password.",
      );
    }
    if (normalizeVerificationEmail(profile.verificationEmail) !== email) {
      throw new BadRequestException(
        "Password email must match the verified identity email.",
      );
    }
    if (profile.isVerified && profile.organizationId) {
      throw new BadRequestException(
        "This brand is already activated. Please sign in.",
      );
    }

    const hashedPassword = this.auth.hashPassword(password);
    const displayName = emailLocalPart(email);

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser && existingUser.role !== UserRole.BRAND) {
      throw new ConflictException(
        "This email is registered for a different account type.",
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let organizationId = profile.organizationId;
      let userId = existingUser?.id;

      if (!organizationId) {
        const organization = await tx.organization.create({
          data: { name: profile.name },
        });
        organizationId = organization.id;
      }

      if (userId) {
        await tx.user.update({
          where: { id: userId },
          data: {
            hashedPassword,
            emailVerifiedAt: new Date(),
            name: existingUser?.name ?? displayName,
            organizationId,
          },
        });
      } else {
        const user = await tx.user.create({
          data: {
            email,
            name: displayName,
            role: UserRole.BRAND,
            organizationId,
            hashedPassword,
            emailVerifiedAt: new Date(),
          },
        });
        userId = user.id;
      }

      await tx.brandProfile.update({
        where: { id: profile.id },
        data: {
          organizationId,
          isVerified: true,
          verifiedAt: new Date(),
          verificationEmail: email,
        },
      });

      return { userId: userId!, organizationId };
    });

    await this.enqueueDeepScanAfterVerify(brandProfileId);

    const token = await this.auth.issueTokenForUserId(result.userId);

    return {
      activated: true,
      brandProfileId: profile.id,
      domain: profile.domain,
      organizationId: result.organizationId,
      ...token,
    };
  }

  private async markIdentityConfirmed(
    brandProfileId: string,
    email: string,
  ): Promise<void> {
    await this.prisma.brandProfile.update({
      where: { id: brandProfileId },
      data: {
        verificationEmail: email,
        identityConfirmedAt: new Date(),
        // Password gate owns isVerified.
        isVerified: false,
        verifiedAt: null,
      },
    });
  }

  /** PRE-PROD: no Postmark / no VerificationCode rows. Logged stub code 123456. */
  private async sendOtpStub(brandProfileId: string, rawEmail: string) {
    const email = normalizeVerificationEmail(rawEmail);
    if (!isValidVerificationEmail(email)) {
      throw new BadRequestException(
        "Please enter a valid email address (e.g., name@brand.in)",
      );
    }

    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { id: true, domain: true },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }

    if (!emailDomainMatchesBrandDomain(email, profile.domain)) {
      const emailDomain = emailDomainFromAddress(email);
      throw new BadRequestException(
        `The email domain (@${emailDomain}) doesn't match your website (${profile.domain}). Please use your work email, or go back and re-enter your website.`,
      );
    }

    const expiresAt = addMinutes(new Date(), OTP_TTL_MINUTES);
    this.logger.warn(
      `[STUB OTP] brandProfileId=${brandProfileId} email=${email} code=${STUB_OTP_CODE} — set BRAND_VERIFICATION_USE_REAL_OTP=true for Postmark`,
    );

    return {
      sent: true,
      expiresInMinutes: OTP_TTL_MINUTES,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /** PRE-PROD: accepts only STUB_OTP_CODE; confirms identity only (password gate sets isVerified). */
  private async verifyOtpStub(
    brandProfileId: string,
    rawEmail: string,
    rawOtp: string,
  ) {
    const email = normalizeVerificationEmail(rawEmail);
    const otp = rawOtp.trim();

    if (!isValidVerificationEmail(email)) {
      throw new BadRequestException(
        "Please enter a valid email address (e.g., name@brand.in)",
      );
    }

    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { id: true, domain: true },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }

    if (!emailDomainMatchesBrandDomain(email, profile.domain)) {
      const emailDomain = emailDomainFromAddress(email);
      throw new BadRequestException(
        `The email domain (@${emailDomain}) doesn't match your website (${profile.domain}). Please use your work email, or go back and re-enter your website.`,
      );
    }

    if (otp !== STUB_OTP_CODE) {
      throw new UnauthorizedException(
        "Incorrect code. Please check your email and try again.",
      );
    }

    await this.markIdentityConfirmed(brandProfileId, email);

    this.logger.warn(
      `[STUB OTP] identity confirmed brandProfileId=${brandProfileId} email=${email} — password still required`,
    );

    return {
      identityConfirmed: true,
      brandProfileId: profile.id,
      domain: profile.domain,
      email,
      nextStep: "password" as const,
    };
  }

  // ---------------------------------------------------------------------------
  // PROD — real OTP (Postmark + VerificationCode). Active when
  // BRAND_VERIFICATION_USE_REAL_OTP=true. Do not delete.
  // ---------------------------------------------------------------------------

  private async sendOtpReal(brandProfileId: string, rawEmail: string) {
    const email = normalizeVerificationEmail(rawEmail);
    if (!isValidVerificationEmail(email)) {
      throw new BadRequestException(
        "Please enter a valid email address (e.g., name@brand.in)",
      );
    }

    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { id: true, domain: true, name: true, isVerified: true },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }

    if (!emailDomainMatchesBrandDomain(email, profile.domain)) {
      const emailDomain = emailDomainFromAddress(email);
      throw new BadRequestException(
        `The email domain (@${emailDomain}) doesn't match your website (${profile.domain}). Please use your work email, or go back and re-enter your website.`,
      );
    }

    await this.assertSendRateLimit(brandProfileId);

    const identifier = verificationCodeIdentifier(brandProfileId, email);
    const otpCode = this.generateOtpCode();
    const expiresAt = addMinutes(new Date(), OTP_TTL_MINUTES);

    await this.prisma.verificationCode.updateMany({
      where: { identifier, isUsed: false },
      data: { isUsed: true },
    });

    await this.prisma.verificationCode.create({
      data: {
        identifier,
        code: otpCode,
        expiresAt,
        attempts: 0,
        isUsed: false,
      },
    });

    this.logger.log(
      `Brand verification OTP brandProfileId=${brandProfileId} email=${email} code=${otpCode} expiresAt=${expiresAt.toISOString()}`,
    );

    try {
      await this.mail.sendOtp(email, otpCode, emailLocalPart(email));
    } catch (error: unknown) {
      const postmark = error as PostmarkInactiveError;
      const detail = error instanceof Error ? error.message : String(error);
      const isInactive =
        postmark.statusCode === 422 &&
        typeof postmark.message === "string" &&
        postmark.message.toLowerCase().includes("inactive");

      this.logger.warn(
        isInactive
          ? `[Postmark] inactive/suppressed recipient — OTP still issued (use backend log). brandProfileId=${brandProfileId} email=${email} detail=${detail}`
          : `[Postmark] send failed — OTP still issued (use backend log). brandProfileId=${brandProfileId} email=${email} detail=${detail}`,
      );
    }

    return {
      sent: true,
      expiresInMinutes: OTP_TTL_MINUTES,
      expiresAt: expiresAt.toISOString(),
    };
  }

  private async verifyOtpReal(
    brandProfileId: string,
    rawEmail: string,
    rawOtp: string,
  ) {
    const email = normalizeVerificationEmail(rawEmail);
    const otp = rawOtp.trim();

    if (!isValidVerificationEmail(email)) {
      throw new BadRequestException(
        "Please enter a valid email address (e.g., name@brand.in)",
      );
    }

    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { id: true, domain: true, isVerified: true },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }

    if (!emailDomainMatchesBrandDomain(email, profile.domain)) {
      const emailDomain = emailDomainFromAddress(email);
      throw new BadRequestException(
        `The email domain (@${emailDomain}) doesn't match your website (${profile.domain}). Please use your work email, or go back and re-enter your website.`,
      );
    }

    const identifier = verificationCodeIdentifier(brandProfileId, email);
    const row = await this.prisma.verificationCode.findFirst({
      where: { identifier, isUsed: false },
      orderBy: { createdAt: "desc" },
    });

    if (!row) {
      throw new UnauthorizedException(
        "Incorrect code. Please check your email and try again.",
      );
    }

    if (row.expiresAt < new Date()) {
      throw new UnauthorizedException(
        "This code has expired. Resend a new code.",
      );
    }

    if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
      throw new UnauthorizedException(
        "Maximum limit reached for incorrect OTP. Request a new code.",
      );
    }

    if (row.code !== otp) {
      const nextAttempts = row.attempts + 1;
      await this.prisma.verificationCode.update({
        where: { id: row.id },
        data: { attempts: nextAttempts },
      });

      const remaining = MAX_VERIFY_ATTEMPTS - nextAttempts;
      if (remaining <= 0) {
        throw new UnauthorizedException(
          "Maximum limit reached for incorrect OTP. Request a new code.",
        );
      }

      throw new UnauthorizedException(
        `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
      );
    }

    await this.prisma.verificationCode.update({
      where: { id: row.id },
      data: { isUsed: true },
    });

    await this.markIdentityConfirmed(brandProfileId, email);

    return {
      identityConfirmed: true,
      brandProfileId: profile.id,
      domain: profile.domain,
      email,
      nextStep: "password" as const,
    };
  }

  private async enqueueDeepScanAfterVerify(
    brandProfileId: string,
  ): Promise<void> {
    try {
      const { jobId } =
        await this.brandCentreScan.enqueueDeepScan(brandProfileId);
      this.logger.log(
        `deep-scan.enqueued brandProfileId=${brandProfileId} jobId=${jobId}`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "unknown";
      this.logger.error(
        `deep-scan.enqueue_failed brandProfileId=${brandProfileId} error=${message}`,
      );
    }
  }

  private generateOtpCode(): string {
    return Math.floor(100_000 + Math.random() * 900_000).toString();
  }

  private async assertSendRateLimit(brandProfileId: string): Promise<void> {
    const since = new Date(Date.now() - SEND_WINDOW_MS);
    const recentSendCount = await this.prisma.verificationCode.count({
      where: {
        identifier: { startsWith: `${brandProfileId}:` },
        createdAt: { gte: since },
      },
    });

    if (recentSendCount < SEND_LIMIT_PER_WINDOW) {
      return;
    }

    const oldestInWindow = await this.prisma.verificationCode.findFirst({
      where: {
        identifier: { startsWith: `${brandProfileId}:` },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });

    const retryAfterSeconds = oldestInWindow
      ? Math.max(
          1,
          Math.ceil(
            (oldestInWindow.createdAt.getTime() + SEND_WINDOW_MS - Date.now()) /
              1000,
          ),
        )
      : 60;

    throw new BadRequestException(
      `Too many attempts. Please wait ${retryAfterSeconds} seconds before requesting another code.`,
    );
  }
}
