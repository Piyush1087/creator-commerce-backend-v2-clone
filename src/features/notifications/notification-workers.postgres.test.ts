import {
  NotificationEmailDeliveryStatus,
  NotificationJobStatus,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NotificationEmailWorkerService } from "./services/notification-email-worker.service";
import { NotificationWorkerService } from "./services/notification-worker.service";

const suite =
  process.env.RUN_NOTIFICATION_POSTGRES_TESTS === "true"
    ? describe
    : describe.skip;

suite("BS-05 P1C1 fenced worker recovery", () => {
  const db = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brandId = `bs05-worker-brand-${suffix}`;
  const userId = `bs05-worker-user-${suffix}`;
  const old = new Date(Date.now() - 10 * 60_000);

  beforeAll(async () => {
    await db.notificationJob.deleteMany();
    await db.notification.deleteMany();
    await db.brandProfile.create({
      data: {
        id: brandId,
        domain: `${brandId}.example`,
        name: "Worker",
        industry: "UNKNOWN",
        brandValues: [],
        policyFlags: [],
      },
    });
    await db.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        role: UserRole.BRAND,
      },
    });
  });

  afterAll(async () => {
    await db.notificationJob.deleteMany({ where: { workspaceId: brandId } });
    await db.brandProfile.delete({ where: { id: brandId } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  async function delivery(
    status: NotificationEmailDeliveryStatus,
    providerStarted = false,
  ) {
    const notification = await db.notification.create({
      data: {
        workspaceId: brandId,
        eventType: "billing.invoice_ready",
        urgencyLevel: "INFORMATIONAL",
        semanticEventKey: randomUUID(),
        category: "BILLING_SUBSCRIPTION",
        actionable: false,
        emailPolicy: "OPTIONAL",
        inAppPolicy: "YES",
        payload: {},
      },
    });
    return db.notificationEmailDelivery.create({
      data: {
        notificationId: notification.id,
        userId,
        targetEmail: `${userId}@example.com`,
        status,
        attempts: status === "PROCESSING" ? 1 : 0,
        lockedAt: status === "PROCESSING" ? old : null,
        lockedBy: status === "PROCESSING" ? "dead-worker" : null,
        claimToken: status === "PROCESSING" ? randomUUID() : null,
        providerSendStartedAt: providerStarted ? old : null,
      },
    });
  }

  const channels = (send: ReturnType<typeof vi.fn>) => ({
    assertEmailConfigured: vi.fn(),
    deliverEmail: send,
  });

  it("safely retries a pre-provider crash and retains known acceptance", async () => {
    const row = await delivery(
      NotificationEmailDeliveryStatus.PROCESSING,
      false,
    );
    const send = vi.fn().mockResolvedValue({ MessageID: "message-safe-retry" });
    await new NotificationEmailWorkerService(
      db as never,
      channels(send) as never,
    ).pollQueue();
    expect(send).toHaveBeenCalledTimes(1);
    expect(
      await db.notificationEmailDelivery.findUniqueOrThrow({
        where: { id: row.id },
      }),
    ).toMatchObject({
      status: "SENT",
      providerMessageId: "message-safe-retry",
    });
  });

  it("terminalizes a stale post-provider-start claim and never sends it", async () => {
    const row = await delivery(
      NotificationEmailDeliveryStatus.PROCESSING,
      true,
    );
    const send = vi.fn();
    await new NotificationEmailWorkerService(
      db as never,
      channels(send) as never,
    ).pollQueue();
    expect(send).not.toHaveBeenCalled();
    expect(
      await db.notificationEmailDelivery.findUniqueOrThrow({
        where: { id: row.id },
      }),
    ).toMatchObject({
      status: "FAILED_TERMINAL",
      lastError: expect.stringContaining("AMBIGUOUS_PROVIDER_RESULT"),
    });
  });

  it("allows only one of two workers to actively send an obligation", async () => {
    const row = await delivery(NotificationEmailDeliveryStatus.PENDING);
    const send = vi.fn().mockResolvedValue({ MessageID: "message-race" });
    const a = new NotificationEmailWorkerService(
      db as never,
      channels(send) as never,
    );
    const b = new NotificationEmailWorkerService(
      db as never,
      channels(send) as never,
    );
    await Promise.all([a.pollQueue(), b.pollQueue()]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(
      (
        await db.notificationEmailDelivery.findUniqueOrThrow({
          where: { id: row.id },
        })
      ).status,
    ).toBe("SENT");
  });

  it("fences stale email owners and preserves SENT monotonicity", async () => {
    const row = await delivery(NotificationEmailDeliveryStatus.SENT);
    expect(
      (
        await db.notificationEmailDelivery.updateMany({
          where: {
            id: row.id,
            status: "PROCESSING",
            lockedBy: "old",
            claimToken: "old",
          },
          data: { status: "FAILED_RETRYABLE" },
        })
      ).count,
    ).toBe(0);
    expect(
      (
        await db.notificationEmailDelivery.findUniqueOrThrow({
          where: { id: row.id },
        })
      ).status,
    ).toBe("SENT");
  });

  it("reclaims logical work below max and fails stale work at max without attempt max+1", async () => {
    const retryable = await db.notificationJob.create({
      data: {
        workspaceId: brandId,
        eventType: "billing.invoice_ready",
        urgencyLevel: "INFORMATIONAL",
        semanticEventKey: randomUUID(),
        payload: {},
        status: NotificationJobStatus.PROCESSING,
        attempts: 1,
        maxAttempts: 3,
        lockedAt: old,
        lockedBy: "dead",
        claimToken: "dead",
        snapshotFinalizedAt: new Date(),
      },
    });
    const terminal = await db.notificationJob.create({
      data: {
        workspaceId: brandId,
        eventType: "billing.invoice_ready",
        urgencyLevel: "INFORMATIONAL",
        semanticEventKey: randomUUID(),
        payload: {},
        status: NotificationJobStatus.PROCESSING,
        attempts: 3,
        maxAttempts: 3,
        lockedAt: old,
        lockedBy: "dead",
        claimToken: "dead",
        snapshotFinalizedAt: new Date(),
      },
    });
    const processor = { processJob: vi.fn().mockResolvedValue(undefined) };
    await new NotificationWorkerService(
      db as never,
      processor as never,
    ).pollQueue();
    expect(
      await db.notificationJob.findUniqueOrThrow({
        where: { id: retryable.id },
      }),
    ).toMatchObject({
      status: "COMPLETED",
      attempts: 2,
    });
    expect(
      await db.notificationJob.findUniqueOrThrow({
        where: { id: terminal.id },
      }),
    ).toMatchObject({
      status: "FAILED",
      attempts: 3,
    });
  });

  it("prevents an old logical owner from overwriting a newer claim", async () => {
    const row = await db.notificationJob.create({
      data: {
        workspaceId: brandId,
        eventType: "billing.invoice_ready",
        urgencyLevel: "INFORMATIONAL",
        semanticEventKey: randomUUID(),
        payload: {},
        status: "PROCESSING",
        attempts: 2,
        lockedAt: new Date(),
        lockedBy: "worker-b",
        claimToken: "claim-b",
        snapshotFinalizedAt: new Date(),
      },
    });
    const stale = await db.notificationJob.updateMany({
      where: {
        id: row.id,
        status: "PROCESSING",
        lockedBy: "worker-a",
        claimToken: "claim-a",
      },
      data: { status: "COMPLETED" },
    });
    expect(stale.count).toBe(0);
    expect(
      await db.notificationJob.findUniqueOrThrow({ where: { id: row.id } }),
    ).toMatchObject({
      status: "PROCESSING",
      lockedBy: "worker-b",
      claimToken: "claim-b",
    });
  });
});
