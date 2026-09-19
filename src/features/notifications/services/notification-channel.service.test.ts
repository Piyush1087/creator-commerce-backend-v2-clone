import { ConfigService } from "@nestjs/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildNotificationEmailCopy } from "../config/notification-email-copy";
import { NotificationChannelService } from "./notification-channel.service";

describe("notification email channel copy", () => {
  const sendNotificationEmail = vi.fn().mockResolvedValue({
    MessageID: "msg-1",
  });

  beforeEach(() => {
    sendNotificationEmail.mockClear();
  });

  it("sends registry title and real body instead of the event type", async () => {
    const channel = new NotificationChannelService(
      { sendNotificationEmail } as never,
      new ConfigService({
        APP_FRONTEND_URL: "https://dashboard.example.test",
      }),
    );
    await channel.deliverEmail({
      targetEmail: "owner@example.test",
      recipientName: "Owner",
      eventType: "billing.trial_expired",
      payload: { subscription_id: "sub-1" },
    });
    const expected = buildNotificationEmailCopy("billing.trial_expired");
    expect(sendNotificationEmail).toHaveBeenCalledWith({
      to: "owner@example.test",
      eventType: "billing.trial_expired",
      templateModel: {
        name: "Owner",
        title: expected.title,
        body: expected.body,
        action_url: "https://dashboard.example.test/brand/settings/billing",
        event_type: "billing.trial_expired",
      },
    });
    expect(expected.body).not.toContain("billing.trial_expired");
  });
});
