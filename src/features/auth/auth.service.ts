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
import {
  hashPassword,
  verifyPassword,
} from "../../shared/crypto/password.util";
import { emailLocalPart } from "../brand-onboarding/verification/brand-verification-email.util";
import { establishInitialBrandOwner } from "../brand-settings/team/initial-brand-owner";
import {
  lockAdmissionEmail,
  lockBrandTeam,
} from "../brand-settings/team/brand-team-policy";
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
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException("No account found for this email.");
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

    if (dto.password) {
      if (user.role !== UserRole.CREATOR && user.role !== UserRole.BRAND) {
        throw new BadRequestException(
          "Password sign-in is not available for this account type.",
        );
      }
      if (!user.hashedPassword) {
        throw new UnauthorizedException(
          "This account uses Google or OTP sign-in. Try those instead.",
        );
      }
      if (!this.verifyPassword(dto.password, user.hashedPassword)) {
        throw new UnauthorizedException("Invalid email or password.");
      }
      return {
        accessToken: await this.signToken(user),
        user: this.toAuthUser(user),
      };
    }

    if (!dto.otp) {
      throw new BadRequestException("Provide an OTP or password.");
    }

    if (dto.otp !== BRAND_LOGIN_STUB_OTP) {
      throw new UnauthorizedException("Invalid verification code.");
    }

    return {
      accessToken: await this.signToken(user),
      user: this.toAuthUser(user),
    };
  }

  async completeBrandRegistration(
    dto: CompleteBrandRegistrationDto,
  ): Promise<CompleteBrandRegistrationResponse> {
    const result = await this.prisma.$transaction(async (tx) => {
      await lockBrandTeam(tx, dto.brandProfileId);
      const profile = await tx.brandProfile.findUniqueOrThrow({
        where: { id: dto.brandProfileId },
      });
      if (!profile.isVerified || !profile.verificationEmail) {
        throw new BadRequestException(
          "Verify your work email before starting your trial.",
        );
      }
      const email = profile.verificationEmail.trim().toLowerCase();
      await lockAdmissionEmail(tx, email);
      const matches = await tx.user.findMany({
        where: { email: { equals: email, mode: "insensitive" } },
      });
      if (matches.length > 1)
        throw new ConflictException("Brand identity is ambiguous.");
      let user = matches[0];
      if (
        user &&
        (user.role !== UserRole.BRAND ||
          (user.organizationId &&
            profile.organizationId &&
            user.organizationId !== profile.organizationId))
      ) {
        throw new ConflictException(
          "This email cannot be used for this brand account.",
        );
      }
      if (!user && profile.organizationId) {
        throw new ConflictException(
          "This brand is already registered. Please sign in.",
        );
      }
      if (
        !user &&
        (await this.findClaimedOrganizationContact(profile.domain))
      ) {
        throw new ConflictException(
          "This brand domain is already set up. Ask your organization admin for an invitation to join the team.",
        );
      }
      let organizationId = profile.organizationId ?? user?.organizationId;
      if (organizationId && !profile.organizationId) {
        const linked = await tx.brandProfile.findUnique({
          where: { organizationId },
        });
        if (linked && linked.id !== profile.id)
          throw new ConflictException(
            "This account is already associated with another Brand workspace.",
          );
      }
      if (!organizationId) {
        const organization = await tx.organization.create({
          data: { name: profile.name },
        });
        organizationId = organization.id;
      }
      if (user) {
        user = await tx.user.update({
          where: { id: user.id },
          data: { organizationId },
        });
      } else {
        user = await tx.user.create({
          data: {
            email,
            name: emailLocalPart(email),
            role: UserRole.BRAND,
            organizationId,
            emailVerifiedAt: new Date(),
          },
        });
      }
      await tx.brandProfile.update({
        where: { id: profile.id },
        data: {
          organizationId,
          ...this.assignPlanAtRegistration(profile.planStartedAt),
        },
      });
      await establishInitialBrandOwner(tx, profile.id, user.id);
      return { user, organizationId, profile };
    });
    await this.markDiscoverySignupCompleted(result.profile.domain);
    return {
      ...(await this.issueTokenForUser(result.user)),
      brandProfileId: result.profile.id,
      organizationId: result.organizationId,
    };
  }

  getMe(user: AuthUser): AuthUser {
    return user;
  }

  hashPassword(plain: string): string {
    return hashPassword(plain);
  }

  verifyPassword(plain: string, storedHash: string): boolean {
    return verifyPassword(plain, storedHash);
  }

  async issueTokenForUserId(userId: string): Promise<AuthTokenResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found.");
    }
    return this.issueTokenForUser(user);
  }

  /** Issue the existing session shape for a transactionally admitted user. */
  async issueTokenForUser(user: AuthUser): Promise<AuthTokenResponse> {
    return {
      accessToken: await this.signToken(user),
      user: this.toAuthUser(user),
    };
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

  /** Marks Step 1 discovery cache rows complete after brand signup. */
  private async markDiscoverySignupCompleted(domain: string): Promise<void> {
    const host = domain
      .trim()
      .toLowerCase()
      .replace(/^www\./, "");
    if (!host) {
      return;
    }
    const variants = [`https://${host}`, `https://www.${host}`];
    await this.prisma.discoveryLead.updateMany({
      where: { normalizedUrl: { in: variants } },
      data: { signupCompleted: true },
    });
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
