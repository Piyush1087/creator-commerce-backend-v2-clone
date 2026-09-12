import {
  BrandIntegrationProvider,
  BrandIntegrationStatus,
  InstagramAuthorizationHealth,
  InstagramCapabilityState,
  InstagramIdentityVerification,
  InstagramSyncCapabilityClass,
  InstagramSyncCoordinatorStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { InstagramDerivedDataPurgeService } from "../../data-extraction/evidence/instagram/instagram-derived-data-purge.service";
import {
  INSTAGRAM_SYNC_MANUAL_COOLDOWN_MS,
  INSTAGRAM_SYNC_MAX_JITTER_MS,
  InstagramSyncCoordinatorRepository,
} from "./instagram-sync-coordinator.repository";

const databaseUrl = process.env.C1_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const postgres = databaseUrl ? describe : describe.skip;

postgres("C1 Instagram sync coordinator PostgreSQL", () => {
  let prisma: PrismaService;
  let coordinator: InstagramSyncCoordinatorRepository;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    coordinator = new InstagramSyncCoordinatorRepository(prisma);
  });

  afterAll(async () => prisma.$disconnect());
  afterEach(async () => {
    await prisma.brandProfile.deleteMany({
      where: { domain: { startsWith: "c1-" } },
    });
  });

  it("schedules immediate initial plus deterministic daily/weekly work exactly once", async () => {
    const fixture = await createFixture(prisma, "cadence");
    const before = Date.now();
    await schedule(coordinator, fixture, 1, "INITIAL_CONNECT");
    await schedule(coordinator, fixture, 1, "INITIAL_CONNECT");
    const jobs = await prisma.instagramIntelligenceSyncJob.findMany({
      where: { brandProfileId: fixture.brand.id },
      orderBy: { capabilityClass: "asc" },
    });
    expect(jobs).toHaveLength(3);
    const initial = jobs.find(
      (job) =>
        job.capabilityClass === InstagramSyncCapabilityClass.INITIAL_30_DAY,
    )!;
    const daily = jobs.find(
      (job) =>
        job.capabilityClass ===
        InstagramSyncCapabilityClass.PROFILE_MEDIA_PERFORMANCE,
    )!;
    const weekly = jobs.find(
      (job) => job.capabilityClass === InstagramSyncCapabilityClass.AUDIENCE,
    )!;
    expect(initial.nextDueAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(daily.nextDueAt!.getTime() - before).toBeGreaterThanOrEqual(
      86_400_000,
    );
    expect(daily.nextDueAt!.getTime() - before).toBeLessThanOrEqual(
      86_400_000 + INSTAGRAM_SYNC_MAX_JITTER_MS + 2_000,
    );
    expect(weekly.nextDueAt!.getTime() - before).toBeGreaterThanOrEqual(
      7 * 86_400_000,
    );
  });

  it("claims once under concurrency, fences stale completion, and reclaims an expired lease", async () => {
    const fixture = await createFixture(prisma, "lease");
    await schedule(coordinator, fixture, 1, "INITIAL_CONNECT");
    const claims = await Promise.all([
      coordinator.claimNext("worker-a"),
      coordinator.claimNext("worker-b"),
    ]);
    const lease = claims.find(Boolean)!;
    expect(claims.filter(Boolean)).toHaveLength(1);
    const shortExpiry = new Date(Date.now() + 30_000);
    await prisma.instagramIntelligenceSyncJob.update({
      where: { id: lease.jobId },
      data: { leaseExpiresAt: shortExpiry },
    });
    await coordinator.heartbeat(lease);
    const heartbeated =
      await prisma.instagramIntelligenceSyncJob.findUniqueOrThrow({
        where: { id: lease.jobId },
      });
    expect(heartbeated.lastHeartbeatAt).not.toBeNull();
    expect(heartbeated.leaseExpiresAt!.getTime()).toBeGreaterThan(
      shortExpiry.getTime(),
    );
    await prisma.instagramIntelligenceSyncJob.update({
      where: { id: lease.jobId },
      data: { leaseExpiresAt: new Date(Date.now() - 1_000) },
    });
    await expect(coordinator.complete(lease, [randomUUID()])).rejects.toThrow(
      "INSTAGRAM_SYNC_LEASE_LOST",
    );
    const reclaimed = await coordinator.claimNext("worker-c");
    expect(reclaimed?.jobId).toBe(lease.jobId);
    await coordinator.complete(reclaimed!, ["generation-1", "generation-1"]);
    const completed =
      await prisma.instagramIntelligenceSyncJob.findUniqueOrThrow({
        where: { id: lease.jobId },
      });
    expect(completed.status).toBe(InstagramSyncCoordinatorStatus.COMPLETED);
    expect(completed.lastCompletedGenerationIds).toEqual(["generation-1"]);
  });

  it("enforces the atomic manual cooldown and never crosses Brand tenants", async () => {
    const first = await createFixture(prisma, "manual-a");
    const second = await createFixture(prisma, "manual-b");
    await schedule(coordinator, first, 1, "INITIAL_CONNECT");
    await schedule(coordinator, second, 1, "INITIAL_CONNECT");
    const attempts = await Promise.allSettled([
      coordinator.requestManualRefresh(first.brand.id),
      coordinator.requestManualRefresh(first.brand.id),
    ]);
    expect(
      attempts.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      attempts.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    const secondJob =
      await prisma.instagramIntelligenceSyncJob.findFirstOrThrow({
        where: {
          brandProfileId: second.brand.id,
          capabilityClass:
            InstagramSyncCapabilityClass.PROFILE_MEDIA_PERFORMANCE,
        },
      });
    expect(secondJob.lastManualRequestedAt).toBeNull();
    const firstJob = await prisma.instagramIntelligenceSyncJob.findFirstOrThrow(
      {
        where: {
          brandProfileId: first.brand.id,
          capabilityClass:
            InstagramSyncCapabilityClass.PROFILE_MEDIA_PERFORMANCE,
        },
      },
    );
    expect(Date.now() - firstJob.lastManualRequestedAt!.getTime()).toBeLessThan(
      INSTAGRAM_SYNC_MANUAL_COOLDOWN_MS,
    );
  });

  it("queues a manual request behind a live lease without replacing its fence", async () => {
    const fixture = await createFixture(prisma, "manual-running");
    await schedule(coordinator, fixture, 1, "INITIAL_CONNECT");
    const initial = await coordinator.claimNext("worker-initial");
    await coordinator.complete(initial!, ["initial-generation"]);
    const daily = await prisma.instagramIntelligenceSyncJob.findFirstOrThrow({
      where: {
        brandProfileId: fixture.brand.id,
        capabilityClass: InstagramSyncCapabilityClass.PROFILE_MEDIA_PERFORMANCE,
      },
    });
    await prisma.instagramIntelligenceSyncJob.update({
      where: { id: daily.id },
      data: { nextDueAt: new Date(Date.now() - 1_000) },
    });
    const lease = await coordinator.claimNext("worker-live");
    await coordinator.requestManualRefresh(fixture.brand.id);
    const queued = await prisma.instagramIntelligenceSyncJob.findUniqueOrThrow({
      where: { id: daily.id },
    });
    expect(queued.status).toBe("RUNNING");
    expect(queued.leaseToken).toBe(lease!.leaseToken);
    expect(queued.manualPending).toBe(true);
    await coordinator.complete(lease!, ["scheduled-generation"]);
    const due = await prisma.instagramIntelligenceSyncJob.findUniqueOrThrow({
      where: { id: daily.id },
    });
    expect(due.status).toBe("DUE");
    expect(due.trigger).toBe("MANUAL");
    expect(due.manualPending).toBe(false);
  });

  it("blocks the superseded generation, schedules reconnect work, and rejects stale authorization", async () => {
    const fixture = await createFixture(prisma, "reconnect");
    await schedule(coordinator, fixture, 1, "INITIAL_CONNECT");
    await prisma.brandIntegration.update({
      where: { id: fixture.integration.id },
      data: { authorizationGeneration: 2 },
    });
    await schedule(coordinator, fixture, 2, "RECONNECT");
    const old = await prisma.instagramIntelligenceSyncJob.findMany({
      where: {
        integrationId: fixture.integration.id,
        authorizationGeneration: 1,
      },
    });
    expect(old.every((job) => job.status === "BLOCKED_AUTHORIZATION")).toBe(
      true,
    );
    const fresh = await prisma.instagramIntelligenceSyncJob.findMany({
      where: {
        integrationId: fixture.integration.id,
        authorizationGeneration: 2,
      },
    });
    expect(fresh).toHaveLength(3);
    await prisma.brandIntegration.update({
      where: { id: fixture.integration.id },
      data: { authorizationHealth: "NEEDS_REVALIDATION" },
    });
    expect(await coordinator.claimNext("worker-fenced")).toBeNull();
    expect(
      await prisma.instagramIntelligenceSyncJob.count({
        where: {
          integrationId: fixture.integration.id,
          authorizationGeneration: 2,
          status: "BLOCKED_AUTHORIZATION",
        },
      }),
    ).toBeGreaterThan(0);
  });

  it("uses bounded retry backoff and Settings deletion removes only the target coordinator", async () => {
    const target = await createFixture(prisma, "delete-a");
    const other = await createFixture(prisma, "delete-b");
    await schedule(coordinator, target, 1, "INITIAL_CONNECT");
    await schedule(coordinator, other, 1, "INITIAL_CONNECT");
    const lease = await coordinator.claimNext("worker-retry");
    expect(lease?.brandProfileId).toBe(target.brand.id);
    await coordinator.fail(lease!, "TRANSIENT", "SYNTHETIC_TRANSIENT");
    const failed = await prisma.instagramIntelligenceSyncJob.findUniqueOrThrow({
      where: { id: lease!.jobId },
    });
    expect(failed.status).toBe("BACKOFF");
    expect(
      failed.backoffUntil!.getTime() - failed.updatedAt.getTime(),
    ).toBeLessThanOrEqual(4_000);
    await prisma.instagramIntelligenceSyncJob.update({
      where: { id: lease!.jobId },
      data: { backoffUntil: new Date(Date.now() - 1_000) },
    });
    const retry = await coordinator.claimNext("worker-retry-2");
    expect(retry?.requestIdentity).toBe(lease!.requestIdentity);
    expect(retry?.windowEnd.toISOString()).toBe(lease!.windowEnd.toISOString());
    await coordinator.fail(retry!, "TRANSIENT", "SYNTHETIC_TRANSIENT");
    const purge = new InstagramDerivedDataPurgeService({
      purgeScope: async () => 0,
    } as never);
    await prisma.$transaction((tx) =>
      purge.purgePersistentInTransaction(tx, target.brand.id),
    );
    expect(
      await prisma.instagramIntelligenceSyncJob.count({
        where: { brandProfileId: target.brand.id },
      }),
    ).toBe(0);
    expect(
      await prisma.instagramIntelligenceSyncJob.count({
        where: { brandProfileId: other.brand.id },
      }),
    ).toBe(3);
  });
});

async function createFixture(prisma: PrismaService, label: string) {
  const brand = await prisma.brandProfile.create({
    data: {
      domain: `c1-${label}-${randomUUID()}.example.test`,
      name: `C1 ${label}`,
      industry: "D2C",
      brandValues: [],
      policyFlags: [],
    },
  });
  const integration = await prisma.brandIntegration.create({
    data: {
      brandProfileId: brand.id,
      provider: BrandIntegrationProvider.INSTAGRAM,
      status: BrandIntegrationStatus.CONNECTED,
      isActive: true,
      providerAccountId: `account-${randomUUID()}`,
      identityVerification: InstagramIdentityVerification.VERIFIED,
      authorizationHealth: InstagramAuthorizationHealth.CONNECTED_FULL,
      firstPartyProfileCapability: InstagramCapabilityState.YES,
      firstPartyInsightsCapability: InstagramCapabilityState.YES,
      authorizationGeneration: 1,
    },
  });
  return { brand, integration };
}

function schedule(
  coordinator: InstagramSyncCoordinatorRepository,
  fixture: Awaited<ReturnType<typeof createFixture>>,
  generation: number,
  trigger: "INITIAL_CONNECT" | "RECONNECT",
) {
  return coordinator.scheduleConnection({
    brandProfileId: fixture.brand.id,
    integrationId: fixture.integration.id,
    providerAccountId: fixture.integration.providerAccountId!,
    authorizationGeneration: generation,
    profileCapability: InstagramCapabilityState.YES,
    insightsCapability: InstagramCapabilityState.YES,
    trigger,
  });
}
