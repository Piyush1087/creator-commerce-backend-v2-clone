import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import {
  BrandIntegrationProvider,
  BrandIntegrationStatus,
  InstagramAuthorizationHealth,
  InstagramCapabilityState,
  InstagramSyncCapabilityClass,
  InstagramSyncCoordinatorStatus,
  InstagramSyncTrigger,
  InstagramProfessionalAccountType,
  OAuthTokenStatus,
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
  SocialNetworkProvider,
  Prisma,
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";

import { PrismaService } from "../../../prisma/prisma.service";
import type { CreatorWorkspaceActorContext } from "../../../shared/creator/creator-workspace-actor.contract";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
export const INSTAGRAM_SYNC_MANUAL_COOLDOWN_MS = 15 * 60_000;
export const INSTAGRAM_SYNC_MAX_JITTER_MS = 30 * 60_000;
export const INSTAGRAM_SYNC_LEASE_MS = 10 * 60_000;

export type InstagramSyncLease = Readonly<{
  jobId: string;
  leaseToken: string;
  leaseOwnerRef: string;
  brandProfileId: string;
  integrationId: string;
  providerAccountId: string;
  authorizationGeneration: number;
  capabilityClass: InstagramSyncCapabilityClass;
  trigger: InstagramSyncTrigger;
  requestIdentity: string;
  attemptNumber: number;
  windowEnd: Date;
}>;

export type CreatorAudienceSyncLease = Readonly<{
  jobId: string;
  leaseToken: string;
  leaseOwnerRef: string;
  actor: CreatorWorkspaceActorContext;
  integrationId: string;
  providerAccountId: string;
  authorizationGeneration: number;
  capabilityClass: typeof InstagramSyncCapabilityClass.AUDIENCE;
  trigger: InstagramSyncTrigger;
  requestIdentity: string;
  attemptNumber: number;
  windowEnd: Date;
}>;

@Injectable()
export class InstagramSyncCoordinatorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async scheduleCreatorAudience(input: {
    creatorProfileId: string;
    creatorWorkspaceId: string;
    integrationId: string;
    providerAccountId: string;
    authorizationGeneration: number;
    trigger: "INITIAL_CONNECT" | "RECONNECT";
  }): Promise<void> {
    const now = new Date();
    const requestIdentity = identity(
      input,
      InstagramSyncCapabilityClass.AUDIENCE,
      now,
    );
    await this.prisma.$transaction(async (tx) => {
      const scopes = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        INSERT INTO intelligence_owner_scopes
          (owner_type, owner_key, creator_profile_id, creator_workspace_id)
        VALUES ('CREATOR', ${`CREATOR:${input.creatorProfileId}:${input.creatorWorkspaceId}`},
          ${input.creatorProfileId}, ${input.creatorWorkspaceId})
        ON CONFLICT (creator_profile_id) WHERE creator_profile_id IS NOT NULL
        DO UPDATE SET updated_at = intelligence_owner_scopes.updated_at
        RETURNING owner_scope_id AS id
      `);
      const scopeId = scopes[0].id;
      await tx.$executeRaw(Prisma.sql`
        UPDATE instagram_intelligence_sync_jobs
        SET status='BLOCKED_AUTHORIZATION', next_due_at=NULL, backoff_until=NULL,
            lease_token=NULL, lease_owner_ref=NULL, lease_expires_at=NULL,
            reason_codes=ARRAY['AUTHORIZATION_GENERATION_SUPERSEDED']
        WHERE owner_scope_id=${scopeId}
          AND creator_integration_id=${input.integrationId}
          AND authorization_generation <> ${input.authorizationGeneration}
          AND status <> 'COMPLETED'
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO instagram_intelligence_sync_jobs
          (sync_job_id, owner_scope_id, brand_id, integration_id,
           creator_integration_id, provider_account_id,
           authorization_generation, capability_class, status, trigger,
           request_identity, next_due_at, updated_at)
        VALUES (${randomUUID()}::uuid, ${scopeId}, NULL, NULL, ${input.integrationId},
          ${input.providerAccountId}, ${input.authorizationGeneration},
          'AUDIENCE', 'DUE', ${input.trigger}::"InstagramSyncTrigger",
          ${requestIdentity}, ${now}, CURRENT_TIMESTAMP)
        ON CONFLICT (owner_scope_id, creator_integration_id, provider_account_id,
          authorization_generation, capability_class)
          WHERE creator_integration_id IS NOT NULL
        DO UPDATE SET status='DUE', trigger=EXCLUDED.trigger,
          request_identity=EXCLUDED.request_identity, next_due_at=EXCLUDED.next_due_at,
          backoff_until=NULL, reason_codes=ARRAY[]::text[], updated_at=CURRENT_TIMESTAMP
      `);
    });
  }

  async scheduleConnection(input: {
    brandProfileId: string;
    integrationId: string;
    providerAccountId: string;
    authorizationGeneration: number;
    profileCapability: InstagramCapabilityState;
    insightsCapability: InstagramCapabilityState;
    trigger: "INITIAL_CONNECT" | "RECONNECT";
  }): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.instagramIntelligenceSyncJob.updateMany({
        where: {
          integrationId: input.integrationId,
          authorizationGeneration: { not: input.authorizationGeneration },
          status: { not: InstagramSyncCoordinatorStatus.COMPLETED },
        },
        data: {
          status: InstagramSyncCoordinatorStatus.BLOCKED_AUTHORIZATION,
          nextDueAt: null,
          backoffUntil: null,
          leaseToken: null,
          leaseOwnerRef: null,
          leaseExpiresAt: null,
          reasonCodes: ["AUTHORIZATION_GENERATION_SUPERSEDED"],
        },
      });
      const classes: Array<{
        capabilityClass: InstagramSyncCapabilityClass;
        due: Date;
      }> = [];
      if (input.profileCapability === InstagramCapabilityState.YES) {
        classes.push(
          {
            capabilityClass: InstagramSyncCapabilityClass.INITIAL_30_DAY,
            due: now,
          },
          {
            capabilityClass:
              InstagramSyncCapabilityClass.PROFILE_MEDIA_PERFORMANCE,
            due: new Date(now.getTime() + DAY_MS + jitter(input, "daily")),
          },
        );
      }
      if (input.insightsCapability === InstagramCapabilityState.YES) {
        classes.push({
          capabilityClass: InstagramSyncCapabilityClass.AUDIENCE,
          due: new Date(now.getTime() + WEEK_MS + jitter(input, "weekly")),
        });
      }
      for (const item of classes) {
        const requestIdentity = identity(input, item.capabilityClass, item.due);
        await tx.instagramIntelligenceSyncJob.upsert({
          where: {
            brandProfileId_integrationId_providerAccountId_authorizationGeneration_capabilityClass:
              {
                brandProfileId: input.brandProfileId,
                integrationId: input.integrationId,
                providerAccountId: input.providerAccountId,
                authorizationGeneration: input.authorizationGeneration,
                capabilityClass: item.capabilityClass,
              },
          },
          create: {
            brandProfileId: input.brandProfileId,
            integrationId: input.integrationId,
            providerAccountId: input.providerAccountId,
            authorizationGeneration: input.authorizationGeneration,
            capabilityClass: item.capabilityClass,
            trigger:
              input.trigger === "INITIAL_CONNECT"
                ? InstagramSyncTrigger.INITIAL_CONNECT
                : InstagramSyncTrigger.RECONNECT,
            requestIdentity,
            nextDueAt: item.due,
          },
          update: {},
        });
      }
    });
  }

  async requestManualRefresh(brandProfileId: string) {
    return this.prisma.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "sync_job_id" AS "id"
        FROM "instagram_intelligence_sync_jobs"
        WHERE "brand_id" = ${brandProfileId}
          AND "capability_class" = 'PROFILE_MEDIA_PERFORMANCE'::"InstagramSyncCapabilityClass"
        ORDER BY "authorization_generation" DESC
        FOR UPDATE
        LIMIT 1
      `);
      const job = rows[0]
        ? await tx.instagramIntelligenceSyncJob.findUnique({
            where: { id: rows[0].id },
          })
        : null;
      if (!job) throw new ConflictException("Instagram sync is not configured");
      if (!job.integrationId) {
        throw new ConflictException(
          "Instagram Brand integration is unavailable",
        );
      }
      const integrationId = job.integrationId;
      if (
        job.lastManualRequestedAt &&
        now.getTime() - job.lastManualRequestedAt.getTime() <
          INSTAGRAM_SYNC_MANUAL_COOLDOWN_MS
      ) {
        throw new HttpException(
          {
            code: "INSTAGRAM_REFRESH_COOLDOWN",
            retryAfterSeconds: Math.ceil(
              (INSTAGRAM_SYNC_MANUAL_COOLDOWN_MS -
                (now.getTime() - job.lastManualRequestedAt.getTime())) /
                1000,
            ),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      const integration = await tx.brandIntegration.findUnique({
        where: { id: integrationId },
      });
      if (!usable(integration, job)) {
        throw new ConflictException("Instagram authorization is unavailable");
      }
      const requestIdentity = identity(
        { integrationId, authorizationGeneration: job.authorizationGeneration },
        job.capabilityClass,
        now,
      );
      await tx.instagramIntelligenceSyncJob.updateMany({
        where: { id: job.id },
        data: {
          trigger: InstagramSyncTrigger.MANUAL,
          status:
            job.status === InstagramSyncCoordinatorStatus.RUNNING
              ? InstagramSyncCoordinatorStatus.RUNNING
              : InstagramSyncCoordinatorStatus.DUE,
          requestIdentity,
          nextDueAt:
            job.status === InstagramSyncCoordinatorStatus.RUNNING
              ? job.nextDueAt
              : now,
          backoffUntil:
            job.status === InstagramSyncCoordinatorStatus.RUNNING
              ? job.backoffUntil
              : null,
          lastManualRequestedAt: now,
          manualPending: job.status === InstagramSyncCoordinatorStatus.RUNNING,
          reasonCodes: [],
        },
      });
      return { accepted: true, requestIdentity, cooldownSeconds: 900 };
    });
  }

  async claimNext(workerIdentity: string): Promise<InstagramSyncLease | null> {
    return this.prisma.$transaction(
      async (tx) => {
        const now = await databaseNow(tx);
        const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "sync_job_id" AS "id"
        FROM "instagram_intelligence_sync_jobs"
        WHERE (
          ("status" IN ('PENDING','DUE') AND "next_due_at" <= ${now})
          OR ("status" = 'BACKOFF' AND "backoff_until" <= ${now})
          OR ("status" = 'RUNNING' AND "lease_expires_at" <= ${now})
        )
          AND "brand_id" IS NOT NULL
          AND "integration_id" IS NOT NULL
        ORDER BY COALESCE("backoff_until", "next_due_at", "lease_expires_at"), "sync_job_id"
        FOR UPDATE SKIP LOCKED LIMIT 1
      `);
        if (!rows[0]) return null;
        const job = await tx.instagramIntelligenceSyncJob.findUniqueOrThrow({
          where: { id: rows[0].id },
        });
        if (!job.integrationId) return null;
        const integration = await tx.brandIntegration.findUnique({
          where: { id: job.integrationId },
        });
        if (!usable(integration, job)) {
          await tx.instagramIntelligenceSyncJob.update({
            where: { id: job.id },
            data: {
              status: InstagramSyncCoordinatorStatus.BLOCKED_AUTHORIZATION,
              nextDueAt: null,
              backoffUntil: null,
              leaseToken: null,
              leaseOwnerRef: null,
              leaseExpiresAt: null,
              reasonCodes: ["AUTHORIZATION_FENCE_REJECTED"],
            },
          });
          return null;
        }
        const leaseToken = randomUUID();
        const resumeExistingWindow =
          job.status === InstagramSyncCoordinatorStatus.BACKOFF ||
          job.status === InstagramSyncCoordinatorStatus.RUNNING;
        const windowEnd =
          resumeExistingWindow && job.executionWindowEnd
            ? job.executionWindowEnd
            : now;
        const attemptNumber = job.attemptCount + 1;
        await tx.instagramIntelligenceSyncJob.updateMany({
          where: { id: job.id },
          data: {
            status: InstagramSyncCoordinatorStatus.RUNNING,
            leaseToken,
            leaseOwnerRef: workerIdentity,
            leaseExpiresAt: new Date(now.getTime() + INSTAGRAM_SYNC_LEASE_MS),
            lastHeartbeatAt: now,
            lastAttemptAt: now,
            attemptCount: { increment: 1 },
            executionWindowStart: new Date(windowEnd.getTime() - 30 * DAY_MS),
            executionWindowEnd: windowEnd,
          },
        });
        return {
          jobId: job.id,
          leaseToken,
          leaseOwnerRef: workerIdentity,
          brandProfileId: job.brandProfileId,
          integrationId: job.integrationId,
          providerAccountId: job.providerAccountId,
          authorizationGeneration: job.authorizationGeneration,
          capabilityClass: job.capabilityClass,
          trigger: job.trigger,
          requestIdentity: job.requestIdentity,
          attemptNumber,
          windowEnd,
        };
      },
      { maxWait: 10_000, timeout: 15_000 },
    );
  }

  async claimNextCreator(
    workerIdentity: string,
  ): Promise<CreatorAudienceSyncLease | null> {
    return this.prisma.$transaction(
      async (tx) => {
        const now = await databaseNow(tx);
        const rows = await tx.$queryRaw<
          Array<{
            id: string;
            scopeId: string;
            integrationId: string;
            creatorProfileId: string;
            workspaceId: string;
            organizationId: string;
            ownerUserId: string;
            providerAccountId: string;
            authorizationGeneration: number;
            status: InstagramSyncCoordinatorStatus;
            trigger: InstagramSyncTrigger;
            requestIdentity: string;
            attemptCount: number;
            executionWindowEnd: Date | null;
          }>
        >(Prisma.sql`
        SELECT job.sync_job_id AS id, job.owner_scope_id AS "scopeId",
          job.creator_integration_id AS "integrationId",
          scope.creator_profile_id AS "creatorProfileId",
          scope.creator_workspace_id AS "workspaceId",
          workspace.organization_id AS "organizationId",
          profile.user_id AS "ownerUserId",
          job.provider_account_id AS "providerAccountId",
          job.authorization_generation AS "authorizationGeneration",
          job.status, job.trigger, job.request_identity AS "requestIdentity",
          job.attempt_count AS "attemptCount",
          job.execution_window_end AS "executionWindowEnd"
        FROM instagram_intelligence_sync_jobs job
        JOIN intelligence_owner_scopes scope ON scope.owner_scope_id=job.owner_scope_id
        JOIN creator_workspaces workspace ON workspace.id=scope.creator_workspace_id
        JOIN creator_profiles profile ON profile.id=scope.creator_profile_id
        WHERE ((job.status IN ('PENDING','DUE') AND job.next_due_at <= ${now})
          OR (job.status='BACKOFF' AND job.backoff_until <= ${now})
          OR (job.status='RUNNING' AND job.lease_expires_at <= ${now}))
          AND job.brand_id IS NULL AND job.creator_integration_id IS NOT NULL
          AND job.capability_class='AUDIENCE'
        ORDER BY COALESCE(job.backoff_until, job.next_due_at, job.lease_expires_at), job.sync_job_id
        FOR UPDATE OF job SKIP LOCKED LIMIT 1
      `);
        if (!rows[0]) return null;
        const row = rows[0];
        const integration = await tx.creatorSocialIntegration.findUnique({
          where: { id: row.integrationId },
        });
        if (
          !creatorUsable(integration, {
            creatorIntegrationId: row.integrationId,
            providerAccountId: row.providerAccountId,
            authorizationGeneration: row.authorizationGeneration,
            capabilityClass: InstagramSyncCapabilityClass.AUDIENCE,
          })
        ) {
          await tx.$executeRaw(Prisma.sql`
          UPDATE instagram_intelligence_sync_jobs
          SET status='BLOCKED_AUTHORIZATION', next_due_at=NULL,
            backoff_until=NULL, lease_token=NULL, lease_owner_ref=NULL,
            lease_expires_at=NULL,
            reason_codes=ARRAY['AUTHORIZATION_FENCE_REJECTED']
          WHERE sync_job_id=${row.id}::uuid
        `);
          return null;
        }
        const leaseToken = randomUUID();
        const windowEnd =
          (row.status === InstagramSyncCoordinatorStatus.BACKOFF ||
            row.status === InstagramSyncCoordinatorStatus.RUNNING) &&
          row.executionWindowEnd
            ? row.executionWindowEnd
            : now;
        await tx.$executeRaw(Prisma.sql`
        UPDATE instagram_intelligence_sync_jobs
        SET status='RUNNING', lease_token=${leaseToken}::uuid,
          lease_owner_ref=${workerIdentity},
          lease_expires_at=${new Date(now.getTime() + INSTAGRAM_SYNC_LEASE_MS)},
          last_heartbeat_at=${now}, last_attempt_at=${now},
          attempt_count=attempt_count+1, execution_window_start=NULL,
          execution_window_end=${windowEnd}, updated_at=CURRENT_TIMESTAMP
        WHERE sync_job_id=${row.id}::uuid
      `);
        return {
          jobId: row.id,
          leaseToken,
          leaseOwnerRef: workerIdentity,
          actor: {
            actorUserId: row.ownerUserId,
            actorMembershipId: `system:${row.scopeId}`,
            actorRole: "OWNER",
            workspaceId: row.workspaceId,
            organizationId: row.organizationId,
            subjectCreatorProfileId: row.creatorProfileId,
            subjectOwnerUserId: row.ownerUserId,
            allowedActions: ["INSIGHTS_AUDIENCE_READ"],
          },
          integrationId: row.integrationId,
          providerAccountId: row.providerAccountId,
          authorizationGeneration: row.authorizationGeneration,
          capabilityClass: InstagramSyncCapabilityClass.AUDIENCE,
          trigger: row.trigger,
          requestIdentity: row.requestIdentity,
          attemptNumber: row.attemptCount + 1,
          windowEnd,
        };
      },
      { maxWait: 10_000, timeout: 15_000 },
    );
  }

  async heartbeat(
    lease: InstagramSyncLease | CreatorAudienceSyncLease,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      const refreshed = await tx.instagramIntelligenceSyncJob.updateMany({
        where: {
          id: lease.jobId,
          status: InstagramSyncCoordinatorStatus.RUNNING,
          leaseToken: lease.leaseToken,
          leaseOwnerRef: lease.leaseOwnerRef,
          leaseExpiresAt: { gt: now },
        },
        data: {
          lastHeartbeatAt: now,
          leaseExpiresAt: new Date(now.getTime() + INSTAGRAM_SYNC_LEASE_MS),
        },
      });
      if (refreshed.count !== 1) throw new Error("INSTAGRAM_SYNC_LEASE_LOST");
    });
  }

  async complete(
    lease: InstagramSyncLease | CreatorAudienceSyncLease,
    generationIds: string[],
  ) {
    return this.finishWithLease(lease, async (tx, now) => {
      const current = await tx.instagramIntelligenceSyncJob.findUniqueOrThrow({
        where: { id: lease.jobId },
        select: { manualPending: true, requestIdentity: true },
      });
      const recurring =
        lease.capabilityClass !== InstagramSyncCapabilityClass.INITIAL_30_DAY;
      const interval =
        lease.capabilityClass === InstagramSyncCapabilityClass.AUDIENCE
          ? WEEK_MS
          : DAY_MS;
      const nextDueAt = current.manualPending
        ? now
        : recurring
          ? new Date(now.getTime() + interval + jitter(lease, "recurring"))
          : null;
      await tx.instagramIntelligenceSyncJob.updateMany({
        where: { id: lease.jobId },
        data: {
          status: current.manualPending
            ? InstagramSyncCoordinatorStatus.DUE
            : recurring
              ? InstagramSyncCoordinatorStatus.PENDING
              : InstagramSyncCoordinatorStatus.COMPLETED,
          lastSuccessAt: now,
          nextDueAt,
          requestIdentity:
            current.manualPending || !nextDueAt
              ? current.requestIdentity
              : identity(lease, lease.capabilityClass, nextDueAt),
          backoffUntil: null,
          leaseToken: null,
          leaseOwnerRef: null,
          leaseExpiresAt: null,
          lastHeartbeatAt: null,
          consecutiveFailureCount: 0,
          manualPending: false,
          lastCompletedGenerationIds: [...new Set(generationIds)].sort(),
          reasonCodes: [],
          trigger: current.manualPending
            ? InstagramSyncTrigger.MANUAL
            : recurring
              ? InstagramSyncTrigger.SCHEDULED
              : lease.trigger,
        },
      });
    });
  }

  async fail(
    lease: InstagramSyncLease | CreatorAudienceSyncLease,
    classification: "AUTHORIZATION" | "TRANSIENT" | "TERMINAL",
    reasonCode: string,
  ) {
    return this.finishWithLease(lease, async (tx, now, failureCount) => {
      const blocked = classification === "AUTHORIZATION";
      const retryAt = new Date(
        now.getTime() +
          Math.min(60 * 60_000, 1000 * 2 ** Math.min(failureCount, 10)),
      );
      await tx.instagramIntelligenceSyncJob.updateMany({
        where: { id: lease.jobId },
        data: {
          status: blocked
            ? InstagramSyncCoordinatorStatus.BLOCKED_AUTHORIZATION
            : InstagramSyncCoordinatorStatus.BACKOFF,
          nextDueAt: null,
          backoffUntil: blocked ? null : retryAt,
          leaseToken: null,
          leaseOwnerRef: null,
          leaseExpiresAt: null,
          lastHeartbeatAt: null,
          consecutiveFailureCount: failureCount,
          reasonCodes: [reasonCode],
        },
      });
    });
  }

  private async finishWithLease(
    lease: InstagramSyncLease | CreatorAudienceSyncLease,
    action: (
      tx: Prisma.TransactionClient,
      now: Date,
      failureCount: number,
    ) => Promise<void>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      const rows = await tx.$queryRaw<
        Array<{ failureCount: number }>
      >(Prisma.sql`
        SELECT "consecutive_failure_count" AS "failureCount"
        FROM "instagram_intelligence_sync_jobs"
        WHERE "sync_job_id" = ${lease.jobId}::uuid
          AND "status" = 'RUNNING'::"InstagramSyncCoordinatorStatus"
          AND "lease_token" = ${lease.leaseToken}::uuid
          AND "lease_owner_ref" = ${lease.leaseOwnerRef}
          AND "lease_expires_at" > ${now}
        FOR UPDATE
      `);
      if (!rows[0]) throw new Error("INSTAGRAM_SYNC_LEASE_LOST");
      await action(tx, now, rows[0].failureCount + 1);
    });
  }
}

async function databaseNow(tx: Prisma.TransactionClient): Promise<Date> {
  const rows = await tx.$queryRaw<Array<{ now: Date }>>`
    SELECT CURRENT_TIMESTAMP AS "now"
  `;
  return rows[0].now;
}

function usable(
  integration: Awaited<
    ReturnType<PrismaService["brandIntegration"]["findUnique"]>
  >,
  job: {
    brandProfileId: string;
    providerAccountId: string;
    authorizationGeneration: number;
    capabilityClass: InstagramSyncCapabilityClass;
  },
): boolean {
  if (
    !integration ||
    !integration.isActive ||
    integration.provider !== BrandIntegrationProvider.INSTAGRAM ||
    (integration.status !== BrandIntegrationStatus.CONNECTED &&
      integration.status !== BrandIntegrationStatus.PARTIALLY_CONNECTED) ||
    integration.brandProfileId !== job.brandProfileId ||
    integration.providerAccountId !== job.providerAccountId ||
    integration.authorizationGeneration !== job.authorizationGeneration ||
    (integration.authorizationHealth !==
      InstagramAuthorizationHealth.CONNECTED_FULL &&
      integration.authorizationHealth !==
        InstagramAuthorizationHealth.PARTIALLY_CONNECTED)
  )
    return false;
  return job.capabilityClass === InstagramSyncCapabilityClass.AUDIENCE
    ? integration.firstPartyInsightsCapability === InstagramCapabilityState.YES
    : integration.firstPartyProfileCapability === InstagramCapabilityState.YES;
}

function creatorUsable(
  integration: Awaited<
    ReturnType<PrismaService["creatorSocialIntegration"]["findUnique"]>
  >,
  job: {
    creatorIntegrationId: string | null;
    providerAccountId: string;
    authorizationGeneration: number;
    capabilityClass: InstagramSyncCapabilityClass;
  },
): boolean {
  return Boolean(
    integration &&
    job.capabilityClass === InstagramSyncCapabilityClass.AUDIENCE &&
    job.creatorIntegrationId === integration.id &&
    integration.platformNetwork === SocialNetworkProvider.INSTAGRAM &&
    integration.nativePlatformUserId === job.providerAccountId &&
    integration.authorizationGeneration === job.authorizationGeneration &&
    integration.disconnectedAt === null &&
    integration.tokenStateCondition === OAuthTokenStatus.ACTIVE &&
    (!integration.tokenExpiresAt || integration.tokenExpiresAt > new Date()) &&
    integration.authorizationHealth === ProviderAuthorizationHealth.USABLE &&
    integration.basicAuthorizationCapability ===
      ProviderCapabilityState.AVAILABLE &&
    integration.insightsCapability === ProviderCapabilityState.AVAILABLE &&
    (integration.professionalAccountType ===
      InstagramProfessionalAccountType.BUSINESS ||
      integration.professionalAccountType ===
        InstagramProfessionalAccountType.CREATOR),
  );
}

function identity(
  input: { integrationId: string; authorizationGeneration: number },
  capabilityClass: InstagramSyncCapabilityClass,
  due: Date,
): string {
  return `instagram-sync:${createHash("sha256")
    .update(
      `${input.integrationId}:${input.authorizationGeneration}:${capabilityClass}:${due.toISOString()}`,
    )
    .digest("hex")}`;
}

function jitter(
  input: { integrationId: string; authorizationGeneration: number },
  salt: string,
): number {
  const digest = createHash("sha256")
    .update(`${input.integrationId}:${input.authorizationGeneration}:${salt}`)
    .digest();
  return digest.readUInt32BE(0) % (INSTAGRAM_SYNC_MAX_JITTER_MS + 1);
}
