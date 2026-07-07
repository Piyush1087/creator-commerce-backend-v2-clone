# Creator Side — UI Testing (Onboarding + Centre)

One place to test the creator journey: public onboarding funnel, then authenticated centre screens.

**Display rule:** Any UI field without backend data shows **`-`** so missing APIs stay visible.

---

## Start servers

**Terminal 1 — backend**

```bash
cd D:\Work\cursor-repos\creator-commerce-backend-v2
npm run db:migrate:deploy
npm run start:dev
```

**Terminal 2 — frontend**

```bash
cd D:\Work\cursor-repos\creator-commerce-frontend-v2
npm run dev
```

Open: **http://localhost:5173**

---

## Two testing modes

### A. Full onboarding (new creator)

Needs `GEMINI_API_KEY` for approved handles + unique email + Meta OAuth for connect/sync.

Follow: [Onboarding UI Testing](../creator-onboarding/UI_TESTING.md)

### B. Centre only (fast)

```bash
cd creator-commerce-backend-v2
npm run db:seed:dev-creator
```

Login at `/login`: **test@creator.com** / OTP **123456**

Then test centre routes below.

---

## Centre routes (API wired)

| Screen | URL | Primary APIs |
|--------|-----|--------------|
| Command Center (home) | `/creator/home` | settings profile, media-kit, analytics pulse, campaigns workspace |
| Analytics | `/creator/analytics` | `GET /api/v1/creator-centre/analytics/pulse` |
| Media Kit | `/creator/media-kit` | `GET` + `PATCH /api/v1/creator-centre/media-kit` |
| Campaigns | `/creator/campaigns` | `GET /api/v1/creator/campaigns/workspace` |
| Campaign history | `/creator/campaigns/history` | `GET /api/v1/creator/campaigns/history?page=1&limit=15` |
| Marketplace | `/creator/marketplace` | `GET /api/v1/creator/marketplace/campaigns` |

Detail: [Centre & Campaigns UI Testing](./UI_TESTING.md)

---

## Chat walkthrough (copy into Cursor while testing)

Use this as a checklist you can paste back to the agent if something breaks.

```
I'm testing creator side locally.

Servers:
- Backend http://localhost:3000 (npm run start:dev)
- Frontend http://localhost:5173 (npm run dev)

=== ONBOARDING ===
1. Open /creator/onboarding
2. Enter handle @mytesthandle → See if I'm Eligible
   - Approved → /creator/onboarding/modules
   - Waitlisted → join waitlist with email
3. Select modules → Build My Workspace
4. Signup: new email + password → OTP 123456
5. Connect: Meta OAuth or paste dev code
6. Sync: wait for track status AI_ENGINE_SYNCED → /creator/home

=== CENTRE (or login test@creator.com / 123456) ===
7. /creator/home — KPIs, active campaigns, panic banner
8. /creator/analytics — pulse table; CTR/Campaign columns should be -
9. /creator/media-kit — edit bio/rates, Save, Copy link
10. /creator/campaigns — active/pending tabs, phase columns
11. /creator/campaigns/history — pagination

Rule: empty/missing API fields must show "-" not blank.
```

---

## What to verify in DevTools → Network

### Onboarding (public unless noted)

| Call | When |
|------|------|
| `POST .../creator-onboarding/handle-check` | Landing CTA |
| `POST .../creator-onboarding/waitlist` | Waitlisted email |
| `POST .../creator-onboarding/stage-features` | Modules continue |
| `POST .../creator-onboarding/signup` | Create account |
| `POST .../creator-onboarding/verify-otp` | OTP step → sets auth |
| `POST .../creator-onboarding/meta-connect` | IG connect (Bearer) |
| `POST .../creator-onboarding/activate-sync` | Sync page (Bearer) |
| `GET .../creator-onboarding/track/:id` | Sync poll |

### Centre (Bearer required)

| Call | When |
|------|------|
| `GET .../creator/settings/profile` | Home greeting |
| `GET .../creator-centre/media-kit` | Home + media kit |
| `PATCH .../creator-centre/media-kit` | Save media kit |
| `GET .../creator-centre/analytics/pulse` | Home + analytics |
| `GET .../creator/campaigns/workspace` | Home + campaigns |
| `GET .../creator/campaigns/history` | History page |

---

## Common failures

| Symptom | Likely cause |
|---------|----------------|
| Always waitlisted on landing | Missing/invalid `GEMINI_API_KEY` |
| Signup 400 “Complete module staging” | Skipped modules step |
| OTP fails | Wrong code; set `CREATOR_VERIFICATION_USE_REAL_OTP=false` for `123456` |
| Meta connect 400 | `INSTAGRAM_API_ID` / `INSTAGRAM_APP_SECRET` placeholders |
| Sync error on mount | Connect step skipped (need `META_OAUTH_SUCCESS`) |
| Centre 401 | Not logged in; complete OTP or use seeded login |
| Empty tables | Normal for new account — UI should show `-` |

---

## Doc index

| Doc | Scope |
|-----|-------|
| [UI_TESTING.md](./UI_TESTING.md) | Centre home, analytics, media kit, campaigns |
| [Onboarding UI_TESTING.md](../creator-onboarding/UI_TESTING.md) | Full funnel + curl |
| [IMPLEMENTATION_TRACKING.md](../creator-onboarding/IMPLEMENTATION_TRACKING.md) | Backend feature status |
