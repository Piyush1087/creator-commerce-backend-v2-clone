import { describe, expect, it, vi } from "vitest";
import { NotificationDispatchService } from "./notification-dispatch.service";

describe("NotificationDispatchService semantic dispatch", () => {
  it("uses one database upsert boundary and registry policy", async () => {
    const prisma = {
      brandProfile: { findUnique: vi.fn().mockResolvedValue({ id: "brand" }) },
      notificationJob: { upsert: vi.fn().mockResolvedValue({ id: "job-1" }) },
    };
    const service = new NotificationDispatchService(prisma as never);
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
    const first = prisma.notificationJob.upsert.mock.calls[0][0];
    const second = prisma.notificationJob.upsert.mock.calls[1][0];
    expect(first.where).toEqual(second.where);
    expect(first.create).toMatchObject({
      urgencyLevel: "CRITICAL",
      eventType: input.eventType,
    });
    expect(first.update).toEqual({});
  });

  it("requires affected-user server truth for email-only account events", async () => {
    const prisma = {
      brandProfile: { findUnique: vi.fn().mockResolvedValue({ id: "brand" }) },
      notificationJob: { upsert: vi.fn() },
    };
    const service = new NotificationDispatchService(prisma as never);
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
