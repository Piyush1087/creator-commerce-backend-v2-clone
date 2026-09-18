# Postmark template register

**Charter status:** TBD (not frozen)  
**Naming:** Runtime templates use **`*-v2` aliases only** (see charter §3.1)  
**Design system:** `template-design-system.md`  
**Server:** `thecreatorshop` (`15113300`) — token lives outside git  
**From (auth):** `no-reply@thecreatorshop.in` via `POSTMARK_AUTH_FROM`

TemplateIds are safe to record. Server tokens are not.

## Runtime (v2)

| Alias | Name | Env key | TemplateId | Layout | Model keys | Updated | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `auth-otp-v2` | Auth OTP v2 | `POSTMARK_AUTH_OTP_TEMPLATE_ID` | `47730317` | none | `name`, `otp`, `expires_in_minutes` | 2026-09-13 | Validate OK |
| `password-reset-v2` | Password reset v2 | `POSTMARK_PASSWORD_RESET_TEMPLATE_ID` | `47730338` | none | `name`, `reset_url`, `expires_in_minutes` | 2026-09-13 | Validate OK; does not edit legacy `password-reset` |
| `team-invite-v2` | Team invite v2 | `POSTMARK_TEAM_INVITE_TEMPLATE_ID` | `47822341` | none | `brand_name`, `invited_role`, `expires_at`, `acceptance_url` | 2026-09-18 | Validate OK |
| `notification-default-v2` | Notification default v2 | `POSTMARK_NOTIFICATION_DEFAULT_TEMPLATE_ID` | `47822367` | none | `name`, `title`, `body`, `action_url`, `event_type` | 2026-09-18 | Validate OK; per-event `POSTMARK_TEMPLATE_*` may override |

## Legacy (do not overwrite)

| Alias / name | TemplateId | Notes |
| --- | --- | --- |
| `auth-otp` (pilot, pre-suffix) | `47730333` | Superseded by `auth-otp-v2`; leave in Postmark |
| `password-reset` | `38645456` | Pre-existing; briefly edited during pilot — prefer `password-reset-v2` for runtime |

## Verify in Postmark UI

- Auth OTP v2: https://account.postmarkapp.com/servers/15113300/templates/47730317
- Password reset v2: https://account.postmarkapp.com/servers/15113300/templates/47730338
- Team invite v2: https://account.postmarkapp.com/servers/15113300/templates/47822341
- Notification default v2: https://account.postmarkapp.com/servers/15113300/templates/47822367

## MCP setup (optional)

Cursor MCP config example (token only in local MCP env / user settings, never in git):

```json
{
  "mcpServers": {
    "postmark": {
      "command": "npx",
      "args": ["-y", "@activecampaign/postmark-mcp"],
      "env": {
        "POSTMARK_SERVER_TOKEN": "set-in-local-mcp-env-only"
      }
    }
  }
}
```

## Pilot log

| Date | Action | Result |
| --- | --- | --- |
| 2026-09-13 | Charter scaffold + auth-otp pilot | Created pre-suffix `auth-otp` `47730333` |
| 2026-09-13 | password-reset upsert | Briefly updated legacy `password-reset` `38645456` |
| 2026-09-13 | Naming + design system | Charter v0.2: always `*-v2`; added `template-design-system.md` |
| 2026-09-13 | Publish v2 pair | Created `auth-otp-v2` `47730317`, `password-reset-v2` `47730338` |
| 2026-09-18 | Publish invite + notification default | Created `team-invite-v2` `47822341`, `notification-default-v2` `47822367` |
