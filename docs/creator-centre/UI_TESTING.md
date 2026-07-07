# Creator Centre & Campaigns — UI Testing Guide

Manual QA checklist for creator centre screens and campaigns command center after API integration.

**Master guide (onboarding + centre + chat walkthrough):** [CREATOR_SIDE_UI_TESTING.md](./CREATOR_SIDE_UI_TESTING.md)

**Onboarding funnel:** [Onboarding UI Testing](../creator-onboarding/UI_TESTING.md)

**Prerequisites**

- Backend running locally (`npm run start:dev` in `creator-commerce-backend-v2`)
- Migrations applied (`npm run db:migrate:deploy`)
- Frontend running (`npm run dev` in `creator-commerce-frontend-v2`)
- Dev creator seeded: `npm run db:seed:dev-creator` in backend
- Login: `test@creator.com` / OTP `123456`

**Display rule:** UI fields without backend data must show `-` (not hidden). This marks gaps for a later backend pass.

---

## 1. Creator Home — `/creator/home`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as creator, open Command Center | Greeting uses profile `display_name` or `-` |
| 2 | Check subtitle line | Founding badge shows `-` (not in API); handle from media kit or `-` |
| 3 | KPI row | Total reach / engagement from `GET /api/v1/creator-centre/analytics/pulse`; Est. Payout shows `-` |
| 4 | Active campaigns list | Rows from `GET /api/v1/creator/campaigns/workspace` active_rows, or `-` if empty |
| 5 | Priority tasks | From `panic_panel.alerts`, or `-` if none |
| 6 | Co-pilot sidebar | First pulse `velocityLabel` + `aiPerformanceNote`; content ideas show `-` |
| 7 | Urgent banner | Appears when `panic_panel.hasUrgentAlerts` is true |

**APIs**

- `GET /api/v1/creator/settings/profile`
- `GET /api/v1/creator-centre/media-kit`
- `GET /api/v1/creator-centre/analytics/pulse?limitCount=3`
- `GET /api/v1/creator/campaigns/workspace`

---

## 2. Analytics — `/creator/analytics`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open Performance Analytics | Summary cards load from analytics pulse API |
| 2 | Reach / ER deltas | Show `-` (week-over-week not in API yet) |
| 3 | Estimated Value card | Shows `-` |
| 4 | Top Location card | From `summary.topLocation` or `-` |
| 5 | Table columns Campaign, Handle, CTR | Show `-` (mapped post fields only) |
| 6 | Post type, Velocity, AI insight | From pulse rows |
| 7 | Strategic recommendation block | Shows `-` |
| 8 | Export / date filter buttons | Disabled (not wired) |

**API:** `GET /api/v1/creator-centre/analytics/pulse?limitCount=5`

---

## 3. Media Kit — `/creator/media-kit`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Page load | `GET /api/v1/creator-centre/media-kit` populates bio, rates, theme, metrics |
| 2 | Profile Health score | Shows `-` (not in schema) |
| 3 | Checklist items | All unchecked placeholders (not in API) |
| 4 | Primary category / niche tags | Show `-` |
| 5 | Edit bio + rates, Save | `PATCH /api/v1/creator-centre/media-kit` succeeds |
| 6 | Copy Profile Link | Copies `publicLink` when slug exists |
| 7 | Preview Profile / Work with Me | Disabled (`-` capability) |
| 8 | Improve with AI | Disabled |

**APIs**

- `GET /api/v1/creator-centre/media-kit`
- `PATCH /api/v1/creator-centre/media-kit`
- Public read: `GET /api/v1/public/creators/:slug/media-kit`

---

## 4. Campaigns Command Center — `/creator/campaigns`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open command center | `GET /api/v1/creator/campaigns/workspace` |
| 2 | Active / Pending tabs | Refetch with `currentView=ACTIVE_PRODUCTION` or `PENDING_APPLICATIONS` |
| 3 | Tab counts | `active_count`, `pending_count`, `completed_count` |
| 4 | Velocity alerts | From `velocity_alerts` / `panic_panel` |
| 5 | Table columns Phase, Action role, Deadline | Populated or `-` |
| 6 | View History link | Navigates to `/creator/campaigns/history` with count |
| 7 | Empty states | `-` in tables when no rows |

**Optional query params (API supported, UI filters not yet):**

- `searchQuery`, `platformFilter`, `dependencyFilter`

**Mutation APIs (Postman / future UI):**

- `POST /api/v1/creator/campaigns/invitations/claim`
- `POST /api/v1/creator/campaigns/logistics/confirm-receipt`
- `POST /api/v1/creator/campaigns/content/submit-draft`

---

## 5. Campaign History — `/creator/campaigns/history`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open history | `GET /api/v1/creator/campaigns/history?page=1&limit=15` |
| 2 | Stats row | Escrow / deliverables / match from API or `-` |
| 3 | Phase column | `current_phase` or `-` |
| 4 | Pagination | Previous / Next updates `page` query |

---

## 6. Marketplace (already integrated)

| Route | API |
|-------|-----|
| `/creator/marketplace` | `GET /api/v1/creator/marketplace/campaigns` |
| Apply flow | `POST /api/v1/creator-uce/campaigns/:id/apply` |

---

## Known UI fields still showing `-` (backend gaps)

| Screen | Field | Notes |
|--------|-------|-------|
| Home | Founding Member badge | No profile flag |
| Home | Est. Payout KPI | No escrow summary on home API |
| Home | KPI deltas (+12%) | No period comparison |
| Home | Co-pilot chat / ideas | Creator co-pilot UI not embedded on home yet |
| Analytics | CTR, Campaign, Handle columns | Stitch columns; pulse API uses post metrics |
| Analytics | Estimated value, recommendation | Not in analytics API |
| Media Kit | Health score, checklist, category, niches | Product-only fields |
| Command Center | Search / platform / dependency filters | API ready, UI controls pending |

---

## Quick curl smoke tests (with JWT)

Replace `TOKEN` with bearer from browser session after login.

```bash
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/v1/creator-centre/media-kit
curl -H "Authorization: Bearer TOKEN" "http://localhost:3000/api/v1/creator-centre/analytics/pulse?limitCount=5"
curl -H "Authorization: Bearer TOKEN" "http://localhost:3000/api/v1/creator/campaigns/workspace?currentView=ACTIVE_PRODUCTION"
curl -H "Authorization: Bearer TOKEN" "http://localhost:3000/api/v1/creator/campaigns/history?page=1&limit=15"
```
