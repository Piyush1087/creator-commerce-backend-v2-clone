import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import {
  AuthMethodType,
  EmailOtpPurpose,
  UserAuthState,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { hashPasswordAsync } from "../../shared/crypto/password.util";
import { normalizeEmail } from "../../shared/identity/normalize-email";
import {
  inspectSterileProvisionalCreator,
  lockCanonicalIdentityEmail,
} from "../../shared/identity/sterile-provisional-creator.policy";
import {
  AuthSessionService,
  type SessionIssueResult,
} from "../auth/auth-session.service";
import { EmailOtpService } from "../auth/email-otp.service";
import { GoogleAuthService } from "../auth/google-auth.service";
import { CreatorEntryProvisioningService } from "./creator-entry-provisioning.service";
import { CREATOR_ENTRY_ERROR } from "./creator-entry.types";

const PUBLIC_OTP_MESSAGE =
  "If an eligible registration exists, a verification code has been sent.";

@Injectable()
export class CreatorEntryRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailOtp: EmailOtpService,
    private readonly googleAuth: GoogleAuthService,
    private readonly provisioning: CreatorEntryProvisioningService,
    private readonly sessions: AuthSessionService,
  ) {}

  async registerPassword(input: { email: string; password: string }) {
    const normalizedEmail = normalizeEmail(input.email);
    const credentialHash = await hashPasswordAsync(input.password);
    const user = await this.prisma.$transaction(async (tx) => {
      await lockCanonicalIdentityEmail(tx, normalizedEmail);
      const existing = await tx.user.findUnique({
        where: { normalizedEmail },
      });
      if (existing?.authState === UserAuthState.ACTIVE) {
        this.accountExists();
      }
      if (existing) {
        const inspection = await inspectSterileProvisionalCreator(
          tx,
          existing.id,
        );
        if (!inspection.sterile) this.recoveryRequired();
        const updated = await tx.user.update({
          where: { id: existing.id },
          data: {
            hashedPassword: credentialHash,
            name: existing.name ?? this.displayName(normalizedEmail),
          },
        });
        await tx.userAuthMethod.upsert({
          where: {
            userId_type: {
              userId: existing.id,
              type: AuthMethodType.PASSWORD,
            },
          },
          create: {
            userId: existing.id,
            type: AuthMethodType.PASSWORD,
            credentialHash,
          },
          update: { credentialHash, verifiedAt: new Date(), disabledAt: null },
        });
        return updated;
      }
      return tx.user.create({
        data: {
          email: normalizedEmail,
          normalizedEmail,
          name: this.displayName(normalizedEmail),
          role: UserRole.CREATOR,
          authState: UserAuthState.PROVISIONAL,
          hashedPassword: credentialHash,
          authMethods: {
            create: {
              type: AuthMethodType.PASSWORD,
              credentialHash,
            },
          },
        },
      });
    });

    await this.issueVerificationOtp(user.id, normalizedEmail, user.name);
    return {
      accepted: true,
      message: PUBLIC_OTP_MESSAGE,
      nextAction: "VERIFY_EMAIL" as const,
    };
  }

  async requestVerificationOtp(email: string) {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { normalizedEmail },
    });
    let eligible = false;
    if (user) {
      const inspection = await inspectSterileProvisionalCreator(
        this.prisma,
        user.id,
      );
      eligible = inspection.sterile;
    }
    try {
      await this.emailOtp.issue({
        email: normalizedEmail,
        purpose: EmailOtpPurpose.CREATOR_EMAIL_VERIFICATION,
        eligible,
        displayName: eligible ? (user?.name ?? undefined) : undefined,
        userId: eligible ? user?.id : undefined,
      });
    } catch {
      // Enumeration resistance intentionally covers ineligible, throttled,
      // rejected and ambiguous-delivery cases.
    }
    if (eligible && user) {
      await this.supersedeCreatorOtpIfIdentityChanged(user.id, normalizedEmail);
    }
    return { accepted: true, message: PUBLIC_OTP_MESSAGE };
  }

  async verifyEmailOtp(
    email: string,
    code: string,
  ): Promise<SessionIssueResult> {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { normalizedEmail },
    });
    if (!user) this.invalidVerification();
    const inspection = await inspectSterileProvisionalCreator(
      this.prisma,
      user.id,
    );
    if (!inspection.sterile) {
      if (
        user.authState !== UserAuthState.PROVISIONAL ||
        user.role !== UserRole.CREATOR
      ) {
        this.invalidVerification();
      }
      this.recoveryRequired();
    }
    try {
      await this.emailOtp.consume({
        email: normalizedEmail,
        purpose: EmailOtpPurpose.CREATOR_EMAIL_VERIFICATION,
        code: code.trim(),
        userId: user.id,
      });
    } catch {
      this.invalidVerification();
    }
    const provisionedUserId = await this.provisioning.provisionVerifiedPassword(
      user.id,
      normalizedEmail,
    );
    return this.sessions.create(provisionedUserId);
  }

  async registerGoogle(idToken: string): Promise<SessionIssueResult> {
    const payload = await this.googleAuth.verifyIdTokenPayload(idToken);
    const normalizedEmail = normalizeEmail(payload.email!);
    const userId = await this.provisioning.provisionOrResolveGoogle({
      subject: payload.sub,
      email: normalizedEmail,
      name: payload.name?.trim() || this.displayName(normalizedEmail),
    });
    return this.sessions.create(userId);
  }

  private async issueVerificationOtp(
    userId: string,
    normalizedEmail: string,
    name: string | null,
  ): Promise<void> {
    try {
      await this.emailOtp.issue({
        email: normalizedEmail,
        purpose: EmailOtpPurpose.CREATOR_EMAIL_VERIFICATION,
        eligible: true,
        displayName: name ?? undefined,
        userId,
      });
    } catch {
      // Registration remains recoverable through the enumeration-resistant
      // resend endpoint when delivery or throttling is inconclusive.
    }
    await this.supersedeCreatorOtpIfIdentityChanged(userId, normalizedEmail);
  }

  private async supersedeCreatorOtpIfIdentityChanged(
    userId: string,
    normalizedEmail: string,
  ): Promise<void> {
    const inspection = await inspectSterileProvisionalCreator(
      this.prisma,
      userId,
    );
    if (inspection.sterile) return;
    await this.prisma.emailOtpChallenge.updateMany({
      where: {
        normalizedEmail,
        purpose: EmailOtpPurpose.CREATOR_EMAIL_VERIFICATION,
        consumedAt: null,
        supersededAt: null,
      },
      data: { supersededAt: new Date() },
    });
  }

  private displayName(normalizedEmail: string): string {
    return normalizedEmail.split("@")[0] || "Creator";
  }

  private accountExists(): never {
    throw new ConflictException({
      code: CREATOR_ENTRY_ERROR.ACCOUNT_EXISTS_SIGN_IN_REQUIRED,
      message: "An account already exists. Sign in to continue.",
    });
  }

  private recoveryRequired(): never {
    throw new ConflictException({
      code: CREATOR_ENTRY_ERROR.CREATOR_CONTEXT_RECOVERY_REQUIRED,
      message: "Creator context requires recovery.",
    });
  }

  private invalidVerification(): never {
    throw new UnauthorizedException({
      code: CREATOR_ENTRY_ERROR.EMAIL_VERIFICATION_INVALID_OR_EXPIRED,
      message: "Email verification is invalid or expired.",
    });
  }
}
