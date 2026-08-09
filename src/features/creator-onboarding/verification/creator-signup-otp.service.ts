import {

  BadRequestException,

  Injectable,

  Logger,

  UnauthorizedException,

} from "@nestjs/common";

import { createHash } from "node:crypto";

import { addMinutes } from "date-fns";



import { MailService } from "../../../mail/mail.service";

import { PrismaService } from "../../../prisma/prisma.service";



export const CREATOR_SIGNUP_STUB_OTP = "123456";

const OTP_TTL_MINUTES = 15;

const MAX_ATTEMPTS = 5;

const SEND_LIMIT_PER_WINDOW = 3;

const SEND_WINDOW_MS = 60_000;



type PostmarkInactiveError = {

  statusCode?: number;

  message?: string;

};



function isRealCreatorOtpEnabled(): boolean {

  return process.env.CREATOR_VERIFICATION_USE_REAL_OTP === "true";

}



@Injectable()

export class CreatorSignupOtpService {

  private readonly logger = new Logger(CreatorSignupOtpService.name);



  constructor(

    private readonly prisma: PrismaService,

    private readonly mail: MailService,

  ) {}



  async sendOtp(email: string): Promise<{ sent: true; expiresAt: string }> {

    if (!isRealCreatorOtpEnabled()) {

      return this.sendOtpStub(email);

    }

    return this.sendOtpReal(email);

  }



  async verifyOtp(email: string, rawOtp: string): Promise<void> {

    if (!isRealCreatorOtpEnabled()) {

      return this.verifyOtpStub(email, rawOtp);

    }

    return this.verifyOtpReal(email, rawOtp);

  }



  private async sendOtpStub(

    email: string,

  ): Promise<{ sent: true; expiresAt: string }> {

    const normalized = email.trim().toLowerCase();

    const code = CREATOR_SIGNUP_STUB_OTP;

    const expiresAt = addMinutes(new Date(), OTP_TTL_MINUTES);

    const hashedOtp = this.hashOtp(code);



    await this.prisma.emailOtpVerification.create({

      data: {

        email: normalized,

        hashedOtp,

        expiresAt,

      },

    });



    this.logger.log(

      `Creator signup OTP stub for ${normalized}: ${code} — set CREATOR_VERIFICATION_USE_REAL_OTP=true for Postmark`,

    );

    return { sent: true, expiresAt: expiresAt.toISOString() };

  }



  private async sendOtpReal(

    email: string,

  ): Promise<{ sent: true; expiresAt: string }> {

    const normalized = email.trim().toLowerCase();

    await this.assertSendRateLimit(normalized);



    const code = this.generateOtpCode();

    const expiresAt = addMinutes(new Date(), OTP_TTL_MINUTES);

    const hashedOtp = this.hashOtp(code);



    await this.prisma.emailOtpVerification.create({

      data: {

        email: normalized,

        hashedOtp,

        expiresAt,

      },

    });



    this.logger.log(

      `Creator signup OTP email=${normalized} code=${code} expiresAt=${expiresAt.toISOString()}`,

    );



    const displayName = normalized.split("@")[0] ?? "creator";

    try {

      await this.mail.sendOtp(normalized, code, displayName);

    } catch (error: unknown) {

      const postmark = error as PostmarkInactiveError;

      const detail = error instanceof Error ? error.message : String(error);

      const isInactive =

        postmark.statusCode === 422 &&

        typeof postmark.message === "string" &&

        postmark.message.toLowerCase().includes("inactive");



      this.logger.warn(

        isInactive

          ? `[Postmark] inactive recipient — OTP still issued (use backend log). email=${normalized} detail=${detail}`

          : `[Postmark] send failed — OTP still issued (use backend log). email=${normalized} detail=${detail}`,

      );

    }



    return { sent: true, expiresAt: expiresAt.toISOString() };

  }



  private async verifyOtpStub(email: string, rawOtp: string): Promise<void> {

    const otp = rawOtp.trim();

    if (otp === CREATOR_SIGNUP_STUB_OTP) {

      return;

    }

    throw new UnauthorizedException("Invalid verification code.");

  }



  private async verifyOtpReal(email: string, rawOtp: string): Promise<void> {

    const normalized = email.trim().toLowerCase();

    const otp = rawOtp.trim();



    const row = await this.prisma.emailOtpVerification.findFirst({

      where: { email: normalized },

      orderBy: { createdAt: "desc" },

    });



    if (!row) {

      throw new UnauthorizedException("Invalid verification code.");

    }



    if (row.expiresAt < new Date()) {

      throw new UnauthorizedException("Verification code expired.");

    }



    if (row.attemptsCount >= row.maxAttempts) {

      throw new UnauthorizedException("Too many verification attempts.");

    }



    const valid = row.hashedOtp === this.hashOtp(otp);

    await this.prisma.emailOtpVerification.update({

      where: { id: row.id },

      data: { attemptsCount: row.attemptsCount + 1 },

    });



    if (!valid) {

      throw new UnauthorizedException("Invalid verification code.");

    }

  }



  private hashOtp(code: string): string {

    return createHash("sha256").update(code).digest("hex");

  }



  private generateOtpCode(): string {

    return Math.floor(100_000 + Math.random() * 900_000).toString();

  }



  private async assertSendRateLimit(email: string): Promise<void> {

    const since = new Date(Date.now() - SEND_WINDOW_MS);

    const recentSendCount = await this.prisma.emailOtpVerification.count({

      where: {

        email,

        createdAt: { gte: since },

      },

    });



    if (recentSendCount < SEND_LIMIT_PER_WINDOW) {

      return;

    }



    const oldestInWindow = await this.prisma.emailOtpVerification.findFirst({

      where: { email, createdAt: { gte: since } },

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


