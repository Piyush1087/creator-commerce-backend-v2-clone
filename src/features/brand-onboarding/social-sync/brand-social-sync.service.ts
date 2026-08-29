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
  InstagramAuthorizationHealth,
  InstagramCapabilityState,
  InstagramIdentityVerification,
  InstagramIgHandleProvenance,
  InstagramOAuthIntent,
  InstagramProfessionalAccountType,
  InstagramSyncHealth,
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
import { InstagramPermissionEvidenceError } from "../../instagram/instagram-graph.client";
import { InstagramOAuthClient } from "../../instagram/instagram-oauth.client";
import { resolveInstagramScopesFromPermissions } from "../../instagram/instagram-scope.util";
import {
  BrandInstagramOAuthStateService,
  hashInstagramSettingsState,
  INSTAGRAM_SETTINGS_STATE_TTL_MS,
} from "../../brand-settings/services/brand-instagram-oauth-state.service";
import { BrandSettingsAccessService } from "../../brand-settings/services/brand-settings-access.service";

function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

function withAt(handle: string): string {
  const bare = normalizeHandle(handle);
  return bare ? `@${bare}` : "@";
}

function assertSafeRedirectUri(redirectUri: string): void {
  let redirect: URL;
  try {
    redirect = new URL(redirectUri);
  } catch {
    throw new BadRequestException(
      "A valid Instagram redirect URI is required.",
    );
  }
  if (
    !["https:", "http:"].includes(redirect.protocol) ||
    redirect.username ||
    redirect.password ||
    redirect.hash
  ) {
    throw new BadRequestException(
      "A valid HTTP(S) Instagram redirect URI without credentials or fragment is required.",
    );
  }
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
    private readonly access: BrandSettingsAccessService,
    private readonly oauthState: BrandInstagramOAuthStateService,
  ) {}

  async getOauthUrl(user: AuthUser, redirectUri: string) {
    const context = await this.access.resolveBrandContext(user);
    const brand = await this.prisma.brandProfile.findUniqueOrThrow({
      where: { id: context.brandProfileId },
    });
    const finalized = this.requireFinalizedHandle(brand.igHandle);
    const integration = await this.prisma.brandIntegration.findUnique({
      where: {
        brandProfileId_provider: {
          brandProfileId: brand.id,
          provider: BrandIntegrationProvider.INSTAGRAM,
        },
      },
    });
    await this.assertNoActiveDeletion(brand.id);
    if (integration && !integration.providerAccountId) {
      throw new BadRequestException({
        code: "LEGACY_IDENTITY_RECONCILIATION_REQUIRED",
        message:
          "Reconcile the existing Instagram identity in Brand Settings before onboarding reconnect.",
      });
    }
    const intent = integration
      ? InstagramOAuthIntent.RECONNECT
      : InstagramOAuthIntent.INITIAL_CONNECT;
    this.access.assertInstagramAction(
      context.membership.role,
      integration ? "SAME_ID_RECONNECT" : "INITIAL_CONNECT",
    );
    const state = await this.oauthState.issue({
      brandProfileId: brand.id,
      initiatedByUserId: user.id,
      redirectUri,
      intent,
      initiatedByRole: context.membership.role,
      expectedGeneration: integration?.authorizationGeneration ?? 0,
      expectedProviderAccountId: integration?.providerAccountId ?? null,
    });
    const url = this.oauth.buildAuthorizeUrl(redirectUri, state);
    return { url, state, finalizedHandle: finalized };
  }

  async connectInstagram(
    user: AuthUser,
    args: { code: string; redirectUri: string; state: string },
  ) {
    const context = await this.access.resolveBrandContext(user);
    const attempt = await this.oauthState.consume(
      {
        brandProfileId: context.brandProfileId,
        initiatedByUserId: user.id,
        redirectUri: args.redirectUri,
      },
      args.state,
    );
    if (attempt.initiatedByRole !== context.membership.role) {
      throw new ForbiddenException("Instagram OAuth role authority changed");
    }
    if (
      attempt.intent !== InstagramOAuthIntent.INITIAL_CONNECT &&
      attempt.intent !== InstagramOAuthIntent.RECONNECT
    ) {
      throw new BadRequestException({
        code: "INVALID_INSTAGRAM_OAUTH_INTENT",
        message: "This OAuth attempt must complete in Brand Settings.",
      });
    }
    this.access.assertInstagramAction(
      context.membership.role,
      attempt.intent === InstagramOAuthIntent.INITIAL_CONNECT
        ? "INITIAL_CONNECT"
        : "SAME_ID_RECONNECT",
    );
    return this.persistInstagramConnection(context.brandProfileId, {
      ...args,
      expectedGeneration: attempt.expectedGeneration,
      expectedProviderAccountId: attempt.expectedProviderAccountId,
    });
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
    const context = await this.access.resolveBrandContext(user);
    if (context.membership.role !== BrandRole.BRAND_OWNER) {
      throw new ForbiddenException(
        "Only a Brand Owner can delegate Instagram sync.",
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
        brandProfileId: context.brandProfileId,
        status: InstagramSyncInvitationStatus.PENDING,
      },
    });

    const base =
      process.env.FRONTEND_APP_URL?.replace(/\/$/, "") ||
      "http://localhost:5173";
    const link = `${base}/brand/onboarding/sync-verify?token=${token}`;

    // Invite email template TBD — log the secure link for local/dev.
    this.logger.log(
      `Instagram sync invite brand=${context.brandProfileId} email=${email} link=${link}`,
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

  async getInviteOauthUrl(token: string, redirectUri: string) {
    assertSafeRedirectUri(redirectUri);
    const invite = await this.findValidInvite(token);
    if (invite.status !== InstagramSyncInvitationStatus.VERIFIED) {
      throw new UnauthorizedException(
        "Complete OTP verification before connecting Instagram.",
      );
    }
    const integration = await this.prisma.brandIntegration.findUnique({
      where: {
        brandProfileId_provider: {
          brandProfileId: invite.brandProfileId,
          provider: BrandIntegrationProvider.INSTAGRAM,
        },
      },
    });
    await this.assertNoActiveDeletion(invite.brandProfileId);
    if (integration && !integration.providerAccountId) {
      throw new BadRequestException({
        code: "LEGACY_IDENTITY_RECONCILIATION_REQUIRED",
        message:
          "The Brand Owner must reconcile the existing Instagram identity in Brand Settings.",
      });
    }
    const state = randomBytes(32).toString("base64url");
    const issued = await this.prisma.instagramSyncInvitation.updateMany({
      where: {
        id: invite.id,
        status: InstagramSyncInvitationStatus.VERIFIED,
      },
      data: {
        oauthStateHash: hashInstagramSettingsState(state),
        oauthRedirectUri: redirectUri,
        oauthExpectedGeneration: integration?.authorizationGeneration ?? 0,
        oauthStateExpiresAt: new Date(
          Date.now() + INSTAGRAM_SETTINGS_STATE_TTL_MS,
        ),
        oauthStateConsumedAt: null,
      },
    });
    if (issued.count !== 1) {
      throw new UnauthorizedException("Invitation authority changed");
    }
    return {
      url: this.oauth.buildAuthorizeUrl(redirectUri, state),
      state,
    };
  }

  async connectInstagramForInvite(
    token: string,
    args: { code: string; redirectUri: string; state: string },
  ) {
    const invite = await this.findValidInvite(token);
    if (invite.status !== InstagramSyncInvitationStatus.VERIFIED) {
      throw new UnauthorizedException(
        "Complete OTP verification before connecting Instagram.",
      );
    }
    if (!/^[A-Za-z0-9_-]{43}$/.test(args.state)) {
      throw new UnauthorizedException("Invalid Instagram OAuth state");
    }
    const consumedAt = new Date();
    const consumed = await this.prisma.instagramSyncInvitation.updateMany({
      where: {
        id: invite.id,
        status: InstagramSyncInvitationStatus.VERIFIED,
        oauthStateHash: hashInstagramSettingsState(args.state),
        oauthRedirectUri: args.redirectUri,
        oauthStateExpiresAt: { gt: consumedAt },
        oauthStateConsumedAt: null,
      },
      data: { oauthStateConsumedAt: consumedAt },
    });
    if (consumed.count !== 1) {
      throw new UnauthorizedException(
        "Invalid or expired Instagram OAuth state",
      );
    }
    const consumedInvite =
      await this.prisma.instagramSyncInvitation.findUniqueOrThrow({
        where: { id: invite.id },
      });
    const result = await this.persistInstagramConnection(
      invite.brandProfileId,
      {
        ...args,
        expectedGeneration: consumedInvite.oauthExpectedGeneration ?? 0,
        expectedProviderAccountId: null,
      },
    );
    const completed = await this.prisma.instagramSyncInvitation.updateMany({
      where: {
        id: invite.id,
        status: InstagramSyncInvitationStatus.VERIFIED,
        oauthStateConsumedAt: consumedAt,
      },
      data: { status: InstagramSyncInvitationStatus.COMPLETED },
    });
    if (completed.count !== 1) {
      throw new BadRequestException(
        "Invitation authority changed before completion",
      );
    }
    return { ...result, inviteCompleted: true };
  }

  private async persistInstagramConnection(
    brandProfileId: string,
    args: {
      code: string;
      redirectUri: string;
      expectedGeneration: number;
      expectedProviderAccountId: string | null;
    },
  ) {
    const brand = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { id: true, igHandle: true },
    });
    if (!brand) {
      throw new NotFoundException("Brand profile not found");
    }
    const finalized = this.requireFinalizedHandle(brand.igHandle);
    const existing = await this.prisma.brandIntegration.findUnique({
      where: {
        brandProfileId_provider: {
          brandProfileId,
          provider: BrandIntegrationProvider.INSTAGRAM,
        },
      },
    });
    const expectedGeneration = args.expectedGeneration;
    if ((existing?.authorizationGeneration ?? 0) !== expectedGeneration) {
      throw new BadRequestException({
        code: "STALE_INSTAGRAM_AUTHORIZATION_GENERATION",
        message: "Instagram state changed. Start a fresh connection.",
      });
    }
    if (
      args.expectedProviderAccountId &&
      existing?.providerAccountId !== args.expectedProviderAccountId
    ) {
      throw new BadRequestException({
        code: "STALE_INSTAGRAM_ACCOUNT_IDENTITY",
        message:
          "Instagram account identity changed. Start a fresh connection.",
      });
    }

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

    if (
      !existing?.providerAccountId &&
      normalizeHandle(me.username) !== finalized
    ) {
      throw new BadRequestException({
        code: "HANDLE_MISMATCH",
        message: `Connection Failed: The authenticated Instagram account (@${me.username}) does not match the finalized brand handle (@${finalized}).`,
      });
    }

    if (existing?.isActive && !existing.providerAccountId) {
      throw new BadRequestException({
        code: "LEGACY_IDENTITY_RECONCILIATION_REQUIRED",
        message:
          "Reconcile the existing Instagram identity in Brand Settings before onboarding reconnect.",
      });
    }
    if (
      existing?.providerAccountId &&
      existing.providerAccountId !== me.userId
    ) {
      throw new BadRequestException({
        code: "ACCOUNT_CHANGE_REQUIRED",
        message:
          "A different Instagram account requires the Owner account-change flow in Brand Settings.",
      });
    }

    let providerPermissions: string[] | null = null;
    try {
      providerPermissions = await this.graph.fetchGrantedPermissions(
        tokenResult.accessToken,
      );
    } catch (error) {
      if (!(error instanceof InstagramPermissionEvidenceError)) throw error;
    }
    const permissionNames = [
      ...tokenResult.permissions,
      ...(providerPermissions ?? []),
    ];
    const { scopes, status } =
      resolveInstagramScopesFromPermissions(permissionNames);

    if (!scopes.includes(BrandIntegrationScope.BASIC_PROFILE))
      scopes.unshift(BrandIntegrationScope.BASIC_PROFILE);

    const hasInsights = scopes.includes(
      BrandIntegrationScope.ENGAGEMENT_INSIGHTS,
    );
    const insightsCapability = hasInsights
      ? InstagramCapabilityState.YES
      : providerPermissions
        ? InstagramCapabilityState.NO
        : InstagramCapabilityState.UNKNOWN;
    const authorizationHealth = hasInsights
      ? InstagramAuthorizationHealth.CONNECTED_FULL
      : providerPermissions
        ? InstagramAuthorizationHealth.PARTIALLY_CONNECTED
        : InstagramAuthorizationHealth.NEEDS_REVALIDATION;

    const expiresAt = addSeconds(new Date(), tokenResult.expiresInSeconds);
    const handle = withAt(me.username);

    await this.prisma.$transaction(async (tx) => {
      const token = encryptField(tokenResult.accessToken);
      if (!existing) {
        await tx.brandIntegration.create({
          data: {
            brandProfileId: brand.id,
            provider: BrandIntegrationProvider.INSTAGRAM,
            status,
            currentPlatformHandle: handle,
            inboundOauthHandle: handle,
            accessTokenEncrypted: token,
            grantedScopes: scopes,
            tokenExpiresAt: expiresAt,
            tokenIssuedAt: new Date(),
            providerAccountId: me.userId,
            providerAppScopedUserId: me.appScopedUserId,
            identityVerification: InstagramIdentityVerification.VERIFIED,
            authorizationHealth,
            firstPartyProfileCapability: InstagramCapabilityState.YES,
            firstPartyInsightsCapability: insightsCapability,
            humanActionRequired: false,
            syncHealth: InstagramSyncHealth.NOT_CONFIGURED,
            credentialVersion: 1,
            authorizationGeneration: 1,
            isActive: true,
          },
        });
      } else {
        const updated = await tx.brandIntegration.updateMany({
          where: {
            id: existing.id,
            authorizationGeneration: expectedGeneration,
          },
          data: {
            status,
            currentPlatformHandle: handle,
            inboundOauthHandle: handle,
            accessTokenEncrypted: token,
            refreshTokenEncrypted: null,
            grantedScopes: scopes,
            tokenExpiresAt: expiresAt,
            tokenIssuedAt: new Date(),
            providerAccountId: me.userId,
            providerAppScopedUserId: me.appScopedUserId,
            identityVerification: InstagramIdentityVerification.VERIFIED,
            authorizationHealth,
            firstPartyProfileCapability: InstagramCapabilityState.YES,
            firstPartyInsightsCapability: insightsCapability,
            humanActionRequired: false,
            syncHealth: InstagramSyncHealth.NOT_CONFIGURED,
            credentialVersion: { increment: 1 },
            authorizationGeneration: { increment: 1 },
            isActive: true,
            pendingAccessTokenEncrypted: null,
            pendingGrantedScopes: [],
            pendingTokenExpiresAt: null,
            pendingProviderAccountId: null,
            pendingProviderAppScopedUserId: null,
            pendingOauthIntent: null,
            pendingExpectedGeneration: null,
            tokenLastRefreshedAt: null,
            tokenRefreshAttemptedAt: null,
            authorizationLossTransitionId: null,
            authorizationLossOpenedAt: null,
          },
        });
        if (updated.count !== 1) {
          throw new BadRequestException({
            code: "STALE_INSTAGRAM_AUTHORIZATION_GENERATION",
            message: "Instagram state changed. Start a fresh connection.",
          });
        }
      }
      await tx.brandProfile.update({
        where: { id: brand.id },
        data: {
          socialSyncSkipped: false,
          igHandle: normalizeHandle(me.username),
          igHandleProvenance: InstagramIgHandleProvenance.META_DIRECT,
        },
      });
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

  private async assertNoActiveDeletion(brandProfileId: string): Promise<void> {
    const active = await this.prisma.brandInstagramDeletionRequest.count({
      where: {
        brandProfileId,
        state: { notIn: ["COMPLETED", "FAILED_TERMINAL"] },
      },
    });
    if (active) {
      throw new BadRequestException({
        code: "INSTAGRAM_DELETION_IN_PROGRESS",
        message: "Instagram data deletion is in progress.",
      });
    }
  }
}
