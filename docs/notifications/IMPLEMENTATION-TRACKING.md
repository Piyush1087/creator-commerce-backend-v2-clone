# Notifications — implementation tracking

Living tracker for backend notifications (Phase 1).  
Product specs: `product-docs/notifications- Brand.md` (do not edit).

Last updated: 2026-06-29

---

## Phase 1 — Done

| Area | Status | Notes |
|------|--------|-------|
| **Postgres schema** | Done | `notifications`, `notification_recipients`, `notification_jobs` |
| **Job queue** | Done | `notification_jobs` + in-process poller (5s interval, retries) |
| **Event routing matrix** | Done | All 18 brand events in `notification-event-registry.ts` |
| **15-min aggregation** | Done | Aggregatable outreach/workflow events merge payload `_aggregation` |
| **Per-user read state** | Done | `notification_recipients.is_read` / `read_at` |
| **Workspace scoping** | Done | `workspace_id` → `brandProfileId`; recipients = active `brand_team_members` |
| **Channel prefs** | Done | Respects `brand_notification_settings` (EMAIL, IN_APP, SLACK_WEBHOOK) |
| **Postmark email** | Done | `MailService.sendNotificationEmail`; per-event or default template env |
| **WebSocket push** | Done | `notification:new` on `user:{userId}` via `/collaboration` namespace |
| **Brand REST API** | Done | `GET/PATCH/POST` under `api/v1/brand/notifications` |
| **Dev test emit** | Done | `POST .../test-emit` when `STAGE=local` or `NOTIFICATIONS_DEV_EMIT_ENABLED=true` |
| **Postgres auto-migrate on dev deploy** | Done | `RUN_MIGRATIONS_ON_START` + `docker-entrypoint.sh`; see `docs/deployment/README.md` |

---

## Phase 1 — Pending (pick up here)

| Priority | Task | Where to wire | Notes |
|----------|------|---------------|-------|
| **P1** | **Domain event producers** | Escrow, pricing, workflow, team invite, integrations | Call `NotificationDispatchService.dispatch()` after business action |
| **P1** | **Dedicated Postmark templates** | Postmark dashboard + `.env` | One template per email-enabled event, or shared generic template |
| **P1** | **Frontend bell + list** | `creator-commerce-frontend-v2` | Consume REST + `notification:new` WS |
| **P2** | **Team invite email** | `brand-settings` invite flow | Emit `team.invite_pending` on invite create |
| **P2** | **Escrow low balance** | `brand-escrow` service | Emit `escrow.low_balance` when threshold crossed |
| **P2** | **Pricing / billing events** | `pricing` module webhooks / jobs | trial, renewal, payment failed, tax invoice |
| **P2** | **Workflow / outreach events** | `collaboration`, `brand-uce` | milestone overdue, asset draft, counter-offer, etc. |
| **P2** | **Meta token expired** | integrations (when built) | `integration.meta_token_expired` |
| **P3** | **Creator-side notifications** | New registry + APIs | Product doc is brand-only today |
| **P3** | **SKIP LOCKED claim** | `notification-worker.service.ts` | Current claim is optimistic `updateMany`; upgrade for multi-instance |
| **P3** | **Dedicated `/notifications` WS namespace** | new gateway | Optional; today reuses collaboration socket rooms |

### How to add a producer (example)

```typescript
// In any feature service (inject NotificationDispatchService):
await this.notifications.dispatch({
  workspaceId: brandProfileId,
  eventType: "escrow.low_balance",
  urgencyLevel: "CRITICAL",
  payload: {
    campaign_id: "...",
    campaign_name: "...",
    balance_minor: 50000,
  },
});
```

No HTTP round-trip — job is written to `notification_jobs` and processed within ~5s.

### How to verify a producer

1. Trigger the business action (or use `POST /api/v1/brand/notifications/test-emit`)
2. Check `notification_jobs` → `COMPLETED`
3. Check `notifications` + `notification_recipients`
4. `GET /api/v1/brand/notifications?unread_only=true`
5. Postmark activity log (if email enabled)

---

## Phase 2 — Not started

- Extract worker poller to dedicated ECS service (same `notification_jobs` table)
- Enable `FOR UPDATE SKIP LOCKED` batch claim for horizontal scale
- Health metric: queue depth / failed job count

## Phase 3 — Not started

- SQS between API (enqueue) and worker (consume) if Postgres polling limits hit

---

## Environment checklist

| Variable | Required | Purpose |
|----------|----------|---------|
| `POSTMARK_SERVER_TOKEN` | Yes | Already used for OTP |
| `POSTMARK_NOTIFICATION_DEFAULT_TEMPLATE_ID` | Recommended | Fallback template (`title`, `body`, `action_url`, `name`, `event_type`) |
| `POSTMARK_NOTIFICATION_FROM` | Optional | Default `no-reply@thecreatorshop.in` |
| `POSTMARK_TEMPLATE_<EVENT>` | Optional | 14 per-event keys — see [README.md](./README.md#per-event-postmark-template-ids) |
| `APP_FRONTEND_URL` | Recommended | Deep links in emails |
| `NOTIFICATIONS_DEV_EMIT_ENABLED` | Dev/staging | `true` to allow test-emit when `STAGE` is not `local` |

Per-event env keys are generated from `notification-event-registry.ts` (email-enabled events only).  
Source of truth: `src/features/notifications/config/notification-postmark-env.ts`.

---

## Resolved decisions

| Decision | Choice |
|----------|--------|
| Queue vs Redis | Postgres `notification_jobs` |
| Worker host | Same Nest API process (Phase 1) |
| Workspace key | `brandProfileId` |
| Recipients | Active brand team members (max 5 seats model) |
| Settings gating | `brand_notification_settings` when event maps to a category |
