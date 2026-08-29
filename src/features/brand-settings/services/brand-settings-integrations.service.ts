import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import {
  BrandIntegrationProvider,
  BrandIntegrationScope,
  BrandIntegrationStatus,
  BrandRole,
  InstagramAuthorizationHealth,
  InstagramCapabilityState,
  InstagramIdentityVerification,
  InstagramIgHandleProvenance,
  InstagramOAuthIntent,
  InstagramProfessionalAccountType,
  InstagramSyncHealth,
  Prisma,
} from "@prisma/client";
import { addSeconds } from "date-fns";
import { randomUUID } from "node:crypto";

import type { AuthUser } from "../../auth/types/auth-user";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  decryptField,
  encryptField,
} from "../../../shared/crypto/field-encryption.util";
import {
  InstagramGraphClient,
  InstagramPermissionEvidenceError,
  InstagramProviderRequestError,
} from "../../instagram/instagram-graph.client";
import {
  InstagramOAuthClient,
  InstagramTokenRefreshError,
} from "../../instagram/instagram-oauth.client";
import { resolveInstagramScopesFromPermissions } from "../../instagram/instagram-scope.util";
import type { InstagramProviderErrorClass } from "../../instagram/instagram-provider-error";
import { NotificationDispatchService } from "../../notifications/services/notification-dispatch.service";
import { BrandInstagramDeletionService } from "./brand-instagram-deletion.service";
import { BrandSettingsAccessService } from "./brand-settings-access.service";
import { BrandInstagramOAuthStateService } from "./brand-instagram-oauth-state.service";

export const INSTAGRAM_REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const INSTAGRAM_MIN_REFRESH_AGE_MS = 24 * 60 * 60 * 1000;

function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

function withAt(handle: string): string {
  const bare = normalizeHandle(handle);
  return bare ? `@${bare}` : "@";
}

type Promotion = {
  brandProfileId: string;
  expectedGeneration: number;
  intent: InstagramOAuthIntent;
  inbound: string;
  encrypted: string;
  scopes: BrandIntegrationScope[];
  expiresAt: Date;
  legacyStatus: BrandIntegrationStatus;
  authorizationHealth: InstagramAuthorizationHealth;
  insightsCapability: InstagramCapabilityState;
  providerAccountId: string;
  providerAppScopedUserId: string | null;
};

@Injectable()
export class BrandSettingsIntegrationsService {
  private readonly logger = new Logger(BrandSettingsIntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandSettingsAccessService,
    private readonly oauth: InstagramOAuthClient,
    private readonly graph: InstagramGraphClient,
    private readonly states: BrandInstagramOAuthStateService,
    @Optional() private readonly deletion?: BrandInstagramDeletionService,
    @Optional() private readonly notifications?: NotificationDispatchService,
  ) {}

  async getIntegrations(user: AuthUser) {
    const { brandProfileId, membership } =
      await this.access.resolveBrandContext(user);
    this.access.assertInstagramAction(membership.role, "READ");
    const brand = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: {
        id: true,
        igHandle: true,
        igHandleProvenance: true,
        socialSyncSkipped: true,
      },
    });
    if (!brand) throw new NotFoundException("Brand profile not found");
    const rows = await this.prisma.brandIntegration.findMany({
      where: { brandProfileId },
      orderBy: { createdAt: "asc" },
    });
    const activeDeletion =
      await this.prisma.brandInstagramDeletionRequest.findFirst({
        where: {
          brandProfileId,
          state: { notIn: ["COMPLETED", "FAILED_TERMINAL"] },
        },
        orderBy: { requestedAt: "desc" },
        select: { id: true, state: true, requestedAt: true },
      });
    const integrations = rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      status: row.status,
      currentPlatformHandle: row.currentPlatformHandle,
      inboundOauthHandle: row.inboundOauthHandle,
      scopes: row.grantedScopes,
      tokenExpiresAt: row.tokenExpiresAt?.toISOString() ?? null,
      tokenIssuedAt: row.tokenIssuedAt?.toISOString() ?? null,
      tokenLastRefreshedAt: row.tokenLastRefreshedAt?.toISOString() ?? null,
      isActive: row.isActive,
      authorizationHealth: row.authorizationHealth,
      identityVerification: row.identityVerification,
      providerAccountId: row.providerAccountId,
      providerAppScopedUserId: row.providerAppScopedUserId,
      currentProviderDisplayIdentity: row.currentPlatformHandle,
      capabilities: {
        firstPartyProfile: row.firstPartyProfileCapability,
        firstPartyInsights: row.firstPartyInsightsCapability,
        businessDiscovery: row.businessDiscoveryCapability,
        creatorMarketplaceDiscovery: row.creatorMarketplaceCapability,
      },
      humanActionRequired: row.humanActionRequired,
      syncHealth: row.syncHealth,
      authorizationGeneration: row.authorizationGeneration,
      allowedActions: this.allowedActions(membership.role, row),
    }));
    const instagram = integrations.find(
      (row) => row.provider === BrandIntegrationProvider.INSTAGRAM,
    );
    const metaSuite = integrations.find(
      (row) => row.provider === BrandIntegrationProvider.META_BUSINESS_SUITE,
    );
    const layoutCase =
      instagram?.authorizationHealth ===
      InstagramAuthorizationHealth.CONNECTED_FULL
        ? "FULL_INSTAGRAM"
        : instagram?.authorizationHealth ===
            InstagramAuthorizationHealth.PARTIALLY_CONNECTED
          ? "PARTIAL_INSTAGRAM"
          : "SKIPPED";
    return {
      layoutCase,
      scrapedHandle: brand.igHandle ? withAt(brand.igHandle) : null,
      igHandleProvenance: brand.igHandleProvenance,
      socialSyncSkipped: brand.socialSyncSkipped,
      integrations,
      instagram: instagram ?? null,
      metaBusinessSuite: metaSuite ?? null,
      deletion: activeDeletion
        ? {
            requestId: activeDeletion.id,
            state: activeDeletion.state,
            requestedAt: activeDeletion.requestedAt.toISOString(),
          }
        : null,
    };
  }

  async getInstagramOauthUrl(
    user: AuthUser,
    redirectUri: string,
    requestedIntent?: InstagramOAuthIntent,
  ) {
    const { brandProfileId, membership } =
      await this.access.resolveBrandContext(user);
    const brand = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { id: true, igHandle: true },
    });
    if (!brand) throw new NotFoundException("Brand profile not found");
    const integration = await this.findInstagram(brandProfileId);
    await this.assertNoActiveDeletion(brandProfileId);
    const intent =
      requestedIntent ??
      (!integration
        ? InstagramOAuthIntent.INITIAL_CONNECT
        : InstagramOAuthIntent.RECONNECT);
    this.assertIntentState(integration, intent);
    this.assertIntentRole(membership.role, intent);
    const state = await this.states.issue({
      brandProfileId,
      initiatedByUserId: user.id,
      redirectUri,
      intent,
      initiatedByRole: membership.role,
      expectedGeneration: integration?.authorizationGeneration ?? 0,
      expectedProviderAccountId: integration?.providerAccountId ?? null,
    });
    return {
      url: this.oauth.buildAuthorizeUrl(redirectUri, state),
      state,
      finalizedHandle: brand.igHandle ? withAt(brand.igHandle) : null,
      intent,
      expectedGeneration: integration?.authorizationGeneration ?? 0,
    };
  }

  async connectInstagram(
    user: AuthUser,
    args: { code: string; redirectUri: string; state: string },
  ) {
    const { brandProfileId, membership } =
      await this.access.resolveBrandContext(user);
    const brand = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { id: true },
    });
    if (!brand) throw new NotFoundException("Brand profile not found");
    const attempt = await this.states.consume(
      {
        brandProfileId,
        initiatedByUserId: user.id,
        redirectUri: args.redirectUri,
      },
      args.state,
    );
    if (attempt.initiatedByRole !== membership.role) {
      throw new ForbiddenException("Instagram OAuth role authority changed");
    }
    this.assertIntentRole(membership.role, attempt.intent);
    let existing = await this.findInstagram(brandProfileId);
    if ((existing?.authorizationGeneration ?? 0) !== attempt.expectedGeneration)
      throw staleAttempt();
    const tokenResult = await this.oauth.exchangeAuthorizationCode(
      args.code,
      args.redirectUri,
    );
    const me = await this.graph.fetchMe(tokenResult.accessToken);
    if (me.accountType === InstagramProfessionalAccountType.PERSONAL) {
      throw new BadRequestException({
        code: "PERSONAL_ACCOUNT",
        message: "A Professional Instagram account is required.",
      });
    }
    const evidence = await this.permissionEvidence(
      tokenResult.permissions,
      tokenResult.accessToken,
    );
    const inbound = withAt(me.username);
    const expiresAt = addSeconds(new Date(), tokenResult.expiresInSeconds);
    if (
      existing?.providerAccountId === null &&
      attempt.intent === InstagramOAuthIntent.RECONNECT
    ) {
      existing = await this.revalidateLegacyIdentity(existing, membership.role);
    }
    if (
      attempt.intent === InstagramOAuthIntent.RECONNECT &&
      existing?.providerAccountId !== me.userId
    ) {
      if (!existing) throw staleAttempt();
      await this.stageDifferentAccount({
        integrationId: existing.id,
        expectedGeneration: attempt.expectedGeneration,
        inbound,
        encrypted: encryptField(tokenResult.accessToken),
        scopes: evidence.scopes,
        expiresAt,
        providerAccountId: me.userId,
        providerAppScopedUserId: me.appScopedUserId,
      });
      return {
        conflict: true as const,
        code: "ACCOUNT_CHANGE_REQUIRED",
        integrationId: existing.id,
        currentPlatformHandle: existing.currentPlatformHandle,
        inboundOauthHandle: inbound,
        message:
          "A different Instagram account requires an Owner account-change authorization.",
      };
    }
    const row = await this.promoteConnection({
      brandProfileId,
      expectedGeneration: attempt.expectedGeneration,
      intent: attempt.intent,
      inbound,
      encrypted: encryptField(tokenResult.accessToken),
      scopes: evidence.scopes,
      expiresAt,
      legacyStatus: evidence.legacyStatus,
      authorizationHealth: evidence.authorizationHealth,
      insightsCapability: evidence.insightsCapability,
      providerAccountId: me.userId,
      providerAppScopedUserId: me.appScopedUserId,
    });
    return {
      conflict: false as const,
      connected: true,
      integrationId: row.id,
      handle: inbound,
      status: row.status,
      authorizationHealth: row.authorizationHealth,
      scopes: row.grantedScopes,
      providerAccountId: row.providerAccountId,
    };
  }

  async resolveIdentityConflict(
    user: AuthUser,
    body: {
      integrationId: string;
      currentPlatformHandle: string;
      inboundOauthHandle: string;
      resolution: "OVERWRITE_HANDLE" | "CANCEL_CONNECT";
    },
  ) {
    const { brandProfileId, membership } =
      await this.access.resolveBrandContext(user);
    const row = await this.prisma.brandIntegration.findFirst({
      where: {
        id: body.integrationId,
        brandProfileId,
        provider: BrandIntegrationProvider.INSTAGRAM,
      },
    });
    if (!row) throw new NotFoundException("Integration not found");
    if (body.resolution === "OVERWRITE_HANDLE") {
      this.access.assertInstagramAction(
        membership.role,
        "CONTROLLED_ACCOUNT_CHANGE",
      );
      throw new BadRequestException({
        code: "FRESH_ACCOUNT_CHANGE_OAUTH_REQUIRED",
        message:
          "Start a fresh Instagram authorization with ACCOUNT_CHANGE intent.",
      });
    }
    await this.prisma.brandIntegration.update({
      where: { id: row.id },
      data: {
        inboundOauthHandle: null,
        pendingAccessTokenEncrypted: null,
        pendingGrantedScopes: [],
        pendingTokenExpiresAt: null,
        pendingProviderAccountId: null,
        pendingProviderAppScopedUserId: null,
        pendingOauthIntent: null,
        pendingExpectedGeneration: null,
      },
    });
    return { ok: true, resolution: "CANCEL_CONNECT", cancelled: true };
  }

  async manageAction(
    user: AuthUser,
    body: {
      integrationId: string;
      action: "RECONNECT" | "DISCONNECT_INTEGRATION" | "DELETE_INGESTED_DATA";
      confirmDeleteData?: boolean;
    },
  ) {
    const { brandProfileId, membership } =
      await this.access.resolveBrandContext(user);
    const row = await this.prisma.brandIntegration.findFirst({
      where: { id: body.integrationId, brandProfileId },
    });
    if (!row) throw new NotFoundException("Integration not found");
    if (body.action === "RECONNECT") {
      this.access.assertInstagramAction(membership.role, "SAME_ID_RECONNECT");
      return {
        ok: true,
        action: body.action,
        next: "START_OAUTH",
        intent: InstagramOAuthIntent.RECONNECT,
        provider: row.provider,
      };
    }
    if (body.action === "DISCONNECT_INTEGRATION") {
      this.access.assertInstagramAction(membership.role, "DISCONNECT");
      await this.disconnect(row.id, row.authorizationGeneration);
      return { ok: true, action: body.action };
    }
    this.access.assertInstagramAction(membership.role, "DELETE_MY_DATA");
    if (!body.confirmDeleteData)
      throw new BadRequestException("Explicit deletion confirmation required");
    if (!this.deletion)
      throw new Error("Instagram deletion service unavailable");
    return this.deletion.requestByUser(user, row.id);
  }

  async markExpiredTokens(): Promise<{ scanned: number; expired: number }> {
    const result = await this.refreshDueTokens();
    return { scanned: result.scanned, expired: result.reauthorizationRequired };
  }

  async refreshDueTokens(): Promise<{
    scanned: number;
    refreshed: number;
    reauthorizationRequired: number;
  }> {
    const now = new Date();
    const candidates = await this.prisma.brandIntegration.findMany({
      where: {
        provider: BrandIntegrationProvider.INSTAGRAM,
        isActive: true,
        accessTokenEncrypted: { not: null },
        tokenExpiresAt: {
          lte: new Date(now.getTime() + INSTAGRAM_REFRESH_WINDOW_MS),
        },
        tokenIssuedAt: {
          lte: new Date(now.getTime() - INSTAGRAM_MIN_REFRESH_AGE_MS),
        },
      },
      orderBy: { tokenExpiresAt: "asc" },
      take: 100,
    });
    let refreshed = 0;
    let reauthorizationRequired = 0;
    for (const row of candidates) {
      const generation = row.authorizationGeneration;
      const version = row.credentialVersion;
      const accessToken = decryptField(row.accessTokenEncrypted as string);
      await this.prisma.brandIntegration.updateMany({
        where: {
          id: row.id,
          authorizationGeneration: generation,
          credentialVersion: version,
          isActive: true,
        },
        data: { tokenRefreshAttemptedAt: now },
      });
      if (row.tokenExpiresAt && row.tokenExpiresAt <= now) {
        try {
          // Timestamp is evidence, not authority: probe before deciding whether
          // the token is still valid enough for a provider-compliant refresh.
          await this.graph.fetchMe(accessToken);
        } catch (error) {
          await this.applyProviderFailure(
            row.id,
            generation,
            version,
            providerFailureClassification(error),
          );
          if (isHumanReauthorizationFailure(error)) {
            reauthorizationRequired += 1;
          }
          continue;
        }
      }
      try {
        const token = await this.oauth.refreshLongLivedToken(accessToken);
        const update = await this.prisma.brandIntegration.updateMany({
          where: {
            id: row.id,
            authorizationGeneration: generation,
            credentialVersion: version,
            isActive: true,
          },
          data: {
            accessTokenEncrypted: encryptField(token.accessToken),
            tokenExpiresAt: addSeconds(now, token.expiresInSeconds),
            tokenIssuedAt: now,
            tokenLastRefreshedAt: now,
            credentialVersion: { increment: 1 },
            authorizationHealth: healthFromCapabilities(row),
            humanActionRequired: false,
            authorizationLossTransitionId: null,
            authorizationLossOpenedAt: null,
          },
        });
        refreshed += update.count;
      } catch (error) {
        await this.applyProviderFailure(
          row.id,
          generation,
          version,
          providerFailureClassification(error),
        );
        if (isHumanReauthorizationFailure(error)) reauthorizationRequired += 1;
      }
    }
    return { scanned: candidates.length, refreshed, reauthorizationRequired };
  }

  private async applyProviderFailure(
    integrationId: string,
    generation: number,
    credentialVersion: number,
    classification: InstagramProviderErrorClass,
  ): Promise<void> {
    if (classification === "PROVIDER_ACCESS_BLOCKED") {
      await this.prisma.brandIntegration.updateMany({
        where: {
          id: integrationId,
          authorizationGeneration: generation,
          credentialVersion,
          isActive: true,
        },
        data: {
          authorizationHealth:
            InstagramAuthorizationHealth.PROVIDER_ACCESS_BLOCKED,
          humanActionRequired: false,
          authorizationLossTransitionId: null,
          authorizationLossOpenedAt: null,
        },
      });
      return;
    }
    if (
      classification === "AUTHORIZATION_REVALIDATION_REQUIRED" ||
      classification === "PERMISSION_LOSS"
    ) {
      await this.openAuthorizationLoss(integrationId, generation);
      return;
    }
    await this.prisma.brandIntegration.updateMany({
      where: {
        id: integrationId,
        authorizationGeneration: generation,
        credentialVersion,
        isActive: true,
        authorizationLossTransitionId: null,
      },
      data: {
        authorizationHealth: InstagramAuthorizationHealth.UNKNOWN,
        humanActionRequired: false,
      },
    });
  }

  private async permissionEvidence(
    tokenPermissions: string[],
    accessToken: string,
  ) {
    let permissionReadSucceeded = true;
    let providerPermissions: string[] = [];
    try {
      providerPermissions =
        await this.graph.fetchGrantedPermissions(accessToken);
    } catch (error) {
      if (!(error instanceof InstagramPermissionEvidenceError)) throw error;
      permissionReadSucceeded = false;
    }
    const resolved = resolveInstagramScopesFromPermissions([
      ...tokenPermissions,
      ...providerPermissions,
    ]);
    if (!resolved.scopes.includes(BrandIntegrationScope.BASIC_PROFILE))
      resolved.scopes.unshift(BrandIntegrationScope.BASIC_PROFILE);
    const insightsCapability = resolved.scopes.includes(
      BrandIntegrationScope.ENGAGEMENT_INSIGHTS,
    )
      ? InstagramCapabilityState.YES
      : permissionReadSucceeded
        ? InstagramCapabilityState.NO
        : InstagramCapabilityState.UNKNOWN;
    return {
      scopes: resolved.scopes,
      insightsCapability,
      legacyStatus:
        insightsCapability === InstagramCapabilityState.YES
          ? BrandIntegrationStatus.CONNECTED
          : BrandIntegrationStatus.PARTIALLY_CONNECTED,
      authorizationHealth:
        insightsCapability === InstagramCapabilityState.YES
          ? InstagramAuthorizationHealth.CONNECTED_FULL
          : insightsCapability === InstagramCapabilityState.NO
            ? InstagramAuthorizationHealth.PARTIALLY_CONNECTED
            : InstagramAuthorizationHealth.NEEDS_REVALIDATION,
    };
  }

  private async promoteConnection(input: Promotion) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.brandIntegration.findUnique({
        where: {
          brandProfileId_provider: {
            brandProfileId: input.brandProfileId,
            provider: BrandIntegrationProvider.INSTAGRAM,
          },
        },
      });
      let row;
      if (!existing) {
        if (
          input.intent !== InstagramOAuthIntent.INITIAL_CONNECT ||
          input.expectedGeneration !== 0
        )
          throw staleAttempt();
        row = await tx.brandIntegration.create({
          data: {
            brandProfileId: input.brandProfileId,
            provider: BrandIntegrationProvider.INSTAGRAM,
            status: input.legacyStatus,
            currentPlatformHandle: input.inbound,
            inboundOauthHandle: input.inbound,
            accessTokenEncrypted: input.encrypted,
            grantedScopes: input.scopes,
            tokenExpiresAt: input.expiresAt,
            tokenIssuedAt: new Date(),
            credentialVersion: 1,
            authorizationGeneration: 1,
            providerAccountId: input.providerAccountId,
            providerAppScopedUserId: input.providerAppScopedUserId,
            identityVerification: InstagramIdentityVerification.VERIFIED,
            authorizationHealth: input.authorizationHealth,
            firstPartyProfileCapability: InstagramCapabilityState.YES,
            firstPartyInsightsCapability: input.insightsCapability,
            humanActionRequired: false,
            syncHealth: InstagramSyncHealth.NOT_CONFIGURED,
            isActive: true,
          },
        });
      } else {
        const updated = await tx.brandIntegration.updateMany({
          where: {
            id: existing.id,
            authorizationGeneration: input.expectedGeneration,
          },
          data: {
            status: input.legacyStatus,
            currentPlatformHandle: input.inbound,
            inboundOauthHandle: input.inbound,
            accessTokenEncrypted: input.encrypted,
            refreshTokenEncrypted: null,
            grantedScopes: input.scopes,
            tokenExpiresAt: input.expiresAt,
            tokenIssuedAt: new Date(),
            tokenLastRefreshedAt: null,
            tokenRefreshAttemptedAt: null,
            credentialVersion: { increment: 1 },
            authorizationGeneration: { increment: 1 },
            providerAccountId: input.providerAccountId,
            providerAppScopedUserId: input.providerAppScopedUserId,
            identityVerification: InstagramIdentityVerification.VERIFIED,
            authorizationHealth: input.authorizationHealth,
            firstPartyProfileCapability: InstagramCapabilityState.YES,
            firstPartyInsightsCapability: input.insightsCapability,
            humanActionRequired: false,
            syncHealth: InstagramSyncHealth.NOT_CONFIGURED,
            isActive: true,
            pendingAccessTokenEncrypted: null,
            pendingGrantedScopes: [],
            pendingTokenExpiresAt: null,
            pendingProviderAccountId: null,
            pendingProviderAppScopedUserId: null,
            pendingOauthIntent: null,
            pendingExpectedGeneration: null,
            authorizationLossTransitionId: null,
            authorizationLossOpenedAt: null,
          },
        });
        if (updated.count !== 1) throw staleAttempt();
        row = await tx.brandIntegration.findUniqueOrThrow({
          where: { id: existing.id },
        });
      }
      await tx.brandProfile.update({
        where: { id: input.brandProfileId },
        data: {
          socialSyncSkipped: false,
          igHandle: normalizeHandle(input.inbound),
          igHandleProvenance: InstagramIgHandleProvenance.META_DIRECT,
        },
      });
      return row;
    });
  }

  private async stageDifferentAccount(args: {
    integrationId: string;
    expectedGeneration: number;
    inbound: string;
    encrypted: string;
    scopes: BrandIntegrationScope[];
    expiresAt: Date;
    providerAccountId: string;
    providerAppScopedUserId: string | null;
  }) {
    const result = await this.prisma.brandIntegration.updateMany({
      where: {
        id: args.integrationId,
        authorizationGeneration: args.expectedGeneration,
      },
      data: {
        inboundOauthHandle: args.inbound,
        pendingAccessTokenEncrypted: args.encrypted,
        pendingGrantedScopes: args.scopes,
        pendingTokenExpiresAt: args.expiresAt,
        pendingProviderAccountId: args.providerAccountId,
        pendingProviderAppScopedUserId: args.providerAppScopedUserId,
        pendingOauthIntent: InstagramOAuthIntent.RECONNECT,
        pendingExpectedGeneration: args.expectedGeneration,
      },
    });
    if (result.count !== 1) throw staleAttempt();
  }

  private async revalidateLegacyIdentity(
    row: Prisma.BrandIntegrationGetPayload<object>,
    role: BrandRole,
  ) {
    if (!row.accessTokenEncrypted || !row.isActive) {
      this.assertLegacyReconciliationOwner(role);
      throw new BadRequestException({
        code: "LEGACY_IDENTITY_RECONCILIATION_REQUIRED",
        message: "Start an Owner legacy identity reconciliation.",
      });
    }
    try {
      const me = await this.graph.fetchMe(
        decryptField(row.accessTokenEncrypted),
      );
      const result = await this.prisma.brandIntegration.updateMany({
        where: {
          id: row.id,
          authorizationGeneration: row.authorizationGeneration,
          providerAccountId: null,
        },
        data: {
          providerAccountId: me.userId,
          providerAppScopedUserId: me.appScopedUserId,
          identityVerification: InstagramIdentityVerification.VERIFIED,
        },
      });
      if (result.count !== 1) throw staleAttempt();
      return this.prisma.brandIntegration.findUniqueOrThrow({
        where: { id: row.id },
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        this.assertLegacyReconciliationOwner(role);
        throw new BadRequestException({
          code: "LEGACY_IDENTITY_RECONCILIATION_REQUIRED",
          message:
            "The existing Instagram identity could not be revalidated. Start an Owner legacy reconciliation.",
        });
      }
      throw error;
    }
  }

  private assertLegacyReconciliationOwner(role: BrandRole): void {
    if (role !== BrandRole.BRAND_OWNER)
      throw new ForbiddenException(
        "Only a Brand Owner can reconcile an unverified legacy Instagram identity.",
      );
  }

  private async disconnect(id: string, expectedGeneration: number) {
    const current = await this.prisma.brandIntegration.findUniqueOrThrow({
      where: { id },
    });
    const result = await this.prisma.brandIntegration.updateMany({
      where: { id, authorizationGeneration: expectedGeneration },
      data: {
        authorizationGeneration: { increment: 1 },
        credentialVersion: { increment: 1 },
        isActive: false,
        status: BrandIntegrationStatus.DISCONNECTED,
        authorizationHealth: InstagramAuthorizationHealth.DISCONNECTED,
        humanActionRequired: false,
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        pendingAccessTokenEncrypted: null,
        pendingGrantedScopes: [],
        pendingTokenExpiresAt: null,
        pendingProviderAccountId: null,
        pendingProviderAppScopedUserId: null,
        pendingOauthIntent: null,
        pendingExpectedGeneration: null,
        authorizationLossTransitionId: null,
        authorizationLossOpenedAt: null,
      },
    });
    if (result.count !== 1) throw staleAttempt();
    await this.prisma.brandInstagramOAuthState.updateMany({
      where: { brandProfileId: current.brandProfileId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }

  private async openAuthorizationLoss(
    integrationId: string,
    expectedGeneration: number,
  ) {
    const transitionId = randomUUID();
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await tx.brandIntegration.findUniqueOrThrow({
        where: { id: integrationId },
      });
      if (
        current.authorizationGeneration !== expectedGeneration ||
        !current.isActive
      )
        return null;
      if (current.authorizationLossTransitionId) return current;
      return tx.brandIntegration.update({
        where: { id: current.id },
        data: {
          authorizationHealth: InstagramAuthorizationHealth.NEEDS_REVALIDATION,
          humanActionRequired: true,
          authorizationLossTransitionId: transitionId,
          authorizationLossOpenedAt: new Date(),
        },
      });
    });
    if (!row?.authorizationLossTransitionId || !this.notifications) return;
    await this.notifications.dispatch({
      eventType: "integration.instagram_token_expired",
      workspaceId: row.brandProfileId,
      source: {
        sourceType: "BRAND_INSTAGRAM_AUTHORIZATION",
        sourceId: row.id,
        transitionId: row.authorizationLossTransitionId,
      },
      payload: {
        integration_id: row.id,
        authorization_health: row.authorizationHealth,
      },
    });
  }

  private assertIntentRole(role: BrandRole, intent: InstagramOAuthIntent) {
    const action =
      intent === InstagramOAuthIntent.INITIAL_CONNECT
        ? "INITIAL_CONNECT"
        : intent === InstagramOAuthIntent.RECONNECT
          ? "SAME_ID_RECONNECT"
          : intent === InstagramOAuthIntent.ACCOUNT_CHANGE
            ? "CONTROLLED_ACCOUNT_CHANGE"
            : "LEGACY_IDENTITY_RECONCILIATION";
    this.access.assertInstagramAction(role, action);
  }

  private assertIntentState(
    integration: Prisma.BrandIntegrationGetPayload<object> | null,
    intent: InstagramOAuthIntent,
  ): void {
    const invalid = () =>
      new BadRequestException({
        code: "INVALID_INSTAGRAM_OAUTH_INTENT",
        message:
          "The requested Instagram operation does not match current state.",
      });
    if (intent === InstagramOAuthIntent.INITIAL_CONNECT && integration) {
      throw invalid();
    }
    if (intent === InstagramOAuthIntent.RECONNECT && !integration) {
      throw invalid();
    }
    if (
      intent === InstagramOAuthIntent.ACCOUNT_CHANGE &&
      !integration?.providerAccountId
    ) {
      throw invalid();
    }
    if (
      intent === InstagramOAuthIntent.LEGACY_IDENTITY_RECONCILIATION &&
      (!integration || integration.providerAccountId)
    ) {
      throw invalid();
    }
  }

  private findInstagram(brandProfileId: string) {
    return this.prisma.brandIntegration.findUnique({
      where: {
        brandProfileId_provider: {
          brandProfileId,
          provider: BrandIntegrationProvider.INSTAGRAM,
        },
      },
    });
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

  private allowedActions(
    role: BrandRole,
    row: { providerAccountId: string | null; isActive: boolean },
  ) {
    return {
      read: true,
      initialConnect: false,
      sameIdReconnect:
        role === BrandRole.BRAND_OWNER || role === BrandRole.CAMPAIGN_MANAGER,
      controlledAccountChange: role === BrandRole.BRAND_OWNER,
      disconnect: role === BrandRole.BRAND_OWNER,
      deleteMyData: role === BrandRole.BRAND_OWNER,
      legacyIdentityReconciliation:
        role === BrandRole.BRAND_OWNER && !row.providerAccountId,
    };
  }
}

function staleAttempt(): BadRequestException {
  return new BadRequestException({
    code: "STALE_INSTAGRAM_AUTHORIZATION_GENERATION",
    message: "Instagram connection state changed. Start a fresh authorization.",
  });
}

function healthFromCapabilities(row: {
  firstPartyProfileCapability: InstagramCapabilityState;
  firstPartyInsightsCapability: InstagramCapabilityState;
}): InstagramAuthorizationHealth {
  if (
    row.firstPartyProfileCapability === InstagramCapabilityState.YES &&
    row.firstPartyInsightsCapability === InstagramCapabilityState.YES
  ) {
    return InstagramAuthorizationHealth.CONNECTED_FULL;
  }
  if (
    row.firstPartyProfileCapability === InstagramCapabilityState.YES &&
    row.firstPartyInsightsCapability === InstagramCapabilityState.NO
  ) {
    return InstagramAuthorizationHealth.PARTIALLY_CONNECTED;
  }
  return InstagramAuthorizationHealth.NEEDS_REVALIDATION;
}

function providerFailureClassification(
  error: unknown,
): InstagramProviderErrorClass {
  if (
    error instanceof InstagramTokenRefreshError ||
    error instanceof InstagramProviderRequestError
  ) {
    return error.classification;
  }
  return "UNKNOWN";
}

function isHumanReauthorizationFailure(error: unknown): boolean {
  const classification = providerFailureClassification(error);
  return (
    classification === "AUTHORIZATION_REVALIDATION_REQUIRED" ||
    classification === "PERMISSION_LOSS"
  );
}
