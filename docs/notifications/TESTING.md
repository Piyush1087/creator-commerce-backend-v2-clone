# Notifications — manual testing (Phase 1)

Backend-only tests. Requires a brand JWT and running API (`npm run dev`).

---

## Prerequisites

1. Migration applied: `npm run db:migrate:deploy`
2. `.env` includes:
   - `POSTMARK_SERVER_TOKEN`
   - `POSTMARK_NOTIFICATION_DEFAULT_TEMPLATE_ID` (can reuse OTP template ID for smoke tests)
   - `STAGE=local` **or** `NOTIFICATIONS_DEV_EMIT_ENABLED=true`
3. Brand user logged in; at least one active `brand_team_members` row (visit settings once to bootstrap membership).

---

## 1. Test emit (enqueue)

```http
POST /api/v1/brand/notifications/test-emit
Authorization: Bearer <brand-jwt>
Content-Type: application/json

{
  "event_type": "escrow.low_balance",
  "payload": {
    "campaign_id": "camp_test_001",
    "campaign_name": "Summer Launch",
    "balance_minor": 25000
  },
  "actor_name": "@test_creator"
}
```

**Expect:** `202` with `{ "job_id": "<uuid>" }`

Within ~5 seconds:
- `notification_jobs.status` = `COMPLETED`
- Row in `notifications` for your `brand_profile_id`
- Rows in `notification_recipients` for each active team member

---

## 2. List notifications

```http
GET /api/v1/brand/notifications
Authorization: Bearer <brand-jwt>
```

```http
GET /api/v1/brand/notifications?unread_only=true
Authorization: Bearer <brand-jwt>
```

```http
GET /api/v1/brand/notifications/unread-count
Authorization: Bearer <brand-jwt>
```

---

## 3. Mark read

```http
PATCH /api/v1/brand/notifications/<notification-id>/read
Authorization: Bearer <brand-jwt>
Content-Type: application/json

{ "is_read": true }
```

```http
POST /api/v1/brand/notifications/mark-all-read
Authorization: Bearer <brand-jwt>
```

---

## 4. Aggregation (15-minute window)

Emit the same aggregatable event twice within 15 minutes, e.g.:

```json
{
  "event_type": "outreach.creator_accepted",
  "payload": {
    "campaign_id": "camp_agg_01",
    "campaign_name": "Agg Test",
    "creator_id": "cr_1",
    "creator_handle": "@alpha"
  },
  "actor_name": "@alpha"
}
```

Then again with `"actor_name": "@beta"`.

**Expect:** One `notifications` row; `payload._aggregation.actor_count` = 2; `updated_at` bumped; second job does not create duplicate recipients.

---

## 5. Channel preferences

1. `GET /api/v1/brand/settings/notifications` — note EMAIL / IN_APP toggles for `ESCROW_LOW_BALANCE`
2. `PATCH /api/v1/brand/settings/notifications` — disable EMAIL for escrow
3. Test-emit `escrow.low_balance` again

**Expect:** In-app row + WS event (if IN_APP enabled); no Postmark send / `is_emailed` stays false.

---

## 6. WebSocket (optional)

Connect to Socket.IO namespace `/collaboration` with JWT (same as collaboration module).

**Listen for:** `notification:new`

Payload shape:

```json
{
  "id": "<uuid>",
  "event_type": "escrow.low_balance",
  "urgency_level": "CRITICAL",
  "payload": { },
  "created_at": "ISO-8601"
}
```

---

## 7. Email-only event

```json
{
  "event_type": "billing.tax_invoice_compiled",
  "payload": {
    "invoice_id": "inv_test_01",
    "campaign_name": "Q2 Tax"
  }
}
```

**Expect:** Email attempt if template configured; no `notification:new` WS (in-app disabled in matrix).

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `403` on test-emit | `STAGE=local` or `NOTIFICATIONS_DEV_EMIT_ENABLED=true` |
| Job stuck `PENDING` | API running; worker logs `notification.worker.started` |
| Job `FAILED` | `last_error` on `notification_jobs`; Postmark template missing |
| Empty list | Wrong brand user; no team membership; event `inApp: false` still creates rows — check `notification_recipients` |
| No email | Settings matrix disabled EMAIL; or Postmark template/inactive sender |
