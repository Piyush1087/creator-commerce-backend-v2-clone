import { NotificationEmailDeliveryStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { NotificationEmailWorkerService } from "./notification-email-worker.service";

function harness(send: () => Promise<{ MessageID?: string }>) {
  const persisted = vi.fn().mockResolvedValue({});
  const prisma = {
    notificationEmailDelivery: {
      updateMany: vi
        .fn()
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 }),
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
      update: persisted,
    },
    notificationRecipient: { update: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    ),
  };
  const worker = new NotificationEmailWorkerService(
    prisma as never,
    { deliverEmail: vi.fn(send) } as never,
  );
  return { worker, prisma, persisted };
}

describe("NotificationEmailWorkerService", () => {
  it("claims once, retains Postmark MessageID, and never changes read state", async () => {
    const { worker, prisma, persisted } = harness(async () => ({
      MessageID: "postmark-1",
    }));
    await worker.pollQueue();
    expect(persisted).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "delivery-1" },
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
    const { worker, persisted } = harness(async () => {
      throw new Error("socket hang up after send");
    });
    await worker.pollQueue();
    expect(persisted).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NotificationEmailDeliveryStatus.FAILED_TERMINAL,
          lastError: expect.stringContaining("AMBIGUOUS_PROVIDER_RESULT"),
        }),
      }),
    );
  });
});
