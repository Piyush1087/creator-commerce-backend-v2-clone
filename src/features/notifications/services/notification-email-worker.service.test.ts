import { NotificationEmailDeliveryStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { NotificationEmailWorkerService } from "./notification-email-worker.service";

function harness(send: () => Promise<{ MessageID?: string }>) {
  const prisma = {
    notificationEmailDelivery: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([{ id: "delivery-1" }]),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "delivery-1",
        targetEmail: "a@example.com",
        recipientId: "recipient-1",
        attempts: 1,
        maxAttempts: 5,
        scheduledAt: new Date(),
        user: { name: "A" },
        notification: { eventType: "billing.invoice_ready", payload: {} },
      }),
    },
    notificationRecipient: { update: vi.fn().mockResolvedValue({}) },
    $executeRaw: vi.fn().mockResolvedValue(0),
    $queryRaw: vi.fn().mockResolvedValue([{ id: "delivery-1" }]),
  };
  const worker = new NotificationEmailWorkerService(
    prisma as never,
    { assertEmailConfigured: vi.fn(), deliverEmail: vi.fn(send) } as never,
  );
  return { worker, prisma };
}

describe("NotificationEmailWorkerService", () => {
  it("claims once, retains Postmark MessageID, and never changes read state", async () => {
    const { worker, prisma } = harness(async () => ({
      MessageID: "postmark-1",
    }));
    await worker.pollQueue();
    expect(prisma.notificationEmailDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "delivery-1",
          status: NotificationEmailDeliveryStatus.PROCESSING,
        }),
        data: expect.objectContaining({
          status: NotificationEmailDeliveryStatus.SENT,
          providerMessageId: "postmark-1",
        }),
      }),
    );
    expect(prisma.notificationRecipient.update).toHaveBeenCalledWith({
      where: { id: "recipient-1" },
      data: { isEmailed: true },
    });
  });

  it("classifies an ambiguous provider result terminal instead of blindly retrying", async () => {
    const { worker, prisma } = harness(async () => {
      throw new Error("socket hang up after send");
    });
    await worker.pollQueue();
    expect(prisma.notificationEmailDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NotificationEmailDeliveryStatus.FAILED_TERMINAL,
          lastError: expect.stringContaining("AMBIGUOUS_PROVIDER_RESULT"),
        }),
      }),
    );
  });
});
