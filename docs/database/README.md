# Backend Database

The Prisma schema starts clean on purpose. Add models only as new v2 APIs are
implemented.

## Local Database

Start local Postgres:

```bash
docker compose up -d
```

Use this local URL:

```text
postgresql://postgres:password@localhost:5432/thecreatorshop?schema=public
```

## Prisma Commands

Generate the client:

```bash
npm run prisma:generate
```

Create and apply local migrations:

```bash
npm run db:migrate:dev
```

Apply existing migrations manually to a target database:

```bash
npm run db:migrate:deploy
```

## Dev and prod RDS migrations

**Default (routine deploy):** migrations apply automatically when ECS starts the API
container after `npx sst deploy --stage dev` or `--stage prod`. The entrypoint runs `prisma migrate deploy`
when `RUN_MIGRATIONS_ON_START=true`. See
[../deployment/README.md](../deployment/README.md#default-dev-release-current-workflow) (dev) and
[../deployment/README.md](../deployment/README.md#prod-go-live) (prod).

**Fallback (jumpbox / bastion):** open the SSM tunnel, export `DATABASE_URL` to `localhost:5435`, then
run `npm run db:migrate:deploy` or `npm run db:studio`. Use when debugging migrations,
inspecting RDS directly, or if auto-migrate is disabled. Tunnel steps:
[../deployment/README.md](../deployment/README.md#fallback--dev-rds-via-jumpbox--tunnel-manual-migrate).

Review migration SQL before prod deploy — auto-migrate still applies schema changes to prod data on task start.

## Dev deploy database URL

SST supports `DEV_DATABASE_URL` for the `dev` stage. This mirrors the old repo
pattern for pointing dev deployments at a separate RDS instance.

Prod continues to use the SST Aurora resource connection unless that decision
is changed explicitly later.

## Domain notes

- `20260813-collaboration-clone-foundation.md` — eight clone Collaboration
  migrations applied locally; additive against campaign Phase 1–3.
- `brand-discovery-and-users.md` — Step 1 discovery tables plus minimal
  `User` / `Organization` model and org-linkage rules.

## Dev seed: test creator

From `creator-commerce-backend-v2`:

```bash
npm run db:seed:dev-creator
```

Creates or updates:

- User `test@creator.com` with role `CREATOR`
- Creator profile, primary bank details, default shipping address

Sign in on the frontend with that email and OTP `123456` (same stub as brand login).

For **dev RDS** seed via tunnel (optional — only if jumpbox is available):

```bash
# Tunnel open, DATABASE_URL -> localhost:5435, then:
npm run db:seed:dev-creator
```

## Migration: `brand_intelligence_scans` (Phase 4–7)

Adds the Brand Intelligence pipeline table for Checkpoint 1 → Stage 1B →
Prompt A Brand DNA:

- Enum `BrandIntelligenceStage` (`STAGE_1A_COMPLETE` …
  `STAGE_2_NEEDS_REVIEW`).
- Table `brand_intelligence_scans` with:
  - `discovery_lead_id` (unique FK → `discovery_leads`)
  - optional `brand_profile_id` FK → `brand_profiles`
  - JSON columns: `stage1a_snapshot`, `authoritative_identity`,
    `runtime_context`, `brand_dna_raw`, `brand_dna_verified_snapshot`
  - `current_stage`, `error_logs`, timestamps
- Stage 1A continues to also write `temporaryPayload.stage1a` for
  backward compatibility; readers prefer the new table.

Apply locally with `npm run db:migrate:dev` (name suggestion:
`brand_intelligence_scans`). Deploy with `npm run db:migrate:deploy`.

## Migration: `20260821120000_gatekeeper_recovery_requests`

Adds the append-only `gatekeeper_recovery_requests` table for explicit
`REQUEST_ORG_ACCESS` and `REQUEST_CLASSIFICATION_REVIEW` submissions. The table
stores requester contact, normalized domain, optional user/session and target
organization references, plus a versioned Gatekeeper decision snapshot.

Retries are idempotent per request type, Discovery Lead and normalized
requester email. Deleting a transient Discovery Lead sets its foreign key to
null so the operational request and captured Gatekeeper context remain durable.

## Migration: `20260704120000_command_center_phase_alignment`

- Command-center workspace phases on `uce_campaign_collaborations` (`current_phase`, `action_required_by_role`, `production_deadline_at`, `creator_profile_id`, `content_format_type`).
- Child registries: `uce_collaboration_logistics`, `uce_collaboration_content_drafts`, `uce_collaboration_live_telemetry`.
- Panic-panel and workspace indexes (`idx_panic_panel_evaluation`, `idx_workspace_phase_router`).
- Backfills phase columns from legacy UCE status/milestone fields.
- Apply with `npm run db:migrate:deploy`.

## Migration: `20260703140000_creator_deferred_features`

- `users.google_subject_id`, `users.email_verified_at` (Google signup).
- `creator_profiles.public_slug`, `creator_profiles.is_media_kit_public` (public media kit).
- Apply with `npm run db:migrate:deploy`.

## Migration: `20260703120000_creator_onboarding_and_centre`

- Creator onboarding (`creator_onboarding_tracks`, `ip_validation_limits`, `email_otp_verifications`).
- Creator centre (`user_profiles`, `historic_chat_threads`, `metric_post_pulses`).
- Creator co-pilot tables (`creator_co_pilot_*`).
- Re-adds `users.hashed_password` for creator signup.
- Extends `creator_social_integrations` with global Instagram ID uniqueness.
- Apply with `npm run db:migrate:deploy` (preferred when shadow DB replay fails).

## Migration: `20260604120000_collaboration_module`

- Renames `UserRole` value `INFLUENCER` → `CREATOR`.
- Adds unified collaboration workflow tables and creator profile prerequisites.
- Apply with `npm run db:migrate:deploy` (preferred when shadow DB replay fails).

## Migration: `20260515120000_product_surface_scan_alignment`

Adds product-aligned surface-scan fields:

- `brand_profiles.social_links` (`TEXT[]`, default empty) — IG/TikTok (etc.)
  URLs from Prompt 1.
- `brand_profiles.surface_offers` (`JSONB`, nullable) — banner offers / coupon
  hints from Prompt 2.
- `offerings.category_tag` — collection or healthcare specialty label.
- `offerings.starting_price_label` — visible list price string before deep
  scan fills `price_amount`.
