# Postmark email template design system

**Status:** TBD (living — update here before restyling templates)  
**Scope:** Transactional HTML/text under `docs/charters/postmark/templates/`  
**Charter:** `postmark_template_ai_worker_charter.md`  
**Visual source:** Postmark layouts `basic` / `basic-2` (Basic With Logo) used by
legacy `user-invitation` (`41019457`). v2 templates stay **self-contained**
(no Layout alias) so runtime TemplateId mail does not depend on `{{{ @content }}}`.

When visual style changes, edit **this file first**, then update template sources
and republish Postmark `*-v2` templates. Do not invent one-off colors in a
single template.

## Brand

| Token | Value |
| --- | --- |
| Product name | The Creator Shop |
| Default from | `no-reply@thecreatorshop.in` |
| Product URL | `https://thecreatorshop.in` |
| Logo | `https://stratus.campaign-image.in/images/252780000000136109_zc_v1_1759554983059_creator_shop_white_logo.png.png` (150px wide, centered masthead) |
| Footer | `© 2026 The Creator Shop. All rights reserved.` then `GrowthVerse` |
| Voice | Direct, calm, no hype. One job per email. |

## Color

| Token | Hex | Use |
| --- | --- | --- |
| `--mail-bg` | `#F2F4F6` | Page / outer background (Postmark Basic) |
| `--mail-surface` | `#FFFFFF` | Content card |
| `--mail-border` | `#EAEAEC` | Footer rule / card edges |
| `--mail-ink` | `#333333` | Headlines |
| `--mail-body` | `#51545E` | Body copy |
| `--mail-muted` | `#A8AAAF` | Footer, masthead fallback name |
| `--mail-link` | `#3869D4` | Links and primary CTA fill |
| `--mail-on-link` | `#FFFFFF` | Text on primary CTA |
| `--mail-code-bg` | `#F4F4F7` | OTP / attribute well |

Keep the Postmark Basic blue button (`#3869D4`). Do not switch v2 back to
black CTAs or cream `#f3f1ec` page background.

## Typography

| Role | Stack | Size / weight |
| --- | --- | --- |
| Body / UI | Nunito Sans, Helvetica, Arial, sans-serif | 16px, line-height 1.625 |
| Headline | same stack | 22px, bold, color `--mail-ink` |
| Fine print | same stack | 13px, `--mail-muted` |
| OTP code | Courier New, Courier, monospace | 28px, letter-spacing `0.28em` |
| CTA label | Nunito Sans, Helvetica, Arial, sans-serif | 15px, white on `--mail-link` |

## Layout shell

1. Full-width wrapper, background `--mail-bg`.
2. Centered masthead: logo 150px, link to product URL. No serif eyebrow.
3. Inner card `570px` (`100%` under 600px), `--mail-surface`, content padding `45px`.
4. One headline, short body, one primary action (button or OTP well).
5. Footer under the card: copyright + GrowthVerse.

v2 HTML inlines this shell. Do not attach Postmark Layout `basic` / `basic-2` to
runtime v2 templates (those layouts use `{{{ @content }}}` and extra mustache
keys the backend does not send).

## Components

### Logo masthead

Centered `<img>` with alt `The Creator Shop`. Always include the product name in
plaintext as well.

### Primary button (links)

Postmark Basic bordered button: background `#3869D4`, padding via 10px/18px
solid borders, `border-radius: 3px`, white label. Always include a plaintext
fallback URL below.

### OTP code block

Centered well, background `--mail-code-bg`, padding `16px`, monospace OTP.
Never put the code only in an image.

### Subject lines

Short, specific, include the variable that helps triage when useful
(e.g. OTP in subject). No emoji.

## Text / plaintext

Every HTML template has a matching `.txt` with the same mustache keys, same
order of information, the raw URL when a button is used, and the footer lines.

## Naming (see charter)

New published templates use alias + display name **`-v2` / `v2`** so legacy
Postmark templates stay untouched.

## Change process

1. Update tokens/rules in this file.
2. Update `templates/<alias>-v2.{html,txt}` to match.
3. Upsert Postmark alias `<scenario>-v2` only (never overwrite legacy aliases).
4. Validate render; update `register.md`.
