import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PlanType, SubscriptionStatus, UserRole } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { emailLocalPart } from "../brand-onboarding/verification/brand-verification-email.util";
import { JWT_EXPIRES_IN } from "./auth-jwt.config";
import { CompleteBrandRegistrationDto } from "./dto/complete-brand-registration.dto";
import { BRAND_LOGIN_STUB_OTP, LoginDto } from "./dto/login.dto";
import type { AuthUser, JwtPayload } from "./types/auth-user";

export type AuthTokenResponse = {
  accessToken: string;
  user: AuthUser;
};

export type CompleteBrandRegistrationResponse = AuthTokenResponse & {
  brandProfileId: string;
  organizationId: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private assignPlanAtRegistration(planStartedAt: Date | null): {
    planType: PlanType;
    subscriptionStatus: SubscriptionStatus;
    planStartedAt?: Date;
  } {
    const data = {
      planType: PlanType.FREE_TRIAL,
      subscriptionStatus: SubscriptionStatus.TRIALING,
    };
    if (!planStartedAt) {
      return { ...data, planStartedAt: new Date() };
    }
    return data;
  }

  async login(dto: LoginDto): Promise<AuthTokenResponse> {
    if (dto.otp !== BRAND_LOGIN_STUB_OTP) {
      throw new UnauthorizedException("Invalid verification code.");
    }

    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException(
        "No account found for this email.",
      );
    }

    if (user.role !== UserRole.BRAND && user.role !== UserRole.CREATOR) {
      throw new BadRequestException(
        "This account type cannot sign in through the app yet.",
      );
    }

    if (dto.role && dto.role !== user.role) {
      throw new UnauthorizedException(
        `This email is registered as ${user.role.toLowerCase()}, not ${dto.role.toLowerCase()}.`,
      );
    }

    return {
      accessToken: await this.signToken(user),
      user: this.toAuthUser(user),
    };
  }

  async completeBrandRegistration(
    dto: CompleteBrandRegistrationDto,
  ): Promise<CompleteBrandRegistrationResponse> {
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: dto.brandProfileId },
      select: {
        id: true,
        name: true,
        domain: true,
        isVerified: true,
        verificationEmail: true,
        organizationId: true,
        planStartedAt: true,
      },
    });

    if (!profile) {
      throw new NotFoundException("Brand profile not found.");
    }

    if (!profile.isVerified || !profile.verificationEmail) {
      throw new BadRequestException(
        "Verify your work email before starting your trial.",
      );
    }

    const email = profile.verificationEmail.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      if (existingUser.role !== UserRole.BRAND) {
        throw new ConflictException("This email cannot be used for a brand account.");
      }
      let organizationId =
        profile.organizationId ?? existingUser.organizationId;
      if (!profile.organizationId && existingUser.organizationId) {
        await this.prisma.brandProfile.update({
          where: { id: profile.id },
          data: {
            organizationId: existingUser.organizationId,
            ...this.assignPlanAtRegistration(profile.planStartedAt),
          },
        });
        organizationId = existingUser.organizationId;
      } else {
        await this.prisma.brandProfile.update({
          where: { id: profile.id },
          data: {
            ...this.assignPlanAtRegistration(profile.planStartedAt),
          },
        });
      }
      return {
        accessToken: await this.signToken(existingUser),
        user: this.toAuthUser(existingUser),
        brandProfileId: profile.id,
        organizationId: organizationId ?? "",
      };
    }

    if (profile.organizationId) {
      throw new ConflictException(
        "This brand is already registered. Please sign in.",
      );
    }

    const adminEmail = await this.findClaimedOrganizationContact(profile.domain);
    if (adminEmail) {
      throw new ConflictException(
        "This brand domain is already set up. Ask your organization admin for an invitation to join the team.",
      );
    }

    const displayName = emailLocalPart(email);

    const result = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: profile.name },
      });

      const user = await tx.user.create({
        data: {
          email,
          name: displayName,
          role: UserRole.BRAND,
          organizationId: organization.id,
        },
      });

      await tx.brandProfile.update({
        where: { id: profile.id },
        data: {
          organizationId: organization.id,
          ...this.assignPlanAtRegistration(profile.planStartedAt),
        },
      });

      return { organization, user };
    });

    return {
      accessToken: await this.signToken(result.user),
      user: this.toAuthUser(result.user),
      brandProfileId: profile.id,
      organizationId: result.organization.id,
    };
  }

  getMe(user: AuthUser): AuthUser {
    return user;
  }

  private async signToken(user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    organizationId: string | null;
  }): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    };
    return this.jwtService.signAsync(payload, {
      expiresIn: JWT_EXPIRES_IN as `${number}${"s" | "m" | "h" | "d"}`,
    });
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    organizationId: string | null;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    };
  }

  private async findClaimedOrganizationContact(
    domain: string,
  ): Promise<string | null> {
    const profile = await this.prisma.brandProfile.findFirst({
      where: {
        OR: [{ domain }, { domain: domain.replace(/^www\./, "") }],
      },
      select: {
        isVerified: true,
        organizationId: true,
      },
    });
    if (!profile?.organizationId || !profile.isVerified) {
      return null;
    }
    const user = await this.prisma.user.findFirst({
      where: { organizationId: profile.organizationId },
      orderBy: { createdAt: "asc" },
      select: { email: true },
    });
    return user?.email ?? null;
  }
}
