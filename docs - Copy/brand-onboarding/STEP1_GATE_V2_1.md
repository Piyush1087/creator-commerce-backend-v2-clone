# Step 1 early gate (v2.1) — engineering spec

Aligned with `docs/product-team-docs/brand-onboarding/changes.md`. **Deep scan is not implemented**; this covers **surface scan through login** only.

## Outcomes (`POST /api/v1/discovery/resolve` and `validate`)

Priority order:

1. **URL blocked** — invalid/social/private TLD (validate also writes intel rows).
2. **`org_claimed`** — `isVerified` + `organizationId` + at least one `User` on org.
3. **`brand_active`** — `isVerified` and caller is not the owning user (no JWT match on `verificationEmail` / org).
4. **`verification_required`** — domain or IP vendor-scan count **> 5** in rolling **7 days** (unverified profile only).
5. **`resume`** — unverified profile, `scanStatus = SURFACE_COMPLETE`, `createdAt` within **7 days**, discovery lead exists.
6. **`proceed`** / **`success`** — new funnel entry.

`resolve` does **not** return brand names, taglines, or preview payloads (privacy).

## Surface scan enforcement

`POST /api/v1/brand/surface-scan` runs the same gate before vendor work.

- **Cache hits** (`mode: cached`) do **not** increment counters and skip vendor gate limits for new spend.
- **Vendor runs** insert `surface_scan_attempts` (`SURFACE_VENDOR`).

HTTP **403** body uses the same `outcome` shapes for `brand_active`, `org_claimed`, `verification_required`.

## Rate limits

| Env | Behavior |
|-----|----------|
| `STAGE=local` | Counters **off** (unless `BRAND_SCAN_LIMITS_ENABLED=true`) |
| `STAGE=dev` / `prod` | Counters **on** |

Config: `BRAND_SCAN_LIMITS_ENABLED`, `BRAND_SCAN_LIMIT_WINDOW_DAYS` (7), `BRAND_SCAN_LIMIT_MAX_PER_WINDOW` (5).

Nest throttler (requests/min) remains separate from scan counters.

## Purge

Daily cron (03:00 server time) deletes **unverified** `BrandProfile` rows with **no** `organizationId` older than **7 days** (cascade children).

Manual: inject `BrandOnboardingPurgeService` or call `purgeStaleUnverifiedBrandProfiles()` from a script.

## Auth continuity

Optional `Authorization: Bearer` on `resolve`, `validate`, and `surface-scan`. Matching owner can continue past `brand_active` (same email as `verificationEmail` or org member).

## Deferred

- Deep intel scan / worker
- `GET /api/v1/brands/check-availability` (logic lives on `resolve`)
- Redis IP counters (DB counts today)
- Registrable-domain (eTLD+1) collapse beyond `www` strip
