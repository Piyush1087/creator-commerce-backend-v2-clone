# Creator onboarding + centre — implementation tracking (backend)

Living checklist for backend work aligned with `docs/creator-onboarding/product-docs/` and `docs/creator-centre/product-docs/`. UI is deferred to frontend-v2.

**Constraints (current):**

- **Prisma schema** — migrations `20260703120000_creator_onboarding_and_centre` + `20260703140000_creator_deferred_features`; apply with `npm run db:migrate:deploy`.
- **No browser cookies** for funnel continuity: state keyed by `CreatorOnboardingTrack` until JWT after OTP verify.
- **Brand Instagram OAuth** — deferred (creator-only for now).

---

## Current status (read first)

| Stream | State | Notes |
|--------|--------|--------|
| Schema + migration | **Shipped** | Onboarding, centre, co-pilot tables; `User.hashedPassword`, `googleSubjectId`; `CreatorProfile.publicSlug`. |
| Step 1 handle check | **Shipped** | Gemini eligibility + IP cap (5/IP, HTTP 429); `isExistingUserRoute` flag. |
| Step 2 feature staging | **Shipped** | `POST stage-features` → `ActivatedModule[]` on track. |
| Step 3 signup + OTP | **Shipped** | Password (scrypt) or Google; OTP stub `123456` or Postmark when toggled. |
| Step 4 Meta OAuth | **Shipped** | Short→long token exchange; personal/duplicate Meta ID blocks. |
| Step 5 AI activation | **Shipped** | IG media + **Insights API** → `MetricPostPulse`; welcome co-pilot thread. |
| Step 6–7 centre | **Shipped** | Media kit GET/PATCH; analytics pulse; public link helper. |
| Public media kit | **Shipped** | `GET /api/v1/public/creators/:slug/media-kit` (mirrors brand `public/brands`). |
| Creator co-pilot | **Shipped** | Gemini + HITL media-kit writes + SSE streaming + slot fill. |
| Google signup | **Shipped** | `POST /api/v1/auth/google/signin` with `idToken` + optional `onboardingTrackId`. |
| Password login | **Shipped** | `POST /api/v1/auth/login` with `email` + `password` (creators only). |
| Real OTP email | **Shipped** | `CREATOR_VERIFICATION_USE_REAL_OTP=true` → Postmark (same template as brand). |
| IG insights | **Shipped** | Per-post `/{media-id}/insights` in activation sync (falls back to 0 if scope missing). |

**Next up (when UI lands):** contract tests, IG token refresh worker, live Gemini token streaming (SSE currently chunks completed narrative).

---

## Implemented API — onboarding funnel

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/v1/creator-onboarding/handle-check` | Public | Gemini handle eligibility. |
| `POST` | `/api/v1/creator-onboarding/stage-features` | Public | Module pre-selection. |
| `POST` | `/api/v1/creator-onboarding/signup` | Public | Email + password signup; sends OTP. |
| `POST` | `/api/v1/creator-onboarding/verify-otp` | Public | Verify email → JWT. |
| `POST` | `/api/v1/creator-onboarding/meta-connect` | JWT | Instagram OAuth. |
| `POST` | `/api/v1/creator-onboarding/activate-sync` | JWT | **202** — background AI sync. |
| `GET` | `/api/v1/creator-onboarding/track/:trackId` | Public | Poll funnel status. |
| `POST` | `/api/v1/creator-onboarding/waitlist` | Public | Waitlist for ineligible handles. |

---

## Implemented API — auth (creator)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/auth/login` | Email + OTP `123456` **or** email + `password` (creator). Optional `role: CREATOR`. |
| `POST` | `/api/v1/auth/google/signin` | Google ID token; optional `onboardingTrackId` for new signup. |
| `GET` | `/api/v1/auth/me` | Bearer JWT → current user. |

**Env:** `GOOGLE_CLIENT_ID`, `JWT_SECRET_DEV` / `JWT_SECRET_PROD`, `CREATOR_VERIFICATION_USE_REAL_OTP`, `POSTMARK_SERVER_TOKEN`, `POSTMARK_OTP_TEMPLATE_ID`.

---

## Implemented API — public shareable links

| Audience | Method | Path | Notes |
|----------|--------|------|--------|
| Brand | `GET` | `/api/v1/public/brands/:slug` | Slug from domain (`acme-com`). Already wired in `PublicBrandModule`. |
| Creator | `GET` | `/api/v1/public/creators/:slug/media-kit` | Slug from IG handle (`chef-insights`). `PublicCreatorModule`. |
| Creator (auth) | `GET` | `/api/v1/creator-centre/media-kit/public-link` | Returns `publicSlug`, `publicPath`, `isMediaKitPublic`. |

`publicSlug` assigned at email/Google signup; backfilled on AI sync if missing.

---

## Implemented API — creator centre

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/creator-centre/media-kit` | JWT |
| `GET` | `/api/v1/creator-centre/media-kit/public-link` | JWT |
| `PATCH` | `/api/v1/creator-centre/media-kit` | JWT |
| `GET` | `/api/v1/creator-centre/analytics/pulse?limitCount=` | JWT |

---

## Implemented API — creator co-pilot

Base: `/api/v1/creator/co-pilot` (JWT).

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/usage` | Monthly cap snapshot. |
| `POST` | `/threads` | Create thread. |
| `GET` | `/threads` | List threads. |
| `GET` | `/threads/:threadId` | Thread + messages. |
| `PATCH` | `/threads/:threadId` | Rename / archive. |
| `POST` | `/threads/:threadId/messages` | Post message (`slotValues` optional). |
| `POST` | `/threads/:threadId/messages/stream` | SSE (`narrative_delta`, `done`). |
| `POST` | `/hitl/confirm` | Confirm staged Media Kit write. |
| `POST` | `/hitl/discard` | Discard staged write. |
| `POST` | `/messages/:messageId/feedback` | Thumbs up/down. |

HITL intent: `MEDIA_KIT_UPDATE` → confirms via `PATCH /api/v1/creator-centre/media-kit`.

---

## Local dev quick test

1. `docker compose up -d` + `npm run db:migrate:deploy`
2. Env: `GEMINI_API_KEY`, `INSTAGRAM_*`, `SETTINGS_FIELD_ENCRYPTION_KEY`, optional `GOOGLE_CLIENT_ID`
3. Funnel: handle-check → stage-features → signup → verify-otp → meta-connect → activate-sync
4. Public kit: `GET /api/v1/public/creators/{slug}/media-kit` (no auth)
5. Return login: `POST /api/v1/auth/login` with `{ email, password }` or OTP `123456`

---

## Product source of truth

| Area | Location |
|------|-----------|
| Onboarding steps 1–7 | `docs/creator-onboarding/product-docs/` |
| Centre | `docs/creator-centre/product-docs/` |
| DB migrations | `prisma/migrations/20260703120000_*`, `20260703140000_*` |
| Brand public pattern | `src/features/public-brand/` |
