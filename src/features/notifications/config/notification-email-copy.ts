import type { NotificationEventType } from "../types/notifications.types";
import { NOTIFICATION_EVENT_REGISTRY } from "./notification-event-registry";

const BODIES = {
  "billing.subscription_payment_failed":
    "Your subscription payment could not be collected. Update your payment method to keep this workspace active.",
  "billing.subscription_payment_recovered":
    "Your subscription payment succeeded and the plan is active again.",
  "billing.trial_expired":
    "Your trial has ended. Choose a plan in billing to keep using The Creator Shop.",
  "billing.subscription_halted":
    "Your subscription is halted because payment is still outstanding. Update billing to restore access.",
  "billing.cancellation_scheduled":
    "Your subscription is set to cancel at the end of the current period. You can reactivate it from billing.",
  "billing.cancellation_effective":
    "Your subscription has ended. Resubscribe from billing to restore this workspace.",
  "billing.cancellation_reactivated": "Your subscription is active again.",
  "billing.invoice_ready": "A new invoice is available in billing.",
  "escrow.funding_credited":
    "Escrow funding has been credited to your workspace. Open payouts to review the balance.",
  "escrow.collaboration_awaiting_funds":
    "A collaboration is waiting for escrow funds before work can continue. Add funds or confirm the reserve.",
  "escrow.collaboration_refunded":
    "Collaboration funds have been returned to escrow.",
  "escrow.creator_payout_action_required":
    "A creator payout needs your attention before it can be sent.",
  "escrow.creator_payout_settled": "A creator payout has been settled.",
  "escrow.creator_payout_reversed":
    "A creator payout was reversed and needs review.",
  "escrow.brand_return_action_required":
    "A brand return needs action before it can finish. Open payouts to continue.",
  "escrow.brand_return_partial":
    "A brand return completed only in part. Review the remaining amount in payouts.",
  "escrow.brand_return_completed": "A brand return has completed.",
  "payouts.reserve_approval_required":
    "A financial reserve needs approval before payouts can proceed.",
  "payouts.creator_setup_blocking":
    "Creator payout setup is incomplete, so this payment cannot be sent yet.",
  "payouts.provider_action_required":
    "Razorpay needs action before this creator payment can continue.",
  "payouts.transfer_failed_or_reconciliation_required":
    "A creator payment failed or needs reconciliation. Open payouts to review it.",
  "campaigns.application_received":
    "A creator has applied to a campaign. Open applications to review it.",
  "campaigns.application_approved": "Your campaign application was approved.",
  "campaigns.application_rejected":
    "Your campaign application was not approved.",
  "collaborations.media_submitted_for_review":
    "New collaboration media is ready for review.",
  "intelligence.execution_completed":
    "A Brand Intelligence run has finished. Open intelligence to view the results.",
  "intelligence.execution_failed":
    "A Brand Intelligence run failed. Open intelligence to retry or inspect the error.",
  "team.member_access_revoked":
    "Your access to this brand workspace has been removed. If this is unexpected, contact the brand owner.",
  "integration.instagram_token_expired":
    "The Instagram connection for this brand has expired. Reconnect it under integrations.",
} as const satisfies Record<NotificationEventType, string>;

export type NotificationEmailCopy = {
  title: string;
  body: string;
};

export function notificationPostmarkTag(eventType: string): string {
  return eventType.trim();
}

export function notificationPostmarkMetadata(
  eventType: string,
): Record<string, string> {
  return { event_type: eventType };
}

export function buildNotificationEmailCopy(
  eventType: NotificationEventType,
  payload: Record<string, unknown> = {},
): NotificationEmailCopy {
  const definition = NOTIFICATION_EVENT_REGISTRY[eventType];
  return {
    title: definition.title,
    body: withPayloadDetail(eventType, BODIES[eventType], payload),
  };
}

function withPayloadDetail(
  eventType: NotificationEventType,
  body: string,
  payload: Record<string, unknown>,
): string {
  if (
    eventType === "intelligence.execution_completed" &&
    payload.aggregate_result === "PARTIAL"
  ) {
    return `${body} Some processors finished with partial results.`;
  }
  if (
    eventType === "escrow.creator_payout_reversed" &&
    payload.reversal_scope === "PARTIAL"
  ) {
    return `${body} This reversal was partial.`;
  }
  if (
    eventType === "escrow.creator_payout_action_required" ||
    eventType === "payouts.creator_setup_blocking"
  ) {
    const reason = humanizeReason(payload.reason);
    return reason ? `${body} ${reason}` : body;
  }
  const unresolved = numericField(payload, "unresolved_amount");
  if (
    (eventType === "escrow.brand_return_partial" ||
      eventType === "escrow.brand_return_action_required") &&
    unresolved !== null
  ) {
    return `${body} Unresolved amount: ${unresolved}.`;
  }
  return body;
}

function numericField(
  payload: Record<string, unknown>,
  key: string,
): number | null {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function humanizeReason(value: unknown): string | null {
  if (value === "PROVIDER_SETUP_REQUIRED") {
    return "Creator payout setup with Razorpay is still required.";
  }
  if (value === "PROVIDER_CAPABILITY_UNAVAILABLE") {
    return "Razorpay cannot complete this transfer yet.";
  }
  return null;
}
