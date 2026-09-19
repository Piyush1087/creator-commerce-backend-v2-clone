# Postmark email templates

Quick guide for anyone who needs to find, check, or ask for a transactional email template. Technical worker rules live in the charter files; this page is the human overview.

## What this is

We send auth and product emails through **Postmark**. The app does not hardcode HTML — it sends a **TemplateId** plus variables (name, OTP, reset link, etc.). Templates live in Postmark; a copy of the HTML/text also lives in this folder so we can version and update them safely.

## Where to look in Postmark

1. Open [Postmark](https://account.postmarkapp.com/) and sign in.
2. Open server **thecreatorshop**.
3. Go to **Templates**.
4. Prefer names ending in **v2** (for example `Auth OTP v2`). Older templates without `v2` are legacy — leave them alone unless product says otherwise.

Direct links (current v2 runtime templates):

| Email | Alias | Open in Postmark |
| --- | --- | --- |
| Login / verification OTP | `auth-otp-v2` | [Open](https://account.postmarkapp.com/servers/15113300/templates/47730317) |
| Password reset | `password-reset-v2` | [Open](https://account.postmarkapp.com/servers/15113300/templates/47730338) |
| Team invite | `team-invite-v2` | [Open](https://account.postmarkapp.com/servers/15113300/templates/47822341) |
| Notification (default) | `notification-default-v2` | [Open](https://account.postmarkapp.com/servers/15113300/templates/47822367) |

In the editor, use **Preview** with sample values. We usually do **not** send a real test email while sending is paused.

## What “v2” means

The server already had older templates. New work is published as **`something-v2`** so we never confuse new designs with old ones, and so we do not overwrite legacy templates by accident.

v2 HTML is **self-contained**: it inlines the Postmark Basic shell (logo masthead, 570px card, Nunito, blue CTA) instead of attaching Layout `basic` / `basic-2`. Visual source is legacy `user-invitation` (`41019457`).

Runtime env vars (for example `POSTMARK_AUTH_OTP_TEMPLATE_ID`) should point at the **v2** TemplateId listed in `register.md`.

## Files in this folder

| File / folder | Who cares | Purpose |
| --- | --- | --- |
| `README.md` | Everyone | This overview |
| `templates-and-notification-messages.md` | Product + eng | Four templates, why one notification shell, full title/body catalog |
| `register.md` | Devs / ops | Alias ↔ TemplateId ↔ env var map |
| `template-design-system.md` | Design + anyone changing look | Colors, fonts, layout rules for all new templates |
| `templates/` | Devs | HTML + plaintext sources we publish to Postmark |
| `postmark_template_ai_worker_charter.md` | Agents / advanced | Full working rules (status **TBD**, not frozen) |
| `postmark_template_ai_worker_initiation.md` | Agents | Short kickoff prompt for the worker |

## How a change usually works

1. Agree the email still matches what the **backend** sends (variable names matter).
2. If the look changes, update `template-design-system.md` first.
3. Edit the matching file under `templates/` (always `*-v2`).
4. Publish to Postmark under the same `*-v2` alias (create or update).
5. Update `register.md` if the TemplateId changed.
6. Point local / deploy env at that TemplateId.

Non-devs: if you only need copy or design tweaks, say which email (OTP, password reset, …) and whether it is visual or wording — eng can publish the v2 template from there.

## Secrets

- **TemplateIds** are fine to share in docs and tickets.
- **Server API tokens** are secrets. They belong in local `.env`, CI, or password managers — never in git or screenshots of env files.

## Status

This Postmark setup is a **pilot** (charter status TBD). Process can still change; the register and v2 naming are the current source of truth for what the app should use.
