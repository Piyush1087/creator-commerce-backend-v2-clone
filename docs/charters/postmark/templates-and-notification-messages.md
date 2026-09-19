# Postmark templates and notification messages

Human overview of what is published on Postmark, why notifications share one template, and the exact title/body the app sends for each event.

**Server:** `thecreatorshop` (`15113300`)  
**From:** `no-reply@thecreatorshop.in`  
**Sending:** may be paused in Postmark — API can return OK while Activity stays empty and Gmail never receives mail. Unpause before live delivery checks.  
**Source of copy:** `src/features/notifications/config/notification-email-copy.ts`  
**Deep links:** `src/features/notifications/config/notification-event-registry.ts`  
**IDs / env:** `register.md`

---

## 1. Proper templates (four `*-v2`)

These are the only runtime Postmark templates freeze uses. HTML/text sources live under `templates/`. Look and shell match Basic + logo (Nunito, `#3869D4` CTA).

| # | Alias | TemplateId | When it sends | Variables the app fills | Postmark Tag |
| --- | --- | --- | --- | --- | --- |
| 1 | `auth-otp-v2` | `47730317` | Login OTP, brand/creator verify, social-sync **verify** OTP, team-accept OTP | `name`, `otp`, `expires_in_minutes` | `auth-otp` |
| 2 | `password-reset-v2` | `47730338` | Forgot password | `name`, `reset_url`, `expires_in_minutes` | `password-reset` |
| 3 | `team-invite-v2` | `47822341` | Brand **settings** invite + Creator **settings** invite | `brand_name`, `invited_role`, `expires_at`, `acceptance_url` | `team-invite` |
| 4 | `notification-default-v2` | `47822367` | Every brand notification email (billing, escrow, campaigns, …) | `name`, `title`, `body`, `action_url`, `event_type` | same as `event_type` (e.g. `billing.trial_expired`) |

Links:

- [Auth OTP v2](https://account.postmarkapp.com/servers/15113300/templates/47730317)
- [Password reset v2](https://account.postmarkapp.com/servers/15113300/templates/47730338)
- [Team invite v2](https://account.postmarkapp.com/servers/15113300/templates/47822341)
- [Notification default v2](https://account.postmarkapp.com/servers/15113300/templates/47822367)

### What each shell looks like in the inbox

**OTP** — subject includes the code; body shows Hi {{name}}, the OTP, expiry minutes.  
**Password reset** — reset button/link with expiry.  
**Team invite** — workspace name, role, accept link, expiry.  
**Notification default** — subject = `{{title}}`; body is Hi {{name}}, then `{{body}}`, then an **Open** button to `{{action_url}}`. Footer still shows `Event: {{event_type}}` for ops matching.

---

## 2. Why one notification template (not 29 separate ones)

Freeze has ~29 notification **events**. They all share the same layout keys: greeting, title, paragraph, button, deep link. Only the **words** change.

| Approach | Pros | Cons |
| --- | --- | --- |
| **One `notification-default-v2` + code `title`/`body` (current)** | One place to fix branding; copy changes ship with BE deploy; no 29 env IDs | Postmark “by template” stats are one bucket |
| Separate Postmark template per event | Template-level stats in Postmark UI | 29 near-identical shells; every wording change is a Postmark republish |

**Monitoring without separate templates**

- Postmark **Tag** + **Metadata** `event_type` on every send (e.g. `escrow.funding_credited`) — filter Activity by tag after sending is unpaused.
- App DB: `notification_jobs.event_type` + `notification_email_deliveries` status / `provider_message_id` / `last_error` — landed vs failed per event.

Optional later: set `POSTMARK_TEMPLATE_<EVENT>` to a dedicated TemplateId if one event needs a different layout (invoice table, no button). Until then those env keys stay empty and fall back to `POSTMARK_NOTIFICATION_DEFAULT_TEMPLATE_ID`.

---

## 3. Why simple text for `title` / `body`

The notification template is a **shell**. Product sentences live in Nest, not in Postmark HTML, because:

1. **Same contract for all events** — channel always sends `name`, `title`, `body`, `action_url`, `event_type`.
2. **Copy ships with code** — no Postmark edit to fix “trial expired” wording; unpause + deploy is enough for live mail.
3. **Optional extras stay in code** — e.g. partial intelligence, unresolved return amount, Razorpay setup reason — appended only when the payload has them.
4. **Preferences still apply** — brand Settings “optional email” toggles gate OPTIONAL events; MANDATORY (payment failed, trial expired, access revoked, …) still send.

In-app notification titles stay on the event registry (`notification-event-registry.ts`). Email reuses those titles and adds the paragraph from `notification-email-copy.ts`.

---

## 4. What message will be sent (notification catalog)

Subject line = **Title**. Body paragraph = **Body** (plus optional detail when noted).

**Open button / page link:** every notification email includes `action_url` = `APP_FRONTEND_URL` + the **Page (deep link)** below. Placeholders like `{campaign_id}` are filled from the event payload at send time. Prod frontend base is typically `https://dashboard.thecreatorshop.in`.

Paths below match current freeze FE routes (or the closest mounted page when a more specific screen does not exist yet). Query params are only kept when the UI actually reads them (Payouts detail, Collaborations thread, Integrations Instagram tab).

Email policy: **MANDATORY** always emails when the event fires; **OPTIONAL** emails unless the user turned that category off in brand email preferences.

### Billing & subscription (Razorpay)

| Event | Policy | Title | Body | Page (deep link) |
| --- | --- | --- | --- | --- |
| `billing.subscription_payment_failed` | MANDATORY | Subscription payment failed | Your subscription payment could not be collected. Update your payment method to keep this workspace active. | `/brand/settings/billing` |
| `billing.subscription_payment_recovered` | OPTIONAL | Subscription payment recovered | Your subscription payment succeeded and the plan is active again. | `/brand/settings/billing` |
| `billing.trial_expired` | MANDATORY | Trial expired | Your trial has ended. Choose a plan in billing to keep using The Creator Shop. | `/brand/settings/billing` |
| `billing.subscription_halted` | MANDATORY | Subscription halted | Your subscription is halted because payment is still outstanding. Update billing to restore access. | `/brand/settings/billing` |
| `billing.cancellation_scheduled` | MANDATORY | Cancellation scheduled | Your subscription is set to cancel at the end of the current period. You can reactivate it from billing. | `/brand/settings/billing` |
| `billing.cancellation_effective` | MANDATORY | Cancellation effective | Your subscription has ended. Resubscribe from billing to restore this workspace. | `/brand/settings/billing` |
| `billing.cancellation_reactivated` | MANDATORY | Subscription reactivated | Your subscription is active again. | `/brand/settings/billing` |
| `billing.invoice_ready` | OPTIONAL | Invoice ready | A new invoice is available in billing. | `/brand/settings/billing` |

### Escrow & payouts

| Event | Policy | Title | Body | Page (deep link) |
| --- | --- | --- | --- | --- |
| `escrow.funding_credited` | OPTIONAL | Escrow funding credited | Escrow funding has been credited to your workspace. Open payouts to review the balance. | `/brand/payouts` |
| `escrow.collaboration_awaiting_funds` | OPTIONAL | Collaboration awaiting funds | A collaboration is waiting for escrow funds before work can continue. Add funds or confirm the reserve. | `/brand/collaborations?thread={collaboration_id}` |
| `escrow.collaboration_refunded` | OPTIONAL | Collaboration funds refunded | Collaboration funds have been returned to escrow. | `/brand/collaborations?thread={collaboration_id}` |
| `escrow.creator_payout_action_required` | OPTIONAL | Creator payout action required | A creator payout needs your attention before it can be sent. *(may append Razorpay setup / capability reason)* | `/brand/payouts?obligation=payout-obligation:{obligation_id}` |
| `escrow.creator_payout_settled` | OPTIONAL | Creator payout settled | A creator payout has been settled. | `/brand/payouts?obligation=payout-obligation:{obligation_id}` |
| `escrow.creator_payout_reversed` | OPTIONAL | Creator payout reversed | A creator payout was reversed and needs review. *(may append “This reversal was partial.”)* | `/brand/payouts?obligation=payout-obligation:{obligation_id}` |
| `escrow.brand_return_action_required` | OPTIONAL | Brand return requires action | A brand return needs action before it can finish. Open payouts to continue. *(may append unresolved amount)* | `/brand/payouts?brand_return=brand-return:{brand_return_request_id}` |
| `escrow.brand_return_partial` | OPTIONAL | Brand return partially completed | A brand return completed only in part. Review the remaining amount in payouts. *(may append unresolved amount)* | `/brand/payouts?brand_return=brand-return:{brand_return_request_id}` |
| `escrow.brand_return_completed` | OPTIONAL | Brand return completed | A brand return has completed. | `/brand/payouts?brand_return=brand-return:{brand_return_request_id}` |
| `payouts.reserve_approval_required` | OPTIONAL | Financial reserve approval required | A financial reserve needs approval before payouts can proceed. | `/brand/payouts` |
| `payouts.creator_setup_blocking` | OPTIONAL | Creator setup is blocking payment | Creator payout setup is incomplete, so this payment cannot be sent yet. *(may append Razorpay setup reason)* | `/brand/payouts?obligation=payout-obligation:{obligation_id}` |
| `payouts.provider_action_required` | OPTIONAL | Payment action required | Razorpay needs action before this creator payment can continue. | `/brand/payouts?obligation=payout-obligation:{obligation_id}` |
| `payouts.transfer_failed_or_reconciliation_required` | OPTIONAL | Creator payment requires review | A creator payment failed or needs reconciliation. Open payouts to review it. | `/brand/payouts?obligation=payout-obligation:{obligation_id}` |

### Campaigns, collaborations, intelligence, team, integrations

| Event | Policy | Title | Body | Page (deep link) |
| --- | --- | --- | --- | --- |
| `campaigns.application_received` | OPTIONAL | Campaign application received | A creator has applied to a campaign. Open applications to review it. | `/brand/uce/campaigns/{campaign_id}` *(closest — no separate applications route)* |
| `campaigns.application_approved` | OPTIONAL *(creator in-app; email policy on registry — creator scope does not enqueue email today)* | Application approved | Your campaign application was approved. | `/creator/campaigns/applications/{application_id}` |
| `campaigns.application_rejected` | OPTIONAL *(same — creator scope, no email enqueue today)* | Application rejected | Your campaign application was not approved. | `/creator/campaigns/applications/{application_id}` |
| `collaborations.media_submitted_for_review` | OPTIONAL | Media submitted for review | New collaboration media is ready for review. | `/brand/collaborations?thread={collaboration_id}` |
| `intelligence.execution_completed` | OPTIONAL | Brand Intelligence execution completed | A Brand Intelligence run has finished. Open intelligence to view the results. *(may append partial-results note)* | `/brand-centre` |
| `intelligence.execution_failed` | OPTIONAL | Brand Intelligence execution failed | A Brand Intelligence run failed. Open intelligence to retry or inspect the error. | `/brand-centre` |
| `team.member_access_revoked` | MANDATORY | Brand workspace access revoked | Your access to this brand workspace has been removed. If this is unexpected, contact the brand owner. | `/login` |
| `integration.instagram_token_expired` | OPTIONAL | Instagram connection expired | The Instagram connection for this brand has expired. Reconnect it under integrations. | `/brand/settings/integrations?tab=instagram` |

### Auth / invite (separate templates — not the catalog above)

| Mail | Template | Example content | Page / link |
| --- | --- | --- | --- |
| OTP | `auth-otp-v2` | Hi {{name}}, your code is {{otp}}, valid {{expires_in_minutes}} minutes | No app deep link (code only) |
| Password reset | `password-reset-v2` | Hi {{name}}, reset link {{reset_url}}, expires in {{expires_in_minutes}} minutes | `/reset-password#token=…` |
| Team invite | `team-invite-v2` | Join {{brand_name}} as {{invited_role}}; accept {{acceptance_url}}; expires {{expires_at}} | `/brand/team-invitations/accept#token=…` or `/creator/team-invitations/accept#token=…` |

---

## 5. How to verify when sending is unpaused

1. Unpause sending on Postmark server `thecreatorshop`.
2. Prefer a **single** probe (one notification or one OTP), then check Activity for MessageID + Tag — not a 29-mail flood while paused.
3. Optional: `scripts/postmark-send-notification-copy-preview.ts` sends all notification bodies for copy review (target address is in the script). Confirm Activity shows rows before trusting the inbox.
4. Live journeys (OTP, reset, team invite) stay separate full click-throughs after deploy.

---

## 6. Related files

| Path | Role |
| --- | --- |
| `register.md` | Alias ↔ TemplateId ↔ env |
| `template-design-system.md` | Visual tokens |
| `templates/*-v2.{html,txt}` | Published HTML/text |
| `src/features/notifications/config/notification-email-copy.ts` | Title/body strings |
| `src/features/notifications/config/notification-event-registry.ts` | Titles, deep links, email policy |
| `src/mail/mail.service.ts` | Sends + Tags |
| `src/features/notifications/services/notification-channel.service.ts` | Builds model for default template |
