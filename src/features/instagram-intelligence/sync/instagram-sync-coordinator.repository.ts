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
  Prisma,
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";

import { PrismaService } from "../../../prisma/prisma.service";

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

@Injectable()
export class InstagramSyncCoordinatorRepository {
  constructor(private readonly prisma: PrismaService) {}

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
        where: { id: job.integrationId },
      });
      if (!usable(integration, job)) {
        throw new ConflictException("Instagram authorization is unavailable");
      }
      const requestIdentity = identity(job, job.capabilityClass, now);
      await tx.instagramIntelligenceSyncJob.update({
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
    return this.prisma.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "sync_job_id" AS "id"
        FROM "instagram_intelligence_sync_jobs"
        WHERE (
          ("status" IN ('PENDING','DUE') AND "next_due_at" <= ${now})
          OR ("status" = 'BACKOFF' AND "backoff_until" <= ${now})
          OR ("status" = 'RUNNING' AND "lease_expires_at" <= ${now})
        )
        ORDER BY COALESCE("backoff_until", "next_due_at", "lease_expires_at"), "sync_job_id"
        FOR UPDATE SKIP LOCKED LIMIT 1
      `);
      if (!rows[0]) return null;
      const job = await tx.instagramIntelligenceSyncJob.findUniqueOrThrow({
        where: { id: rows[0].id },
      });
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
      await tx.instagramIntelligenceSyncJob.update({
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
    });
  }

  async heartbeat(lease: InstagramSyncLease): Promise<void> {
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

  async complete(lease: InstagramSyncLease, generationIds: string[]) {
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
      await tx.instagramIntelligenceSyncJob.update({
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
    lease: InstagramSyncLease,
    classification: "AUTHORIZATION" | "TRANSIENT" | "TERMINAL",
    reasonCode: string,
  ) {
    return this.finishWithLease(lease, async (tx, now, failureCount) => {
      const blocked = classification === "AUTHORIZATION";
      const retryAt = new Date(
        now.getTime() +
          Math.min(60 * 60_000, 1000 * 2 ** Math.min(failureCount, 10)),
      );
      await tx.instagramIntelligenceSyncJob.update({
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
    lease: InstagramSyncLease,
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
