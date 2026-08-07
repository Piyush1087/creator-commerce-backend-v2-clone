import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  BrandIntegrationProvider,
  BrandIntegrationScope,
  BrandRole,
  InstagramProfessionalAccountType,
  InstagramSyncInvitationStatus,
} from "@prisma/client";
import { addHours, addMinutes, addSeconds } from "date-fns";
import { randomBytes, randomInt } from "node:crypto";

import type { AuthUser } from "../../auth/types/auth-user";
import { MailService } from "../../../mail/mail.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { encryptField } from "../../../shared/crypto/field-encryption.util";
import { BrandCentreAuthService } from "../../brand-centre/brand-centre-auth.service";
import { InstagramGraphClient } from "../../instagram/instagram-graph.client";
import { InstagramOAuthClient } from "../../instagram/instagram-oauth.client";
import { resolveInstagramScopesFromPermissions } from "../../instagram/instagram-scope.util";

function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

function withAt(handle: string): string {
  const bare = normalizeHandle(handle);
  return bare ? `@${bare}` : "@";
}

@Injectable()
export class BrandSocialSyncService {
  private readonly logger = new Logger(BrandSocialSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: InstagramOAuthClient,
    private readonly graph: InstagramGraphClient,
    private readonly mail: MailService,
    private readonly brandAuth: BrandCentreAuthService,
  ) {}

  async getOauthUrl(user: AuthUser, redirectUri: string) {
    const brand = await this.brandAuth.resolveBrandProfile(user);
    const finalized = this.requireFinalizedHandle(brand.igHandle);
    const state = Buffer.from(
      JSON.stringify({
        brandProfileId: brand.id,
        finalizedHandle: finalized,
        t: Date.now(),
      }),
    ).toString("base64url");
    const url = this.oauth.buildAuthorizeUrl(redirectUri, state);
    return { url, state, finalizedHandle: finalized };
  }

  async connectInstagram(
    user: AuthUser,
    args: { code: string; redirectUri: string },
  ) {
    const brand = await this.brandAuth.resolveBrandProfile(user);
    return this.persistInstagramConnection(brand.id, args);
  }

  async skipSocialSync(user: AuthUser) {
    const brand = await this.brandAuth.resolveBrandProfile(user);
    await this.prisma.brandProfile.update({
      where: { id: brand.id },
      data: { socialSyncSkipped: true },
    });
    return { skipped: true, brandProfileId: brand.id };
  }

  async inviteTeammate(user: AuthUser, emailRaw: string) {
    const brand = await this.brandAuth.resolveBrandProfile(user);
    const membership = await this.prisma.brandTeamMember.findUnique({
      where: {
        brandProfileId_userId: {
          brandProfileId: brand.id,
          userId: user.id,
        },
      },
    });
    if (membership && membership.role === BrandRole.CAMPAIGN_MANAGER) {
      throw new ForbiddenException(
        "Only brand owners/admins can invite teammates for Instagram sync.",
      );
    }
    const email = emailRaw.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("Please enter a valid email address.");
    }

    const token = randomBytes(24).toString("hex");
    const expiresAt = addHours(new Date(), 24);
    await this.prisma.instagramSyncInvitation.create({
      data: {
        email,
        token,
        expiresAt,
        brandProfileId: brand.id,
        status: InstagramSyncInvitationStatus.PENDING,
      },
    });

    const base =
      process.env.FRONTEND_APP_URL?.replace(/\/$/, "") ||
      "http://localhost:5173";
    const link = `${base}/brand/onboarding/sync-verify?token=${token}`;

    // Invite email template TBD — log the secure link for local/dev.
    this.logger.log(
      `Instagram sync invite brand=${brand.id} email=${email} link=${link}`,
    );

    return { sent: true, expiresAt: expiresAt.toISOString() };
  }

  async startInviteVerification(token: string) {
    const invite = await this.findValidInvite(token);
    const otp = String(randomInt(100_000, 999_999));
    await this.prisma.instagramSyncInvitation.update({
      where: { id: invite.id },
      data: {
        otpCode: otp,
        otpExpiresAt: addMinutes(new Date(), 10),
        status: InstagramSyncInvitationStatus.PENDING,
      },
    });
    this.logger.warn(
      `[SYNC INVITE OTP] email=${invite.email} code=${otp} token=${token.slice(0, 8)}…`,
    );
    try {
      await this.mail.sendOtp(
        invite.email,
        otp,
        invite.email.split("@")[0] ?? "there",
      );
    } catch {
      /* logged OTP above for local/dev */
    }
    return {
      email: invite.email,
      brandProfileId: invite.brandProfileId,
      expiresInMinutes: 10,
    };
  }

  async verifyInviteOtp(token: string, otp: string) {
    const invite = await this.findValidInvite(token);
    if (!invite.otpCode || !invite.otpExpiresAt) {
      throw new BadRequestException("Request a verification code first.");
    }
    if (invite.otpExpiresAt < new Date()) {
      throw new UnauthorizedException(
        "Invalid or expired code. Please generate a new secure OTP.",
      );
    }
    if (invite.otpCode !== otp.trim()) {
      throw new UnauthorizedException(
        "Invalid or expired code. Please verify the numbers or click Resend OTP.",
      );
    }
    await this.prisma.instagramSyncInvitation.update({
      where: { id: invite.id },
      data: { status: InstagramSyncInvitationStatus.VERIFIED },
    });
    return {
      verified: true,
      brandProfileId: invite.brandProfileId,
      email: invite.email,
    };
  }

  async connectInstagramForInvite(
    token: string,
    args: { code: string; redirectUri: string },
  ) {
    const invite = await this.findValidInvite(token);
    if (invite.status !== InstagramSyncInvitationStatus.VERIFIED) {
      throw new UnauthorizedException(
        "Complete OTP verification before connecting Instagram.",
      );
    }
    const result = await this.persistInstagramConnection(
      invite.brandProfileId,
      args,
    );
    await this.prisma.instagramSyncInvitation.update({
      where: { id: invite.id },
      data: { status: InstagramSyncInvitationStatus.COMPLETED },
    });
    return { ...result, inviteCompleted: true };
  }

  private async persistInstagramConnection(
    brandProfileId: string,
    args: { code: string; redirectUri: string },
  ) {
    const brand = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { id: true, igHandle: true },
    });
    if (!brand) {
      throw new NotFoundException("Brand profile not found");
    }
    const finalized = this.requireFinalizedHandle(brand.igHandle);

    const tokenResult = await this.oauth.exchangeAuthorizationCode(
      args.code,
      args.redirectUri,
    );
    const me = await this.graph.fetchMe(tokenResult.accessToken);

    if (me.accountType === InstagramProfessionalAccountType.PERSONAL) {
      throw new BadRequestException({
        code: "PERSONAL_ACCOUNT",
        message:
          "Connection Rejected: The platform requires an Instagram Business or Creator account to track engagement data.",
      });
    }

    if (normalizeHandle(me.username) !== finalized) {
      throw new BadRequestException({
        code: "HANDLE_MISMATCH",
        message: `Connection Failed: The authenticated Instagram account (@${me.username}) does not match the finalized brand handle (@${finalized}).`,
      });
    }

    const permissionNames = [
      ...tokenResult.permissions,
      ...(await this.graph.fetchGrantedPermissions(tokenResult.accessToken)),
    ];
    const { scopes, status } =
      resolveInstagramScopesFromPermissions(permissionNames);

    if (!scopes.includes(BrandIntegrationScope.BASIC_PROFILE)) {
      throw new BadRequestException({
        code: "MISSING_BASIC_SCOPE",
        message:
          "Connection Rejected: Basic Instagram profile permission is required.",
      });
    }

    const expiresAt = addSeconds(new Date(), tokenResult.expiresInSeconds);
    const handle = withAt(me.username);

    await this.prisma.brandIntegration.upsert({
      where: {
        brandProfileId_provider: {
          brandProfileId: brand.id,
          provider: BrandIntegrationProvider.INSTAGRAM,
        },
      },
      create: {
        brandProfileId: brand.id,
        provider: BrandIntegrationProvider.INSTAGRAM,
        status,
        currentPlatformHandle: handle,
        inboundOauthHandle: handle,
        accessTokenEncrypted: encryptField(tokenResult.accessToken),
        grantedScopes: scopes,
        tokenExpiresAt: expiresAt,
        isActive: true,
      },
      update: {
        status,
        currentPlatformHandle: handle,
        inboundOauthHandle: handle,
        accessTokenEncrypted: encryptField(tokenResult.accessToken),
        grantedScopes: scopes,
        tokenExpiresAt: expiresAt,
        isActive: true,
      },
    });

    await this.prisma.brandProfile.update({
      where: { id: brand.id },
      data: { socialSyncSkipped: false, igHandle: normalizeHandle(me.username) },
    });

    this.logger.log(
      `Instagram connected brand=${brand.id} status=${status} scopes=${scopes.join(",")}`,
    );

    return {
      connected: true,
      handle,
      status,
      scopes,
      brandProfileId: brand.id,
    };
  }

  private requireFinalizedHandle(igHandle: string | null): string {
    if (!igHandle?.trim()) {
      throw new BadRequestException(
        "Upstream finalized Instagram handle is missing. Confirm core identity first.",
      );
    }
    return normalizeHandle(igHandle);
  }

  private async findValidInvite(token: string) {
    const invite = await this.prisma.instagramSyncInvitation.findUnique({
      where: { token },
    });
    if (!invite) {
      throw new NotFoundException("Invitation link is invalid.");
    }
    if (invite.status === InstagramSyncInvitationStatus.COMPLETED) {
      throw new UnauthorizedException(
        "Link Expired: This integration task has already been completed. If you need to make changes, please contact the primary brand manager.",
      );
    }
    if (invite.expiresAt < new Date()) {
      await this.prisma.instagramSyncInvitation.update({
        where: { id: invite.id },
        data: { status: InstagramSyncInvitationStatus.EXPIRED },
      });
      throw new UnauthorizedException(
        "This invitation link has expired. Ask the brand owner to send a new one.",
      );
    }
    return invite;
  }
}
