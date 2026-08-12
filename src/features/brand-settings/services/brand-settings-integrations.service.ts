import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  BrandIntegrationProvider,
  BrandIntegrationScope,
  BrandIntegrationStatus,
  InstagramProfessionalAccountType,
  UceCampaignStatus,
} from "@prisma/client";
import { addSeconds } from "date-fns";

import type { AuthUser } from "../../auth/types/auth-user";
import { PrismaService } from "../../../prisma/prisma.service";
import { encryptField } from "../../../shared/crypto/field-encryption.util";
import { InstagramGraphClient } from "../../instagram/instagram-graph.client";
import { InstagramOAuthClient } from "../../instagram/instagram-oauth.client";
import { resolveInstagramScopesFromPermissions } from "../../instagram/instagram-scope.util";
import { BrandSettingsAccessService } from "./brand-settings-access.service";

function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

function withAt(handle: string): string {
  const bare = normalizeHandle(handle);
  return bare ? `@${bare}` : "@";
}

@Injectable()
export class BrandSettingsIntegrationsService {
  private readonly logger = new Logger(BrandSettingsIntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandSettingsAccessService,
    private readonly oauth: InstagramOAuthClient,
    private readonly graph: InstagramGraphClient,
  ) {}

  async getIntegrations(user: AuthUser) {
    const { brandProfileId } = await this.access.resolveBrandContext(user);
    const brand = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: {
        id: true,
        igHandle: true,
        socialSyncSkipped: true,
      },
    });
    if (!brand) {
      throw new NotFoundException("Brand profile not found");
    }

    const rows = await this.prisma.brandIntegration.findMany({
      where: { brandProfileId },
      orderBy: { createdAt: "asc" },
    });

    const integrations = rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      status: row.status,
      currentPlatformHandle: row.currentPlatformHandle,
      inboundOauthHandle: row.inboundOauthHandle,
      scopes: row.grantedScopes,
      tokenExpiresAt: row.tokenExpiresAt?.toISOString() ?? null,
      isActive: row.isActive,
    }));

    const instagram = integrations.find(
      (i) => i.provider === BrandIntegrationProvider.INSTAGRAM,
    );
    const metaSuite = integrations.find(
      (i) => i.provider === BrandIntegrationProvider.META_BUSINESS_SUITE,
    );

    let layoutCase: "PARTIAL_INSTAGRAM" | "FULL_INSTAGRAM" | "SKIPPED" =
      "SKIPPED";
    if (instagram?.status === BrandIntegrationStatus.PARTIALLY_CONNECTED) {
      layoutCase = "PARTIAL_INSTAGRAM";
    } else if (
      instagram?.status === BrandIntegrationStatus.CONNECTED ||
      instagram?.status === BrandIntegrationStatus.TOKEN_EXPIRED
    ) {
      layoutCase = instagram.scopes.includes(
        BrandIntegrationScope.ENGAGEMENT_INSIGHTS,
      )
        ? "FULL_INSTAGRAM"
        : "PARTIAL_INSTAGRAM";
    } else if (brand.socialSyncSkipped || !instagram) {
      layoutCase = "SKIPPED";
    }

    const scrapedHandle =
      brand.igHandle != null
        ? `@${brand.igHandle.replace(/^@/, "")}`
        : null;

    return {
      layoutCase,
      scrapedHandle,
      socialSyncSkipped: brand.socialSyncSkipped,
      integrations,
      instagram: instagram ?? null,
      metaBusinessSuite: metaSuite ?? null,
    };
  }

  async getInstagramOauthUrl(user: AuthUser, redirectUri: string) {
    const { brandProfileId } = await this.access.resolveBrandContext(user);
    const brand = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { id: true, igHandle: true },
    });
    if (!brand) {
      throw new NotFoundException("Brand profile not found");
    }
    const finalized = brand.igHandle
      ? normalizeHandle(brand.igHandle)
      : "pending";
    const state = Buffer.from(
      JSON.stringify({
        brandProfileId: brand.id,
        finalizedHandle: finalized,
        source: "settings",
        t: Date.now(),
      }),
    ).toString("base64url");
    const url = this.oauth.buildAuthorizeUrl(redirectUri, state);
    return {
      url,
      state,
      finalizedHandle: brand.igHandle ? withAt(brand.igHandle) : null,
    };
  }

  /**
   * Settings Instagram connect. Handle mismatch returns an identity-conflict
   * payload (staged token) instead of hard-failing like onboarding.
   */
  async connectInstagram(
    user: AuthUser,
    args: { code: string; redirectUri: string },
  ) {
    const { brandProfileId } = await this.access.resolveBrandContext(user);
    const brand = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { id: true, igHandle: true },
    });
    if (!brand) {
      throw new NotFoundException("Brand profile not found");
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

    const inbound = withAt(me.username);
    const current = brand.igHandle ? withAt(brand.igHandle) : inbound;
    const expiresAt = addSeconds(new Date(), tokenResult.expiresInSeconds);
    const encrypted = encryptField(tokenResult.accessToken);

    if (brand.igHandle && normalizeHandle(me.username) !== normalizeHandle(brand.igHandle)) {
      const row = await this.prisma.brandIntegration.upsert({
        where: {
          brandProfileId_provider: {
            brandProfileId: brand.id,
            provider: BrandIntegrationProvider.INSTAGRAM,
          },
        },
        create: {
          brandProfileId: brand.id,
          provider: BrandIntegrationProvider.INSTAGRAM,
          status: BrandIntegrationStatus.DISCONNECTED,
          currentPlatformHandle: current,
          inboundOauthHandle: inbound,
          accessTokenEncrypted: encrypted,
          grantedScopes: scopes,
          tokenExpiresAt: expiresAt,
          isActive: false,
        },
        update: {
          inboundOauthHandle: inbound,
          accessTokenEncrypted: encrypted,
          grantedScopes: scopes,
          tokenExpiresAt: expiresAt,
          // Keep prior active status until user resolves conflict.
        },
      });

      return {
        conflict: true as const,
        code: "IDENTITY_CONFLICT",
        integrationId: row.id,
        currentPlatformHandle: withAt(row.currentPlatformHandle),
        inboundOauthHandle: inbound,
        message:
          "Meta Identity Conflict Detected: inbound authenticated handle does not match the active Instagram handle.",
      };
    }

    const row = await this.prisma.brandIntegration.upsert({
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
        currentPlatformHandle: inbound,
        inboundOauthHandle: inbound,
        accessTokenEncrypted: encrypted,
        grantedScopes: scopes,
        tokenExpiresAt: expiresAt,
        isActive: true,
      },
      update: {
        status,
        currentPlatformHandle: inbound,
        inboundOauthHandle: inbound,
        accessTokenEncrypted: encrypted,
        grantedScopes: scopes,
        tokenExpiresAt: expiresAt,
        isActive: true,
      },
    });

    await this.prisma.brandProfile.update({
      where: { id: brand.id },
      data: {
        socialSyncSkipped: false,
        igHandle: normalizeHandle(me.username),
      },
    });

    return {
      conflict: false as const,
      connected: true,
      integrationId: row.id,
      handle: inbound,
      status,
      scopes,
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
    const { brandProfileId } = await this.access.resolveBrandContext(user);
    const row = await this.prisma.brandIntegration.findFirst({
      where: {
        id: body.integrationId,
        brandProfileId,
        provider: BrandIntegrationProvider.INSTAGRAM,
      },
    });
    if (!row) {
      throw new NotFoundException("Integration not found");
    }
    if (!row.inboundOauthHandle || !row.accessTokenEncrypted) {
      throw new BadRequestException(
        "No staged identity conflict to resolve. Reconnect Instagram first.",
      );
    }

    const current = withAt(body.currentPlatformHandle);
    const inbound = withAt(body.inboundOauthHandle);
    if (
      withAt(row.currentPlatformHandle) !== current ||
      withAt(row.inboundOauthHandle) !== inbound
    ) {
      throw new BadRequestException(
        "Identity vectors do not match the staged conflict payload.",
      );
    }

    if (body.resolution === "CANCEL_CONNECT") {
      await this.prisma.brandIntegration.update({
        where: { id: row.id },
        data: {
          inboundOauthHandle: null,
          // Drop staged token if the prior connection was not active.
          ...(row.isActive
            ? {}
            : {
                accessTokenEncrypted: null,
                refreshTokenEncrypted: null,
                tokenExpiresAt: null,
                grantedScopes: [],
                status: BrandIntegrationStatus.DISCONNECTED,
              }),
        },
      });
      return { ok: true, resolution: body.resolution, cancelled: true };
    }

    const status = row.grantedScopes.includes(
      BrandIntegrationScope.ENGAGEMENT_INSIGHTS,
    )
      ? BrandIntegrationStatus.CONNECTED
      : BrandIntegrationStatus.PARTIALLY_CONNECTED;

    await this.prisma.$transaction([
      this.prisma.brandIntegration.update({
        where: { id: row.id },
        data: {
          currentPlatformHandle: inbound,
          inboundOauthHandle: inbound,
          status,
          isActive: true,
        },
      }),
      this.prisma.brandProfile.update({
        where: { id: brandProfileId },
        data: {
          igHandle: normalizeHandle(inbound),
          socialSyncSkipped: false,
        },
      }),
    ]);

    return {
      ok: true,
      resolution: body.resolution,
      handle: inbound,
      status,
    };
  }

  async manageAction(
    user: AuthUser,
    body: {
      integrationId: string;
      action: "RECONNECT" | "DISCONNECT_INTEGRATION" | "DELETE_INGESTED_DATA";
      confirmDeleteData?: boolean;
    },
  ) {
    const { brandProfileId } = await this.access.resolveBrandContext(user);
    const row = await this.prisma.brandIntegration.findFirst({
      where: { id: body.integrationId, brandProfileId },
    });
    if (!row) {
      throw new NotFoundException("Integration not found");
    }

    if (
      body.action === "DISCONNECT_INTEGRATION" ||
      body.action === "DELETE_INGESTED_DATA"
    ) {
      await this.assertNoActiveCampaigns(brandProfileId);
    }

    if (body.action === "DISCONNECT_INTEGRATION") {
      await this.prisma.brandIntegration.update({
        where: { id: row.id },
        data: {
          isActive: false,
          status: BrandIntegrationStatus.DISCONNECTED,
          accessTokenEncrypted: null,
          refreshTokenEncrypted: null,
        },
      });
      return { ok: true, action: body.action };
    }

    if (body.action === "DELETE_INGESTED_DATA") {
      if (!body.confirmDeleteData) {
        throw new BadRequestException(
          'Explicit confirmation required to execute "Delete Ingested Social Data".',
        );
      }
      // Analytics purge deferred until those stores exist; clear tokens for now.
      await this.prisma.brandIntegration.update({
        where: { id: row.id },
        data: {
          isActive: false,
          status: BrandIntegrationStatus.DISCONNECTED,
          accessTokenEncrypted: null,
          refreshTokenEncrypted: null,
          grantedScopes: [],
        },
      });
      return { ok: true, action: body.action, purged: true };
    }

    return {
      ok: true,
      action: body.action,
      next: "START_OAUTH",
      provider: row.provider,
    };
  }

  /** Marks expired Instagram/Meta tokens TOKEN_EXPIRED. Safe per-row errors. */
  async markExpiredTokens(): Promise<{ scanned: number; expired: number }> {
    const now = new Date();
    const candidates = await this.prisma.brandIntegration.findMany({
      where: {
        isActive: true,
        tokenExpiresAt: { lte: now },
        status: {
          in: [
            BrandIntegrationStatus.CONNECTED,
            BrandIntegrationStatus.PARTIALLY_CONNECTED,
          ],
        },
      },
      select: { id: true, brandProfileId: true, provider: true },
    });

    let expired = 0;
    for (const row of candidates) {
      try {
        await this.prisma.brandIntegration.update({
          where: { id: row.id },
          data: { status: BrandIntegrationStatus.TOKEN_EXPIRED },
        });
        expired += 1;
      } catch (err) {
        this.logger.error(
          `token expiry update failed integration=${row.id} brand=${row.brandProfileId} err=${String(err)}`,
        );
      }
    }

    return { scanned: candidates.length, expired };
  }

  private async assertNoActiveCampaigns(brandProfileId: string): Promise<void> {
    const activeCount = await this.prisma.uceCampaign.count({
      where: {
        brandProfileId,
        status: UceCampaignStatus.LIVE,
      },
    });
    if (activeCount > 0) {
      throw new BadRequestException({
        code: "ACTIVE_CAMPAIGNS_BLOCK_DISCONNECT",
        message:
          "Cannot disconnect or purge social data while campaigns are actively running. Conclude active campaigns before modifying API integrations.",
      });
    }
  }
}
