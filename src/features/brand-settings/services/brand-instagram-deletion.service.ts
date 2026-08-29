import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BrandIntegrationProvider,
  InstagramAuthorizationHealth,
  InstagramCapabilityState,
  InstagramDeletionSource,
  InstagramDeletionState,
  InstagramIgHandleProvenance,
  InstagramSyncHealth,
  Prisma,
} from "@prisma/client";
import { randomBytes } from "node:crypto";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { BrandSettingsAccessService } from "./brand-settings-access.service";

const DELETE_POLICY_VERSION = "BS06_P1_V1";

@Injectable()
export class BrandInstagramDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandSettingsAccessService,
  ) {}

  async requestByUser(user: AuthUser, integrationId: string) {
    const context = await this.access.resolveBrandContext(user);
    this.access.assertInstagramAction(
      context.membership.role,
      "DELETE_MY_DATA",
    );
    const integration = await this.prisma.brandIntegration.findFirst({
      where: {
        id: integrationId,
        brandProfileId: context.brandProfileId,
        provider: BrandIntegrationProvider.INSTAGRAM,
      },
    });
    if (!integration) throw new NotFoundException("Integration not found");

    const existing = await this.findEffectiveCompleted(
      integration.brandProfileId,
      integration.authorizationGeneration,
    );
    if (existing) return this.toReceipt(existing);

    const request = await this.prisma.brandInstagramDeletionRequest.upsert({
      where: {
        brandProfileId_source_requestedGeneration: {
          brandProfileId: integration.brandProfileId,
          source: InstagramDeletionSource.USER,
          requestedGeneration: integration.authorizationGeneration,
        },
      },
      create: {
        brandProfileId: integration.brandProfileId,
        providerAccountId: integration.providerAccountId,
        providerAppScopedUserId: integration.providerAppScopedUserId,
        source: InstagramDeletionSource.USER,
        requesterUserId: user.id,
        requestedGeneration: integration.authorizationGeneration,
        confirmationCode: opaqueCode(),
        policyVersion: DELETE_POLICY_VERSION,
      },
      update: {},
    });
    return this.toReceipt(await this.process(request.id));
  }

  async requestByMetaCallback(args: {
    providerAppScopedUserId: string;
    callbackRequestHash: string;
    confirmationCode: string;
  }) {
    const integrations = await this.prisma.brandIntegration.findMany({
      where: {
        provider: BrandIntegrationProvider.INSTAGRAM,
        providerAppScopedUserId: args.providerAppScopedUserId,
      },
      orderBy: [{ brandProfileId: "asc" }, { id: "asc" }],
    });
    if (integrations.length === 0) {
      throw new NotFoundException("Instagram deletion subject not found");
    }

    const priorBatch =
      (await this.prisma.brandInstagramDeletionRequest.findFirst({
        where: { callbackRequestHash: args.callbackRequestHash },
        orderBy: [{ brandProfileId: "asc" }, { requestedAt: "asc" }],
      })) ??
      (await this.prisma.brandInstagramDeletionRequest.findFirst({
        where: {
          source: InstagramDeletionSource.META_CALLBACK,
          OR: integrations.map((integration) => ({
            brandProfileId: integration.brandProfileId,
            requestedGeneration: integration.authorizationGeneration,
          })),
        },
        orderBy: [{ brandProfileId: "asc" }, { requestedAt: "asc" }],
      }));
    const batchConfirmationCode =
      priorBatch?.confirmationCode ?? args.confirmationCode;
    const requests: Array<{ id: string; confirmationCode: string }> = [];
    for (const integration of integrations) {
      const replay = await this.prisma.brandInstagramDeletionRequest.findUnique(
        {
          where: {
            brandProfileId_callbackRequestHash: {
              brandProfileId: integration.brandProfileId,
              callbackRequestHash: args.callbackRequestHash,
            },
          },
        },
      );
      const request =
        replay ??
        (await this.prisma.brandInstagramDeletionRequest.upsert({
          where: {
            brandProfileId_source_requestedGeneration: {
              brandProfileId: integration.brandProfileId,
              source: InstagramDeletionSource.META_CALLBACK,
              requestedGeneration: integration.authorizationGeneration,
            },
          },
          create: {
            brandProfileId: integration.brandProfileId,
            providerAccountId: integration.providerAccountId,
            providerAppScopedUserId: integration.providerAppScopedUserId,
            source: InstagramDeletionSource.META_CALLBACK,
            requestedGeneration: integration.authorizationGeneration,
            callbackRequestHash: args.callbackRequestHash,
            confirmationCode: batchConfirmationCode,
            policyVersion: DELETE_POLICY_VERSION,
          },
          update: {},
        }));
      requests.push({
        id: request.id,
        confirmationCode: request.confirmationCode,
      });
    }
    for (const request of requests) await this.process(request.id);
    return {
      requestIds: requests.map((request) => request.id),
      confirmationCode: requests[0].confirmationCode,
    };
  }

  async processPending(): Promise<number> {
    const rows = await this.prisma.brandInstagramDeletionRequest.findMany({
      where: {
        state: {
          in: [
            InstagramDeletionState.REQUESTED,
            InstagramDeletionState.FENCED,
            InstagramDeletionState.IN_PROGRESS,
            InstagramDeletionState.FAILED_RETRYABLE,
          ],
        },
      },
      orderBy: { requestedAt: "asc" },
      take: 20,
      select: { id: true },
    });
    for (const row of rows) {
      try {
        await this.process(row.id);
      } catch {
        // The request remains FAILED_RETRYABLE; one subject must not starve peers.
      }
    }
    return rows.length;
  }

  async status(confirmationCode: string) {
    const rows = await this.prisma.brandInstagramDeletionRequest.findMany({
      where: { confirmationCode },
      orderBy: [{ brandProfileId: "asc" }, { requestedAt: "asc" }],
      select: {
        state: true,
        requestedAt: true,
        completedAt: true,
        policyVersion: true,
      },
    });
    if (rows.length === 0)
      throw new NotFoundException("Deletion status not found");
    return {
      confirmation_code: confirmationCode,
      status: rows.every(
        (row) => row.state === InstagramDeletionState.COMPLETED,
      )
        ? "COMPLETED"
        : rows.some(
              (row) => row.state === InstagramDeletionState.FAILED_TERMINAL,
            )
          ? "FAILED"
          : "IN_PROGRESS",
      scopes: rows.length,
      requested_at: rows[0].requestedAt.toISOString(),
      completed_at: rows.every((row) => row.completedAt)
        ? rows
            .map((row) => row.completedAt as Date)
            .sort((a, b) => b.getTime() - a.getTime())[0]
            .toISOString()
        : null,
      policy_version: rows[0].policyVersion,
    };
  }

  private async process(requestId: string) {
    try {
      await this.establishFence(requestId);
      await this.completePurge(requestId);
    } catch (error) {
      await this.prisma.brandInstagramDeletionRequest.updateMany({
        where: {
          id: requestId,
          state: { not: InstagramDeletionState.COMPLETED },
        },
        data: {
          state: InstagramDeletionState.FAILED_RETRYABLE,
          lastErrorCode: safeErrorCode(error),
        },
      });
      throw error;
    }
    return this.prisma.brandInstagramDeletionRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
  }

  private async establishFence(requestId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT deletion_request_id FROM brand_instagram_deletion_requests WHERE deletion_request_id = ${requestId}::uuid FOR UPDATE`;
      const request = await tx.brandInstagramDeletionRequest.findUniqueOrThrow({
        where: { id: requestId },
      });
      if (request.state === InstagramDeletionState.COMPLETED) return;
      if (request.fenceGeneration !== null) return;
      if (
        request.state !== InstagramDeletionState.REQUESTED &&
        request.state !== InstagramDeletionState.FAILED_RETRYABLE
      ) {
        return;
      }
      const integration = await tx.brandIntegration.findUnique({
        where: {
          brandProfileId_provider: {
            brandProfileId: request.brandProfileId,
            provider: BrandIntegrationProvider.INSTAGRAM,
          },
        },
      });
      const nextGeneration = (integration?.authorizationGeneration ?? 0) + 1;
      if (integration) {
        await tx.brandIntegration.update({
          where: { id: integration.id },
          data: {
            authorizationGeneration: nextGeneration,
            credentialVersion: { increment: 1 },
            isActive: false,
            authorizationHealth: InstagramAuthorizationHealth.DISCONNECTED,
            humanActionRequired: false,
            accessTokenEncrypted: null,
            refreshTokenEncrypted: null,
            pendingAccessTokenEncrypted: null,
            currentPlatformHandle: null,
            inboundOauthHandle: null,
            grantedScopes: [],
            pendingGrantedScopes: [],
            tokenExpiresAt: null,
            pendingTokenExpiresAt: null,
            tokenIssuedAt: null,
            tokenLastRefreshedAt: null,
            tokenRefreshAttemptedAt: null,
            pendingProviderAccountId: null,
            pendingProviderAppScopedUserId: null,
            pendingOauthIntent: null,
            pendingExpectedGeneration: null,
            firstPartyProfileCapability: InstagramCapabilityState.UNKNOWN,
            firstPartyInsightsCapability: InstagramCapabilityState.UNKNOWN,
            syncHealth: InstagramSyncHealth.NOT_CONFIGURED,
            authorizationLossTransitionId: null,
            authorizationLossOpenedAt: null,
          },
        });
      }
      const now = new Date();
      await tx.brandInstagramOAuthState.updateMany({
        where: {
          brandProfileId: request.brandProfileId,
          consumedAt: null,
        },
        data: { consumedAt: now },
      });
      await tx.instagramSyncInvitation.updateMany({
        where: {
          brandProfileId: request.brandProfileId,
          status: { not: "COMPLETED" },
        },
        data: {
          status: "EXPIRED",
          otpCode: null,
          otpExpiresAt: null,
          oauthStateHash: null,
          oauthRedirectUri: null,
          oauthExpectedGeneration: null,
          oauthStateExpiresAt: null,
          oauthStateConsumedAt: now,
        },
      });
      await tx.brandInstagramDeletionRequest.update({
        where: { id: request.id },
        data: {
          state: InstagramDeletionState.FENCED,
          fenceGeneration: nextGeneration,
          fencedAt: now,
          attemptCount: { increment: 1 },
          lastErrorCode: null,
        },
      });
    });
  }

  private async completePurge(requestId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT deletion_request_id FROM brand_instagram_deletion_requests WHERE deletion_request_id = ${requestId}::uuid FOR UPDATE`;
      const request = await tx.brandInstagramDeletionRequest.findUniqueOrThrow({
        where: { id: requestId },
      });
      if (request.state === InstagramDeletionState.COMPLETED) return;
      if (!request.fenceGeneration) {
        throw new BadRequestException("Deletion fence is not established");
      }
      await tx.brandInstagramDeletionRequest.update({
        where: { id: request.id },
        data: {
          state: InstagramDeletionState.IN_PROGRESS,
          startedAt: request.startedAt ?? new Date(),
        },
      });
      const profileResult = await tx.brandProfile.updateMany({
        where: {
          id: request.brandProfileId,
          igHandleProvenance: {
            in: [
              InstagramIgHandleProvenance.META_DIRECT,
              InstagramIgHandleProvenance.LEGACY_UNKNOWN,
            ],
          },
        },
        data: { igHandle: null },
      });
      await tx.brandInstagramDeletionRequest.update({
        where: { id: request.id },
        data: {
          state: InstagramDeletionState.COMPLETED,
          completedAt: new Date(),
          resultSummary: {
            deleted: ["CREDENTIAL_OR_AUTH"],
            sanitized: [
              "BrandIntegration.provider_display_identity",
              ...(profileResult.count ? ["BrandProfile.igHandle"] : []),
            ],
            retained: [
              "CREATOR_OWNED_DATA",
              "CAMPAIGN_COLLABORATION_BUSINESS_HISTORY",
              "USER_ENTERED_OR_WEBSITE_DERIVED_IG_HANDLE",
              "MINIMUM_OPERATIONAL_AUDIT_METADATA",
            ],
          } satisfies Prisma.InputJsonObject,
        },
      });
    });
  }

  private findEffectiveCompleted(brandProfileId: string, generation: number) {
    return this.prisma.brandInstagramDeletionRequest.findFirst({
      where: {
        brandProfileId,
        state: InstagramDeletionState.COMPLETED,
        fenceGeneration: generation,
      },
      orderBy: { completedAt: "desc" },
    });
  }

  private toReceipt(row: {
    id: string;
    confirmationCode: string;
    state: InstagramDeletionState;
    requestedAt: Date;
    completedAt: Date | null;
    resultSummary: Prisma.JsonValue | null;
    policyVersion: string;
  }) {
    return {
      requestId: row.id,
      confirmationCode: row.confirmationCode,
      state: row.state,
      requestedAt: row.requestedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      result: row.resultSummary,
      policyVersion: row.policyVersion,
    };
  }
}

function opaqueCode(): string {
  return randomBytes(24).toString("base64url");
}

function safeErrorCode(error: unknown): string {
  if (error instanceof Error) return error.name.slice(0, 100);
  return "UNKNOWN_ERROR";
}

export function newMetaConfirmationCode(): string {
  return opaqueCode();
}
