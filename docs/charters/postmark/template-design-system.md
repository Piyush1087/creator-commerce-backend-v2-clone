# Postmark email template design system

**Status:** TBD (living — update here before restyling templates)  
**Scope:** Transactional HTML/text under `docs/charters/postmark/templates/`  
**Charter:** `postmark_template_ai_worker_charter.md`

When visual style changes, edit **this file first**, then update template sources
and republish Postmark `*-v2` templates. Do not invent one-off colors in a
single template.

## Brand

| Token | Value |
| --- | --- |
| Product name | The Creator Shop |
| Default from | `no-reply@thecreatorshop.in` |
| Voice | Direct, calm, no hype. One job per email. |

## Color

| Token | Hex | Use |
| --- | --- | --- |
| `--mail-bg` | `#f3f1ec` | Page / outer background |
| `--mail-surface` | `#ffffff` | Content card |
| `--mail-border` | `#e4e0d8` | Card border |
| `--mail-ink` | `#111111` | Headlines, primary CTA fill |
| `--mail-body` | `#333333` | Body copy |
| `--mail-muted` | `#6b665c` | Fine print, fallback links |
| `--mail-eyebrow` | `#5c574e` | Brand eyebrow |
| `--mail-on-ink` | `#ffffff` | Text on primary CTA / OTP block |

Avoid purple gradients, glow, and decorative sticker overlays.

## Typography

| Role | Stack | Size / weight |
| --- | --- | --- |
| Brand eyebrow | Georgia, Times New Roman, serif | 13px, uppercase, letter-spacing `0.08em` |
| Headline | Georgia, Times New Roman, serif | 24px, line-height 1.3 |
| Body | Arial, Helvetica, sans-serif | 16px, line-height 1.5 |
| Fine print | Arial, Helvetica, sans-serif | 12–13px, line-height 1.5 |
| OTP code | Courier New, Courier, monospace | 28px, letter-spacing `0.28em` |
| CTA label | Arial, Helvetica, sans-serif | 15px |

Email clients are unreliable with webfonts — stick to these stacks.

## Layout shell

1. Full-width outer table, padding `32px 16px`, background `--mail-bg`.
2. Centered card, `max-width: 520px`, `--mail-surface`, `1px solid --mail-border`.
3. Card padding rhythm: brand `28px 28px 8px` → headline `8px 28px 0` → body
   `16px/12px 28px 0` → primary action `28px` → footer `0 28px 28px`.
4. One headline, one short body, one primary action (code or button). No cards
   inside cards, no stat strips, no hero imagery for auth mail.

## Components

### Brand eyebrow

Uppercase product name in `--mail-eyebrow` at top of card.

### Primary button (links)

Inline-block link: padding `14px 24px`, background `--mail-ink`, color
`--mail-on-ink`, no border-radius required, no shadow. Always include a
plaintext fallback URL below for clients that strip buttons.

### OTP code block

Centered inline-block: padding `14px 28px`, background `--mail-ink`, color
`--mail-on-ink`, monospace OTP. Never put the code only in an image.

### Subject lines

Short, specific, include the variable that helps triage when useful
(e.g. OTP in subject). No emoji.

## Text / plaintext

Every HTML template has a matching `.txt` with the same mustache keys, same
order of information, and the raw URL when a button is used.

## Naming (see charter)

New published templates use alias + display name **`-v2` / `v2`** so legacy
Postmark templates stay untouched.

## Change process

1. Update tokens/rules in this file.
2. Update `templates/<alias>-v2.{html,txt}` to match.
3. Upsert Postmark alias `<scenario>-v2` only (never overwrite legacy aliases).
4. Validate render; update `register.md`.
