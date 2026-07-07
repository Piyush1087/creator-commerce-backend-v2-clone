# Creator Onboarding — UI Testing Guide

Manual QA for the public onboarding funnel at `/creator/onboarding/*`. APIs are wired in the v2 frontend.

**See also:** [Creator Side UI Testing (master)](../creator-centre/CREATOR_SIDE_UI_TESTING.md) for centre screens and a copy-paste chat walkthrough.

---

## Prerequisites

| Item | Command / value |
|------|-----------------|
| Backend | `npm run start:dev` in `creator-commerce-backend-v2` |
| Migrations | `npm run db:migrate:deploy` |
| Frontend | `npm run dev` in `creator-commerce-frontend-v2` |
| Base URL | `http://localhost:5173` |
| API | `http://localhost:3000` (or Vite proxy) |

### Backend env (approved handle path)

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Handle eligibility via Gemini (without it, handles are **waitlisted**) |
| `CREATOR_VERIFICATION_USE_REAL_OTP` | `false` → stub OTP `123456` in dev |
| `INSTAGRAM_API_ID` / `INSTAGRAM_APP_SECRET` | Meta OAuth on connect step |
| `SETTINGS_FIELD_ENCRYPTION_KEY` | IG token encryption |

### Frontend env (optional)

| Variable | Purpose |
|----------|---------|
| `VITE_INSTAGRAM_API_ID` | Launch “Connect with Instagram” OAuth button |

**Display rule:** UI fields without API data show `-` (not hidden).

---

## Funnel map

| Step | Route | API |
|------|-------|-----|
| 1 Landing | `/creator/onboarding` | `POST /api/v1/creator-onboarding/handle-check` |
| 1b Waitlist | same (inline) | `POST /api/v1/creator-onboarding/waitlist` |
| 2 Modules | `/creator/onboarding/modules` | `POST /api/v1/creator-onboarding/stage-features` |
| 3 Signup | `/creator/onboarding/signup` | `POST /api/v1/creator-onboarding/signup` |
| 3b OTP | same (inline) | `POST /api/v1/creator-onboarding/verify-otp` → JWT stored |
| 4 Meta connect | `/creator/onboarding/connect` | `POST /api/v1/creator-onboarding/meta-connect` (auth) |
| 5 Workspace sync | `/creator/onboarding/sync` | `POST /api/v1/creator-onboarding/activate-sync` + `GET .../track/:id` poll |
| 6 Home | `/creator/home` | Centre APIs — [UI_TESTING.md](../creator-centre/UI_TESTING.md) |

---

## Step-by-step UI checks

### 1. Landing — handle eligibility

1. Open `http://localhost:5173/creator/onboarding`
2. Enter a unique handle (e.g. `newcreator_july5`)
3. Click **See if I'm Eligible**

**Approved path** (needs `GEMINI_API_KEY`):

- Navigates to `/creator/onboarding/modules`
- `sessionStorage` has `creator_onboarding_track_id` and `creator_onboarding_handle`

**Waitlisted path** (no Gemini or low score):

- Inline waitlist card appears
- Enter email → **Join Waitlist** → success copy
- Eligibility score in UI shows `-` (not returned on waitlist submit)

**Errors:** IP cap (5 checks) → error alert with API message.

---

### 2. Module selection

1. Toggle modules; click **Build My Workspace →**
2. Network: `POST stage-features` with `onboardingTrackId` + mapped modules:
   - `brand_deals` → `MESSY_DMS_TO_DEALS`
   - `media_kit` → `BUILDING_UPDATING_MEDIA_KIT`
   - `performance` → `POST_PERFORMANCE_PRICING`
   - `payments` → `CONTRACT_ESCROW_SECURITY`
3. Lands on signup

**Skip for now** goes to signup without staging (signup may fail until modules staged).

---

### 3. Signup + OTP

1. Enter **new email** + password (≥6 chars)
2. Submit → OTP step appears
3. Enter `123456` (dev stub)
4. On success → JWT in local storage → `/creator/onboarding/connect`

**Google button:** disabled; label shows `-` (SDK not wired).

**Widget sidebar:** static Stitch copy (status labels not from API).

**Conflict:** reusing an existing email → error from API.

---

### 4. Meta connect

1. Must be logged in (JWT from OTP step)
2. Value-bridge copy visible; handle from session shown
3. **Connect with Instagram** — needs `VITE_INSTAGRAM_API_ID` + backend IG secrets
4. **Dev:** paste OAuth `code` + **Connect with code**
5. On success → auto-navigate to `/creator/onboarding/sync`

**UI placeholders showing `-`:**

- Multi-account picker (API returns single account)
- Fields only appear after successful connect

**Skip to dashboard:** goes to `/creator/home` without `META_OAUTH_SUCCESS` (sync step will fail if you return).

---

### 5. Workspace sync

1. `POST activate-sync` fires once on mount
2. Polls `GET /api/v1/creator-onboarding/track/:trackId` every 2s
3. **Track status** line updates (`META_OAUTH_SUCCESS` → `AI_ENGINE_SYNCED`)
4. Progress bar moves; at `AI_ENGINE_SYNCED` → redirects to `/creator/home`

**UI placeholders showing `-`:**

- AI insight preview (not on track API yet)
- Theme picker during sync
- Step list states (static Stitch steps, not driven by API)

**If connect skipped:** error “Connect Instagram before activating sync.”

---

## Fast path: test centre without full onboarding

Use seeded creator (skips onboarding):

```bash
cd creator-commerce-backend-v2
npm run db:seed:dev-creator
```

Login: `test@creator.com` / OTP `123456` at `/login` → `/creator/home`.

---

## curl smoke tests (onboarding)

```bash
# 1. Handle check
curl -X POST http://localhost:3000/api/v1/creator-onboarding/handle-check \
  -H "Content-Type: application/json" \
  -d '{"instagramHandle":"newcreator_test"}'

# 2. Stage features (replace TRACK_ID)
curl -X POST http://localhost:3000/api/v1/creator-onboarding/stage-features \
  -H "Content-Type: application/json" \
  -d '{"onboardingTrackId":"TRACK_ID","stagedModules":["BUILDING_UPDATING_MEDIA_KIT"]}'

# 3. Signup
curl -X POST http://localhost:3000/api/v1/creator-onboarding/signup \
  -H "Content-Type: application/json" \
  -d '{"onboardingTrackId":"TRACK_ID","email":"new@test.com","password":"secret12"}'

# 4. Verify OTP
curl -X POST http://localhost:3000/api/v1/creator-onboarding/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"new@test.com","otpCode":"123456"}'

# 5. Meta connect (replace TOKEN)
curl -X POST http://localhost:3000/api/v1/creator-onboarding/meta-connect \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"onboardingTrackId":"TRACK_ID","code":"OAUTH_CODE","redirectUri":"http://localhost:5173/creator/onboarding/connect"}'

# 6. Activate sync
curl -X POST http://localhost:3000/api/v1/creator-onboarding/activate-sync \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"onboardingTrackId":"TRACK_ID","userConfirmedSync":true}'

# 7. Track status
curl http://localhost:3000/api/v1/creator-onboarding/track/TRACK_ID
```

---

## Known `-` gaps (onboarding UI)

| Screen | Field | Backend gap |
|--------|-------|-------------|
| Landing | Waitlist eligibility score | Not returned on join |
| Signup | Founding badge | No profile flag |
| Signup | Google OAuth | Frontend SDK + `POST /auth/google/signin` not wired |
| Signup | Widget statuses | Static Stitch, not from `stagedModules` |
| Connect | Multi-account list | Single-account API |
| Sync | AI insight | Not on track payload |
| Sync | Theme picker | Not in activate-sync |
| Sync | Step states | Not driven by backend events |
