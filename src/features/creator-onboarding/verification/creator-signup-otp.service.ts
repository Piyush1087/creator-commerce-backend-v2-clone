import { Injectable } from "@nestjs/common";
import { EmailOtpPurpose, UserAuthState } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { normalizeEmail } from "../../../shared/identity/normalize-email";
import { EmailOtpService } from "../../auth/email-otp.service";

@Injectable()
export class CreatorSignupOtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly challenges: EmailOtpService,
  ) {}

  async sendOtp(email: string): Promise<{ sent: true; expiresAt: string }> {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { normalizedEmail },
    });
    await this.challenges.issue({
      email: normalizedEmail,
      purpose: EmailOtpPurpose.CREATOR_EMAIL_VERIFICATION,
      eligible: user?.authState === UserAuthState.PROVISIONAL,
      displayName: user?.name ?? undefined,
      userId: user?.id,
    });
    return {
      sent: true,
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    };
  }

  async verifyOtp(email: string, rawOtp: string): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { normalizedEmail },
    });
    await this.challenges.consume({
      email: normalizedEmail,
      purpose: EmailOtpPurpose.CREATOR_EMAIL_VERIFICATION,
      code: rawOtp.trim(),
      userId: user?.id,
    });
  }
}
