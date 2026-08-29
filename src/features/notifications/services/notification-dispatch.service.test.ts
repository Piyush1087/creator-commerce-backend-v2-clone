import { describe, expect, it, vi } from "vitest";
import { NotificationDispatchService } from "./notification-dispatch.service";

describe("NotificationDispatchService semantic dispatch", () => {
  it("uses one database upsert boundary and registry policy", async () => {
    const tx = {
      brandProfile: { findUnique: vi.fn().mockResolvedValue({ id: "brand" }) },
      notificationJob: {
        upsert: vi.fn().mockResolvedValue({ id: "job-1" }),
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({ snapshotFinalizedAt: null })
          .mockResolvedValueOnce({ snapshotFinalizedAt: new Date() }),
        update: vi.fn().mockResolvedValue({}),
      },
      notificationJobRecipient: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      userBrandNotificationPreference: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "job-1" }]),
    };
    const prisma = { $transaction: vi.fn((callback) => callback(tx)) };
    const recipients = {
      resolve: vi
        .fn()
        .mockResolvedValue([
          { userId: "owner", email: "o@example.com", name: "O", inbox: true },
        ]),
    };
    const service = new NotificationDispatchService(
      prisma as never,
      recipients as never,
    );
    const input = {
      workspaceId: "brand",
      eventType: "billing.subscription_payment_failed" as const,
      source: {
        sourceType: "payment",
        sourceId: "pay-1",
        transitionId: "failed",
      },
      payload: { amount: 100 },
      triggerUserId: "user-1",
    };
    await expect(service.dispatch(input)).resolves.toEqual({ job_id: "job-1" });
    await expect(service.dispatch(input)).resolves.toEqual({ job_id: "job-1" });
    const first = tx.notificationJob.upsert.mock.calls[0][0];
    const second = tx.notificationJob.upsert.mock.calls[1][0];
    expect(first.where).toEqual(second.where);
    expect(first.create).toMatchObject({
      urgencyLevel: "CRITICAL",
      eventType: input.eventType,
    });
    expect(first.update).toEqual({});
    expect(tx.notificationJobRecipient.createMany).toHaveBeenCalledTimes(1);
  });

  it("requires affected-user server truth for email-only account events", async () => {
    const tx = {
      brandProfile: { findUnique: vi.fn().mockResolvedValue({ id: "brand" }) },
      notificationJob: { upsert: vi.fn() },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(tx)) };
    const service = new NotificationDispatchService(
      prisma as never,
      {} as never,
    );
    await expect(
      service.dispatch({
        workspaceId: "brand",
        eventType: "team.member_access_revoked",
        source: {
          sourceType: "membership",
          sourceId: "m-1",
          transitionId: "revoked",
        },
        payload: {},
      }),
    ).rejects.toThrow("Affected user identity is required");
  });
});
