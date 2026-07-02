# Notifications module — implementation docs

Technical documentation for the **brand notifications backend** (Phase 1).  
Product requirements remain read-only in `product-docs/`.

| Doc | Purpose |
|-----|---------|
| [README.md](./README.md) | Architecture, env vars, API surface |
| [IMPLEMENTATION-TRACKING.md](./IMPLEMENTATION-TRACKING.md) | Done / pending / how to pick up work |
| [TESTING.md](./TESTING.md) | Manual test checklist |

## Phase plan

| Phase | Queue | Worker | Status |
|-------|-------|--------|--------|
| **1** | `notification_jobs` (Postgres) | In-process poller in Nest API (`@Interval 5s`) | **Current** |
| **2** | Same Postgres queue | Optional dedicated ECS worker service | Pending |
| **3** | SQS between API and worker | Only if Postgres queue becomes a bottleneck | Pending |

**Product doc deviation (intentional):** Redis Pub/Sub / BullMQ replaced by **Postgres job queue** — same async pipeline semantics, no new infra.

## Code layout

```text
src/features/notifications/
  config/notification-event-registry.ts   # routing matrix + aggregation window
  config/notification-postmark-env.ts     # per-event POSTMARK_TEMPLATE_* keys
  services/
    notification-dispatch.service.ts      # enqueue (called by domain modules)
    notification-worker.service.ts        # poller
    notification-processor.service.ts     # aggregation + DB + WS
    notification-channel.service.ts       # email (Postmark) + Slack
    notification-query.service.ts         # list / read APIs
  notifications.controller.ts             # brand REST + test-emit
```

`workspace_id` in storage = **`brandProfileId`** (brand tenant scope).

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `POSTMARK_SERVER_TOKEN` | Yes | Postmark API token |
| `POSTMARK_NOTIFICATION_FROM` | Optional | Sender address (default `no-reply@thecreatorshop.in`) |
| `POSTMARK_NOTIFICATION_DEFAULT_TEMPLATE_ID` | Recommended | Fallback when per-event ID is unset |
| `POSTMARK_OTP_TEMPLATE_ID` | Fallback | Used if default notification template unset |
| `APP_FRONTEND_URL` | Recommended | Deep links in email `action_url` |
| `NOTIFICATIONS_DEV_EMIT_ENABLED` | Dev/staging | `true` to allow test-emit when `STAGE` ≠ `local` |

### Per-event Postmark template IDs

Resolver: `src/features/notifications/config/notification-postmark-env.ts`  
Rule: `event.type` → `POSTMARK_TEMPLATE_<EVENT>` (dots → underscores, uppercased).

Unset per-event vars fall back to `POSTMARK_NOTIFICATION_DEFAULT_TEMPLATE_ID`.

| Event type | Env var |
|------------|---------|
| `integration.meta_token_expired` | `POSTMARK_TEMPLATE_INTEGRATION_META_TOKEN_EXPIRED` |
| `team.invite_pending` | `POSTMARK_TEMPLATE_TEAM_INVITE_PENDING` |
| `escrow.low_balance` | `POSTMARK_TEMPLATE_ESCROW_LOW_BALANCE` |
| `billing.invoice_payment_failed` | `POSTMARK_TEMPLATE_BILLING_INVOICE_PAYMENT_FAILED` |
| `billing.tax_invoice_compiled` | `POSTMARK_TEMPLATE_BILLING_TAX_INVOICE_COMPILED` |
| `pricing.trial_expiring` | `POSTMARK_TEMPLATE_PRICING_TRIAL_EXPIRING` |
| `pricing.subscription_renewed` | `POSTMARK_TEMPLATE_PRICING_SUBSCRIPTION_RENEWED` |
| `pricing.usage_cap_approaching` | `POSTMARK_TEMPLATE_PRICING_USAGE_CAP_APPROACHING` |
| `planner.competitive_scan_complete` | `POSTMARK_TEMPLATE_PLANNER_COMPETITIVE_SCAN_COMPLETE` |
| `outreach.milestone_counter_offer` | `POSTMARK_TEMPLATE_OUTREACH_MILESTONE_COUNTER_OFFER` |
| `workflow.asset_draft_submitted` | `POSTMARK_TEMPLATE_WORKFLOW_ASSET_DRAFT_SUBMITTED` |
| `workflow.milestone_overdue_creator` | `POSTMARK_TEMPLATE_WORKFLOW_MILESTONE_OVERDUE_CREATOR` |
| `workflow.brand_review_overdue` | `POSTMARK_TEMPLATE_WORKFLOW_BRAND_REVIEW_OVERDUE` |
| `workflow.compliance_failure` | `POSTMARK_TEMPLATE_WORKFLOW_COMPLIANCE_FAILURE` |

Template model sent to Postmark: `name`, `title`, `body`, `action_url`, `event_type`.

SST deploy wires all `POSTMARK_TEMPLATE_*` keys via `buildNotificationPostmarkTemplateEnv()` in `sst.config.ts`.

## Quick start

1. Apply migration: `npm run db:migrate:deploy`
2. Set env vars above in `.env` (per-event IDs optional until real templates exist)
3. `npm run dev`
4. Follow [TESTING.md](./TESTING.md)
