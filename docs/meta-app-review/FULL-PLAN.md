# Meta Creator Marketplace — plan

Single source of truth for the clean ICM App Review track.  
Other files in this folder are **supporting detail only** (don’t duplicate decisions here).

Last updated: **2026-09-18**

---

## Goal

Advanced Access for Instagram Creator Marketplace discovery on app  
**The Creator Shop** (`1180027506417007`), so brands can search creators in our product.

Review later on **prod**. Local test first when we eng.

---

## Decisions

| Topic | Decision |
| --- | --- |
| Connect in our app | `/brand/settings/integrations` (Instagram / Meta connect) |
| Discovery UI in our app | **Real product surface when we build it** — not a throwaway “ICM demo” page. Exact route TBD with Product (sidebar search or Integrations-adjacent). |
| Preferred Meta brand for testing | **Growth Verse** Page — link Professional IG + portfolio BV, then Marketplace ToS. Prefer over TCS ICM Test / Pura Milk. |
| Current Explorer-ready brand | **TCS ICM Test** only (has IG). Use for auth plumbing until Growth Verse is linked. |
| Business portfolio verification | **Required** for Suite Creator marketing + reliable non-empty discovery. **Deferred** (cannot do now). |
| Permissions (this review) | ICM five only (Facebook Login / brand). Creator Instagram Login insights already approved — **brand-only** screencasts. |
| App Review hygiene | Data deletion page, verify contact email, update privacy/terms — before submit |
| Environments | Local (ngrok) → dev → prod (review) |

---

## Permissions

Detail: [permissions.md](./permissions.md)

**This App Review submit (brand / Facebook Login — ICM only):**

```text
instagram_creator_marketplace_discovery
instagram_basic
pages_show_list
pages_manage_metadata
business_management
```

**Not in this submit:** `pages_read_engagement`, `instagram_manage_insights`, `ads_management`.  
Creator Instagram Login insights already approved — no re-demo.

Creator cards (photo, bio, followers, etc.) come from ICM discovery fields, not Page engagement.

---

## Where we are (Meta)

Detail: [current-test-assets.md](./current-test-assets.md)

- Brian’s FB user + Pages via `/me/accounts` (after Page grant in Login)
- Only **TCS ICM Test** has linked IG → ICM API callable → **`data: []`** with paging `MAZDZD` (all query variants) — **confirmed**, not a scope bug
- Growth Verse / Pura Milk / Test Page 1303 — **no IG** yet (Pura Milk also missing `MANAGE` on last tasks snapshot)
- Creator marketing missing or blocked pending connect/BV → portfolio **Business verification** deferred
- Brand ≠ creator: **1,000 followers** is for creators joining Marketplace, not for brands discovering

---

## Blockers → how to solve

Step-by-step how-to: [brand-meta-setup.md](./brand-meta-setup.md) · BV: [business-verification.md](./business-verification.md)

| # | Blocker (what we hit) | Solve |
| --- | --- | --- |
| 1 | No Facebook **Page** (only personal profile) | Create Page → Admin on that Page |
| 2 | `/me/accounts` empty though Pages exist | Regenerate Explorer token → **tick Pages** in Login dialog → include `pages_show_list` |
| 3 | Page listed but no `instagram_business_account` (Growth Verse today) | Convert IG to Professional → **link IG ↔ Page** in Business Suite / Page settings / Accounts Center → re-run `/me/accounts` |
| 4 | No **Creator marketing** in Business Suite | Complete **portfolio Business verification** → put Page+IG on that verified portfolio → All tools → Creator marketing |
| 5 | Creator marketing visible first time | **Get started** → **Agree** Marketplace / Hub ToS |
| 6 | ICM API `data: []` (no error) | Fix 4–5 first; retry `creator_marketplace_creators` with Page token. Auth alone is not enough for inventory. |
| 7 | ICM error “brand eligibility” (#10) | Brand not eligible / ToS / wrong asset — check Suite eligibility; try Growth Verse under verified portfolio |
| 8 | No discovery UI in **our** product | Eng later: real search surface (not throwaway demo) + Integrations connect |
| 9 | App Review media / hygiene | Screencasts + data deletion URL + verify email + privacy/terms — phases 3–4 |

**Ordered unlock (ops):** Page → link Professional IG → portfolio BV → Creator marketing ToS → non-empty API → then eng/review.

**Preferred asset path:** Growth Verse (link IG) + The Creator Shop legal entity BV — not Pura Milk unless IG linked.

## Phases

### 0 — Docs (current)

Planning pack in this folder. No eng required to continue ops thinking.

### 1 — Brand unlock (ops)

1. [Business verification](./business-verification.md) for The Creator Shop legal entity  
2. Prefer **Growth Verse**: link Professional IG → confirm `instagram_business_account` on `/me/accounts`  
3. Assets on verified portfolio → Creator marketing → Agree ToS  
4. Non-empty (or documented mock) `creator_marketplace_creators` → update current-test-assets  

### 2 — Eng (explicit go)

Connect already partly exists. Build **discovery search UI + API** on the product path Product chooses. Local ngrok with Growth Verse (or TCS until then).

### 3 — Hygiene before submit

Data deletion URL, verify `brian@thecreatorshop.in`, privacy/terms on prod, OAuth redirects.

### 4 — Screencast + App Review

[screencast-checklist.md](./screencast-checklist.md) on prod → submit locked scopes only.

---

## Non-technical (summary)

Detail: [non-technical-requirements.md](./non-technical-requirements.md) · [business-verification.md](./business-verification.md)

- Portfolio BV (deferred)  
- Privacy / terms / data deletion / contact email  
- Reviewer test pack: our brand login + FB user + Page + IG  

---

## Supporting files (no duplicate plan text)

| File | Only this |
| --- | --- |
| [permissions.md](./permissions.md) | Permission definitions |
| [business-verification.md](./business-verification.md) | BV docs + timeline |
| [current-test-assets.md](./current-test-assets.md) | Explorer `/me` + API results |
| [app-snapshot.md](./app-snapshot.md) | MCP App Dashboard settings |
| [screencast-checklist.md](./screencast-checklist.md) | Recording pack |
| [non-technical-requirements.md](./non-technical-requirements.md) | Ops checklist |
| [brand-meta-setup.md](./brand-meta-setup.md) | Page/IG/BV how-to |
| [explorer-runbook.md](./explorer-runbook.md) | Graph Explorer commands until creators `data` |
