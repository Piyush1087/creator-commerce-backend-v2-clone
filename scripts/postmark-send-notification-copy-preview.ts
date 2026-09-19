/**
 * One-shot: send every freeze notification body through notification-default-v2.
 * Uses gitignored .env. Does not send OTP, password reset, or team invite.
 *
 * Usage:
 *   npx ts-node -r dotenv/config scripts/postmark-send-notification-copy-preview.ts
 */
import { ServerClient } from "postmark";

import { NOTIFICATION_EVENT_REGISTRY } from "../src/features/notifications/config/notification-event-registry";
import {
  buildNotificationEmailCopy,
  notificationPostmarkMetadata,
  notificationPostmarkTag,
} from "../src/features/notifications/config/notification-email-copy";
import { resolveDeepLinkPath } from "../src/features/notifications/config/notification-event-registry";
import type { NotificationEventType } from "../src/features/notifications/types/notifications.types";

const TO = "aatishbrian@gmail.com";
const FROM =
  process.env.POSTMARK_NOTIFICATION_FROM?.trim() ||
  process.env.POSTMARK_AUTH_FROM?.trim() ||
  "no-reply@thecreatorshop.in";
const FRONTEND = (
  process.env.APP_FRONTEND_URL_PROD?.trim() ||
  "https://dashboard.thecreatorshop.in"
).replace(/\/$/, "");
const SAMPLE_PAYLOAD: Partial<
  Record<NotificationEventType, Record<string, unknown>>
> = {
  "intelligence.execution_completed": { aggregate_result: "PARTIAL" },
  "escrow.creator_payout_reversed": { reversal_scope: "PARTIAL" },
  "escrow.creator_payout_action_required": {
    reason: "PROVIDER_SETUP_REQUIRED",
  },
  "escrow.brand_return_partial": { unresolved_amount: 250 },
  "escrow.brand_return_action_required": { unresolved_amount: 100 },
  "campaigns.application_received": {
    application_id: "preview",
    campaign_id: "preview",
  },
  "campaigns.application_approved": {
    application_id: "preview",
    campaign_id: "preview",
  },
  "campaigns.application_rejected": {
    application_id: "preview",
    campaign_id: "preview",
  },
  "escrow.collaboration_awaiting_funds": { collaboration_id: "preview" },
  "collaborations.media_submitted_for_review": {
    collaboration_id: "preview",
  },
  "payouts.creator_setup_blocking": { obligation_id: "preview" },
  "payouts.provider_action_required": { obligation_id: "preview" },
  "payouts.transfer_failed_or_reconciliation_required": {
    obligation_id: "preview",
  },
  "escrow.creator_payout_settled": { obligation_id: "preview" },
  "escrow.brand_return_completed": {
    brand_return_request_id: "preview",
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function templateId(): number {
  const raw =
    process.env.POSTMARK_NOTIFICATION_DEFAULT_TEMPLATE_ID?.trim() ?? "";
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("POSTMARK_NOTIFICATION_DEFAULT_TEMPLATE_ID is missing");
  }
  return id;
}

async function main(): Promise<void> {
  const token = process.env.POSTMARK_SERVER_TOKEN?.trim() ?? "";
  if (!token || token === "replace-me") {
    throw new Error("POSTMARK_SERVER_TOKEN is missing");
  }
  const client = new ServerClient(token);
  const id = templateId();
  const events = Object.keys(
    NOTIFICATION_EVENT_REGISTRY,
  ) as NotificationEventType[];
  const results: Array<{ event: string; ok: boolean; messageId?: string }> =
    [];

  for (const eventType of events) {
    const definition = NOTIFICATION_EVENT_REGISTRY[eventType];
    const payload = SAMPLE_PAYLOAD[eventType] ?? {};
    const copy = buildNotificationEmailCopy(eventType, payload);
    const path = resolveDeepLinkPath(definition.deepLinkPath, {
      application_id: "preview",
      campaign_id: "preview",
      collaboration_id: "preview",
      obligation_id: "preview",
      brand_return_request_id: "preview",
      ...payload,
    });
    const actionUrl = `${FRONTEND}${path.startsWith("/") ? path : `/${path}`}`;
    try {
      const response = await client.sendEmailWithTemplate({
        From: FROM,
        To: TO,
        TemplateId: id,
        TemplateModel: {
          name: "Brian",
          title: copy.title,
          body: copy.body,
          action_url: actionUrl,
          event_type: eventType,
        },
        MessageStream: "outbound",
        Tag: notificationPostmarkTag(eventType),
        Metadata: notificationPostmarkMetadata(eventType),
      });
      results.push({
        event: eventType,
        ok: response.ErrorCode === 0,
        messageId: response.MessageID,
      });
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      results.push({ event: eventType, ok: false });
      console.error(
        JSON.stringify({
          event: eventType,
          ok: false,
          statusCode: err.statusCode ?? "n/a",
        }),
      );
    }
    await sleep(400);
  }

  const failed = results.filter((row) => !row.ok).map((row) => row.event);
  console.log(
    JSON.stringify(
      {
        to: TO,
        templateId: id,
        sent: results.filter((row) => row.ok).length,
        total: results.length,
        failed,
      },
      null,
      2,
    ),
  );
  if (failed.length > 0) process.exit(1);
}

void main();
