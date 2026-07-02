import type { NotificationEventDefinition } from "../types/notifications.types";

/**
 * Platform activity routing matrix from product docs.
 * `workspace_id` in storage maps to `brandProfileId`.
 */
export const NOTIFICATION_EVENT_REGISTRY: Record<
  string,
  NotificationEventDefinition
> = {
  "integration.meta_token_expired": {
    eventType: "integration.meta_token_expired",
    urgencyLevel: "CRITICAL",
    inApp: true,
    email: true,
    deepLinkPath: "/brand/settings/integrations?state=token_error",
    title: "Meta connection expired",
    aggregatable: false,
  },
  "team.invite_pending": {
    eventType: "team.invite_pending",
    urgencyLevel: "MEDIUM",
    inApp: true,
    email: true,
    deepLinkPath: "/brand/settings/general?focus=team",
    title: "Team invitation pending",
    aggregatable: false,
  },
  "workspace.seat_capacity_bounded": {
    eventType: "workspace.seat_capacity_bounded",
    urgencyLevel: "LOW",
    inApp: true,
    email: false,
    deepLinkPath: "/brand/settings/general?focus=capacity",
    title: "Workspace seat limit reached",
    aggregatable: false,
  },
  "escrow.low_balance": {
    eventType: "escrow.low_balance",
    urgencyLevel: "CRITICAL",
    inApp: true,
    email: true,
    deepLinkPath: "/brand/settings/billing?action=top_up",
    title: "Escrow balance is low",
    settingsCategory: "ESCROW_LOW_BALANCE",
    aggregatable: false,
  },
  "billing.invoice_payment_failed": {
    eventType: "billing.invoice_payment_failed",
    urgencyLevel: "CRITICAL",
    inApp: true,
    email: true,
    deepLinkPath: "/brand/settings/billing?action=dunning",
    title: "Invoice payment failed",
    settingsCategory: "TAX_COMPLIANCE_ALERT",
    aggregatable: false,
  },
  "billing.tax_invoice_compiled": {
    eventType: "billing.tax_invoice_compiled",
    urgencyLevel: "LOW",
    inApp: false,
    email: true,
    deepLinkPath: "/brand/settings/billing?focus=invoices",
    title: "Tax invoice ready",
    settingsCategory: "TAX_COMPLIANCE_ALERT",
    aggregatable: false,
  },
  "pricing.trial_expiring": {
    eventType: "pricing.trial_expiring",
    urgencyLevel: "CRITICAL",
    inApp: true,
    email: true,
    deepLinkPath: "/brand/settings/billing?view=pricing_matrix",
    title: "Trial expiring soon",
    settingsCategory: "TAX_COMPLIANCE_ALERT",
    aggregatable: false,
  },
  "pricing.subscription_renewed": {
    eventType: "pricing.subscription_renewed",
    urgencyLevel: "LOW",
    inApp: true,
    email: true,
    deepLinkPath: "/brand/settings/billing?focus=plan",
    title: "Subscription renewed",
    settingsCategory: "TAX_COMPLIANCE_ALERT",
    aggregatable: false,
  },
  "pricing.usage_cap_approaching": {
    eventType: "pricing.usage_cap_approaching",
    urgencyLevel: "MEDIUM",
    inApp: true,
    email: true,
    deepLinkPath: "/brand/settings/billing?focus=usage",
    title: "Usage cap approaching",
    settingsCategory: "CAMPAIGN_BUDGET_OVERRUN",
    aggregatable: false,
  },
  "planner.competitive_scan_complete": {
    eventType: "planner.competitive_scan_complete",
    urgencyLevel: "LOW",
    inApp: true,
    email: true,
    deepLinkPath: "/brand/planner/dashboard",
    title: "Competitive scan complete",
    aggregatable: false,
  },
  "outreach.creator_accepted": {
    eventType: "outreach.creator_accepted",
    urgencyLevel: "MEDIUM",
    inApp: true,
    email: false,
    deepLinkPath: "/brand/campaigns/{campaign_id}/outreach?filter=accepted",
    title: "Creator accepted invitation",
    settingsCategory: "CAMPAIGN_BUDGET_OVERRUN",
    aggregatable: true,
  },
  "outreach.milestone_counter_offer": {
    eventType: "outreach.milestone_counter_offer",
    urgencyLevel: "MEDIUM",
    inApp: true,
    email: true,
    deepLinkPath:
      "/brand/campaigns/{campaign_id}/outreach/{creator_id}?view=negotiation",
    title: "Creator sent a counter-offer",
    settingsCategory: "MILESTONE_RELEASE_REQUEST",
    aggregatable: true,
  },
  "outreach.offer_expired": {
    eventType: "outreach.offer_expired",
    urgencyLevel: "LOW",
    inApp: true,
    email: false,
    deepLinkPath: "/brand/campaigns/{campaign_id}/outreach?filter=expired",
    title: "Allocation offer expired",
    settingsCategory: "CAMPAIGN_BUDGET_OVERRUN",
    aggregatable: true,
  },
  "workflow.asset_draft_submitted": {
    eventType: "workflow.asset_draft_submitted",
    urgencyLevel: "MEDIUM",
    inApp: true,
    email: true,
    deepLinkPath:
      "/brand/campaigns/{campaign_id}/workflow/{creator_id}?view=asset_review",
    title: "Creator submitted asset draft",
    settingsCategory: "MILESTONE_RELEASE_REQUEST",
    aggregatable: true,
  },
  "workflow.post_cleared_automated_check": {
    eventType: "workflow.post_cleared_automated_check",
    urgencyLevel: "LOW",
    inApp: true,
    email: false,
    deepLinkPath: "/brand/campaigns/{campaign_id}/dashboard",
    title: "Post cleared automated check",
    settingsCategory: "MILESTONE_RELEASE_REQUEST",
    aggregatable: true,
  },
  "workflow.milestone_overdue_creator": {
    eventType: "workflow.milestone_overdue_creator",
    urgencyLevel: "CRITICAL",
    inApp: true,
    email: true,
    deepLinkPath:
      "/brand/campaigns/{campaign_id}/workflow/{creator_id}?state=delayed",
    title: "Creator missed submission deadline",
    settingsCategory: "MILESTONE_RELEASE_REQUEST",
    aggregatable: true,
  },
  "workflow.brand_review_overdue": {
    eventType: "workflow.brand_review_overdue",
    urgencyLevel: "CRITICAL",
    inApp: true,
    email: true,
    deepLinkPath:
      "/brand/campaigns/{campaign_id}/workflow/{creator_id}?state=review_backlog",
    title: "Asset review overdue",
    settingsCategory: "MILESTONE_RELEASE_REQUEST",
    aggregatable: true,
  },
  "workflow.compliance_failure": {
    eventType: "workflow.compliance_failure",
    urgencyLevel: "CRITICAL",
    inApp: true,
    email: true,
    deepLinkPath:
      "/brand/campaigns/{campaign_id}/workflow/{creator_id}?state=compliance_error",
    title: "Compliance check failed",
    settingsCategory: "MILESTONE_RELEASE_REQUEST",
    aggregatable: true,
  },
};

export const AGGREGATION_WINDOW_MS = 15 * 60 * 1000;

export function getEventDefinition(
  eventType: string,
): NotificationEventDefinition | null {
  return NOTIFICATION_EVENT_REGISTRY[eventType] ?? null;
}

export function resolveDeepLinkPath(
  template: string,
  payload: Record<string, unknown>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = payload[key];
    return value === undefined || value === null ? "" : String(value);
  });
}
