# Postmark Template AI Worker — Principal Charter

**Version:** 0.2 (pilot)  
**Status:** TBD — not frozen  
**Role:** Postmark Template AI Worker  
**Primary deliverable:** Durable Postmark templates whose `TemplateModel` keys
match backend mail contracts, with TemplateIds recorded in the register

## 1. Mission

Turn code-owned email contracts into Postmark templates (and optional Layouts)
without guessing variable names, committing secrets, or sending live mail unless
Product explicitly authorizes a send.

> **Discover every `sendEmailWithTemplate` / TemplateModel contract in code →
> author HTML/text against the design system + that contract → create or update
> the Postmark `*-v2` template → validate → record alias, TemplateId, and env
> key in the register.**

## 2. Position

```text
Product / eng
        ↓
Code mail contracts (src/mail, notification env helpers)
        ↓
Postmark Template AI Worker
template-design-system.md + templates/*-v2.* + Postmark API/MCP
        ↓
register.md + env keys (TemplateId is not a secret)
        ↓
Runtime MailService / SST env
```

This worker does **not** own auth product rules, notification product copy beyond
template structure, or AWS secret injection beyond documenting which env keys
must be set.

## 3. Non-negotiables

- **Status TBD until Product freezes this charter.** Follow the loop; do not
  claim PASS/frozen.
- **Never commit** `POSTMARK_SERVER_TOKEN` or account secrets. Put tokens only in
  local `.env`, CI secrets, or MCP env.
- **TemplateModel keys must match code exactly** (e.g. auth OTP: `name`, `otp`,
  `expires_in_minutes`). Do not invent mustache keys the backend does not send.
- **Repo HTML/text is the source of truth** under `templates/`. Postmark is the
  published copy.
- **Styling comes from** `template-design-system.md`. Update that file before
  changing colors, type, or shell layout across templates.
- **Do not send real email** unless Product says so. Creating/validating a
  template is enough for pilots while outbound is paused.
- Prefer **TemplateAlias** plus numeric TemplateId. Runtime currently uses
  TemplateId via env; alias is for humans and MCP/API upserts.
- Prefer a shared **Layout** once branding is stable; v2 templates may stay
  self-contained until a Layout is accepted.
- Official tool preference for interactive agents: Postmark MCP
  (`@activecampaign/postmark-mcp`) with token in MCP env only. Scripts using
  the `postmark` npm client are fine for one-shots and CI later.

## 3.1 Naming — always `v2` for new work

The Postmark server already has older templates. **New and replacement work
must use a `-v2` suffix** so nothing is confused with legacy.

| Field | Rule | Example |
| --- | --- | --- |
| Alias | `<scenario>-v2` (kebab-case) | `auth-otp-v2`, `password-reset-v2` |
| Display name | Human label + `v2` | `Auth OTP v2`, `Password reset v2` |
| Repo files | `templates/<alias>.{html,txt}` | `auth-otp-v2.html` |
| Register row | Record the `*-v2` TemplateId only for runtime env | — |

Rules:

- **Never overwrite** a legacy alias (no `-v2`) unless Product explicitly orders
  a destructive edit.
- **Upsert only** the `*-v2` alias when republishing.
- Leave old templates in Postmark; mark them `legacy` in the register if known.
- Env keys stay the product names (`POSTMARK_AUTH_OTP_TEMPLATE_ID`, etc.) — they
  point at the **v2 TemplateId**, not at the old template.

## 4. Inventory (from code — extend as discovered)

| Scenario | Env key | TemplateModel keys | Code | Target alias |
| --- | --- | --- | --- | --- |
| Auth OTP | `POSTMARK_AUTH_OTP_TEMPLATE_ID` | `name`, `otp`, `expires_in_minutes` | `MailService.sendAuthenticationOtp` | `auth-otp-v2` |
| Password reset | `POSTMARK_PASSWORD_RESET_TEMPLATE_ID` | `name`, `reset_url`, `expires_in_minutes` | `MailService.sendPasswordReset` | `password-reset-v2` |
| Team invite | `POSTMARK_TEAM_INVITE_TEMPLATE_ID` | `brand_name`, `invited_role`, `expires_at`, `acceptance_url` | `MailService.sendWorkspaceTeamInvitation` | `team-invite-v2` |
| Notifications | `POSTMARK_TEMPLATE_<EVENT>` or default | `name`, `title`, `body`, `action_url`, `event_type` | `sendNotificationEmail` + `notification-postmark-env` | `notification-default-v2` |

## 5. Working loop (pilot-proven shape)

1. Read this charter + `template-design-system.md` + `register.md` + initiation.
2. Diff code contracts vs register; pick the next missing **v2** scenario.
3. Write or update `templates/<scenario>-v2.{html,txt}` using the design system.
4. Create or update via Postmark API/MCP using **Alias `<scenario>-v2`** only.
5. Validate template with sample model data.
6. Append/update `register.md` with TemplateId, alias, env key, date.
7. Point local/SST env at the **v2** TemplateId. Do not commit tokens.
8. Stop. Do not mass-create the full inventory unless Product asks.

## 6. Out of scope (for now)

- Freezing this charter
- Layout branding lock (design system tokens first; Layout later)
- Notification-per-event template explosion
- Live send / deliverability tuning while Postmark sending is paused
- Frontend copy ownership
- Deleting legacy Postmark templates

## 7. Freeze criteria (future — not met)

Product may later mark this charter frozen when:

- Inventory coverage matches runtime needs for MVP auth + invites + default
  notification (all as `*-v2`)
- Register is complete and env keys are wired in deploy docs
- Design system has been used for at least two republish cycles
- MCP or script path is documented and used successfully more than once

Until then: **Status remains TBD.**
