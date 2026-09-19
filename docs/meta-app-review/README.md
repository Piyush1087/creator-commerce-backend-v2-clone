# Meta App Review — Instagram Creator Marketplace

**Goal:** Advanced Access for Creator Marketplace discovery, on a submission Meta will approve.  
**Not the goal:** status updates, dashboard tinkering, or submitting yet.

App for this track: **creator marketplace API 2** (`1718441312765233`)  
Dashboard: https://developers.facebook.com/apps/1718441312765233/  
Do **not** submit until the product + hygiene bars in this pack are met.

This pack is intentionally thorough. Vet and trim later; do not drop URLs or eligibility nuances without checking Meta docs first.

| File | Use |
| --- | --- |
| [requirements.md](./requirements.md) | What Meta tests; product bar; token chain; rejection matrix |
| [instagram-vs-facebook.md](./instagram-vs-facebook.md) | Instagram Creator Marketplace vs Facebook Creator Discovery |
| [brand-eligibility.md](./brand-eligibility.md) | Creator Marketing Hub vs API — Page + Professional IG rules |
| [permissions.md](./permissions.md) | Five permissions, allowed usage, screencast bar, what to exclude |
| [api-reference.md](./api-reference.md) | Endpoints, filters, insights, rate limits, errors |
| [screencast-and-media.md](./screencast-and-media.md) | Screenshot / screen-recording checklist for App Review |
| [non-technical.md](./non-technical.md) | BV, legal URLs, reviewer accounts, ops (non-eng) |
| [application-steps.md](./application-steps.md) | Exact App Review form sections — collect answers, do not Submit |
| [sources.md](./sources.md) | Official Meta / Instagram URLs (source of truth for links) |
| [older_docs/](./older_docs/ARCHIVE.md) | Previous track (The Creator Shop `1180027506417007`) |

## How we work

1. **MCP first** — inspect this app (settings, review requirements, privileges). Never apply / submit from MCP.
2. **Product must pass review** — Meta rejects incomplete apps, missing screencasts, extra permissions, and login they cannot find. Build the real brand discovery surface before any submit.
3. **Form last** — fill [application-steps.md](./application-steps.md) only when product, hygiene, and a successful ICM API call exist. Then submit once.

## Hard rules

- This track is **Instagram Creator Marketplace**, not Facebook Creator Discovery. Separate permissions, ToS, screencasts. See [instagram-vs-facebook.md](./instagram-vs-facebook.md).
- Request only the five ICM Facebook Login permissions. No `ads_management`, messaging, or “might need later.”
- Use `instagram_creator_marketplace_discovery`, not `instagram_creator_marketplace`.
- Hub help text may say Professional **or** Page. **API requires Page + linked Professional IG.** Do not disconnect the Page for the brand we use in product / review. See [brand-eligibility.md](./brand-eligibility.md).
- Reviewer tests **our publicly reachable product**, not Graph Explorer.
- Fake Facebook accounts → entire submission rejected.
- Do not switch this app to Live before Advanced Access is approved.

## MCP snapshot (2026-09-19)

App: `creator marketplace API 2` / `1718441312765233`

| Check | Result |
| --- | --- |
| App type | Business |
| Mode | Development |
| Review status | `NO_SUBMISSION` (never submitted) |
| `can_submit` | true (form can open; does **not** mean ready) |
| Privacy policy | missing |
| Business verification | fails |
| Privileges / requested Advanced | empty at last MCP read (Standard Access permissions were added in dashboard after) |

Re-check with Meta MCP before any submit; do not treat this table as live forever.
