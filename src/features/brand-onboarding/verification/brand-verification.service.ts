import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  AuthMethodType,
  EmailOtpPurpose,
  UserAuthState,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { hashPasswordAsync } from "../../../shared/crypto/password.util";
import { normalizeEmail } from "../../../shared/identity/normalize-email";
import { AuthService } from "../../auth/auth.service";
import { EmailOtpService } from "../../auth/email-otp.service";
import { GoogleAuthService } from "../../auth/google-auth.service";
import { BrandCentreScanService } from "../../brand-centre/services/brand-centre-scan.service";
import {
  lockAdmissionEmail,
  lockBrandTeam,
} from "../../brand-settings/team/brand-team-policy";
import { establishInitialBrandOwner } from "../../brand-settings/team/initial-brand-owner";
import {
  emailDomainFromAddress,
  emailDomainMatchesBrandDomain,
  emailLocalPart,
  isBannedPublicEmailProvider,
  isValidVerificationEmail,
} from "./brand-verification-email.util";

@Injectable()
export class BrandVerificationService {
  private readonly logger = new Logger(BrandVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brandCentreScan: BrandCentreScanService,
    private readonly auth: AuthService,
    private readonly googleAuth: GoogleAuthService,
    private readonly emailOtp: EmailOtpService,
  ) {}

  async sendOtp(brandProfileId: string, rawEmail: string) {
    const { profile, email } = await this.assertEligibleIdentity(
      brandProfileId,
      rawEmail,
    );
    await this.emailOtp.issue({
      email,
      purpose: EmailOtpPurpose.BRAND_VERIFICATION,
      eligible: true,
      displayName: profile.name,
    });
    return { sent: true, expiresInMinutes: 10 };
  }

  async verifyOtp(brandProfileId: string, rawEmail: string, rawOtp: string) {
    const { profile, email } = await this.assertEligibleIdentity(
      brandProfileId,
      rawEmail,
    );
    await this.emailOtp.consume({
      email,
      purpose: EmailOtpPurpose.BRAND_VERIFICATION,
      code: rawOtp.trim(),
    });
    await this.markIdentityConfirmed(profile.id, email);
    return {
      identityConfirmed: true,
      brandProfileId: profile.id,
      domain: profile.domain,
      email,
      nextStep: "password" as const,
    };
  }

  async confirmGoogleIdentity(brandProfileId: string, idToken: string) {
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: {
        id: true,
        domain: true,
        name: true,
        isVerified: true,
        organizationId: true,
      },
    });
    if (!profile) throw new NotFoundException("Brand profile not found");
    this.assertInactiveFence(profile);
    const payload = await this.googleAuth.verifyIdTokenPayload(idToken);
    const email = normalizeEmail(payload.email!);
    if (payload.email_verified !== true) {
      throw new BadRequestException("Google email is not verified.");
    }
    if (isBannedPublicEmailProvider(email)) {
      throw new BadRequestException(
        "Use an official corporate Google Workspace account.",
      );
    }
    this.assertDomain(email, profile.domain);
    await this.markIdentityConfirmed(profile.id, email);
    return {
      identityConfirmed: true,
      brandProfileId: profile.id,
      domain: profile.domain,
      email,
      nextStep: "password" as const,
    };
  }

  async setPasswordAndActivate(
    brandProfileId: string,
    rawEmail: string,
    rawPassword: string,
  ) {
    const email = normalizeEmail(rawEmail);
    if (
      rawPassword.trim().length === 0 ||
      rawPassword.length < 8 ||
      rawPassword.length > 128
    ) {
      throw new BadRequestException(
        "Password must be between 8 and 128 characters.",
      );
    }
    const hashedPassword = await hashPasswordAsync(rawPassword);
    const result = await this.prisma.$transaction(async (tx) => {
      await lockBrandTeam(tx, brandProfileId);
      const profile = await tx.brandProfile.findUnique({
        where: { id: brandProfileId },
      });
      if (!profile) throw new NotFoundException("Brand profile not found");
      this.assertInactiveFence(profile);
      if (
        !profile.identityConfirmedAt ||
        !profile.verificationEmail ||
        normalizeEmail(profile.verificationEmail) !== email
      ) {
        throw new ConflictException("Brand identity must be confirmed again.");
      }
      await lockAdmissionEmail(tx, email);
      const existing = await tx.user.findUnique({
        where: { normalizedEmail: email },
      });
      if (existing && existing.role !== UserRole.BRAND) {
        throw new ConflictException(
          "This email belongs to another account type.",
        );
      }
      let organizationId = existing?.organizationId ?? null;
      if (organizationId) {
        const claimedProfile = await tx.brandProfile.findUnique({
          where: { organizationId },
          select: { id: true },
        });
        if (claimedProfile && claimedProfile.id !== profile.id) {
          throw new ConflictException(
            "This account is already associated with another Brand workspace.",
          );
        }
      } else {
        const organization = await tx.organization.create({
          data: { name: profile.name },
        });
        organizationId = organization.id;
      }
      const user = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              email,
              normalizedEmail: email,
              name: existing.name ?? emailLocalPart(email),
              organizationId,
              hashedPassword,
              emailVerifiedAt: new Date(),
              authState: UserAuthState.ACTIVE,
            },
          })
        : await tx.user.create({
            data: {
              email,
              normalizedEmail: email,
              name: emailLocalPart(email),
              role: UserRole.BRAND,
              organizationId,
              hashedPassword,
              emailVerifiedAt: new Date(),
              authState: UserAuthState.ACTIVE,
            },
          });
      await tx.userAuthMethod.upsert({
        where: {
          userId_type: { userId: user.id, type: AuthMethodType.PASSWORD },
        },
        create: {
          userId: user.id,
          type: AuthMethodType.PASSWORD,
          credentialHash: hashedPassword,
        },
        update: { credentialHash: hashedPassword, disabledAt: null },
      });
      await tx.brandProfile.update({
        where: { id: profile.id },
        data: {
          organizationId,
          isVerified: true,
          verifiedAt: new Date(),
          verificationEmail: email,
        },
      });
      await establishInitialBrandOwner(tx, profile.id, user.id);
      return {
        userId: user.id,
        organizationId,
        domain: profile.domain,
      };
    });
    await this.enqueueDeepScanAfterVerify(brandProfileId);
    return {
      activated: true,
      brandProfileId,
      domain: result.domain,
      organizationId: result.organizationId,
      ...(await this.auth.issueTokenForUserId(result.userId)),
    };
  }

  private async assertEligibleIdentity(
    brandProfileId: string,
    rawEmail: string,
  ) {
    const email = normalizeEmail(rawEmail);
    if (!isValidVerificationEmail(email)) {
      throw new BadRequestException("Please enter a valid work email address.");
    }
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: {
        id: true,
        domain: true,
        name: true,
        isVerified: true,
        organizationId: true,
      },
    });
    if (!profile) throw new NotFoundException("Brand profile not found");
    this.assertInactiveFence(profile);
    this.assertDomain(email, profile.domain);
    return { profile, email };
  }

  private assertInactiveFence(profile: {
    isVerified: boolean;
    organizationId: string | null;
  }): void {
    if (profile.isVerified || profile.organizationId) {
      throw new ConflictException(
        "This brand is already active. Please sign in.",
      );
    }
  }

  private assertDomain(email: string, domain: string): void {
    if (!emailDomainMatchesBrandDomain(email, domain)) {
      throw new BadRequestException(
        `The email domain (@${emailDomainFromAddress(email)}) does not match ${domain}.`,
      );
    }
  }

  private async markIdentityConfirmed(
    brandProfileId: string,
    email: string,
  ): Promise<void> {
    const result = await this.prisma.brandProfile.updateMany({
      where: { id: brandProfileId, isVerified: false, organizationId: null },
      data: { verificationEmail: email, identityConfirmedAt: new Date() },
    });
    if (result.count !== 1) {
      throw new ConflictException(
        "This brand is already active. Please sign in.",
      );
    }
  }

  private async enqueueDeepScanAfterVerify(brandProfileId: string) {
    try {
      const { jobId } =
        await this.brandCentreScan.enqueueOnboardingDeepScan(brandProfileId);
      this.logger.log(
        `deep-scan.enqueued brandProfileId=${brandProfileId} jobId=${jobId}`,
      );
    } catch {
      this.logger.error(
        `deep-scan.enqueue_failed brandProfileId=${brandProfileId}`,
      );
    }
  }
}
