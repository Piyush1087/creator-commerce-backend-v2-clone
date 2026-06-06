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

## Dev Deploy Override

SST supports `DEV_DATABASE_URL` for the `dev` stage. This mirrors the old repo
pattern for pointing dev deployments at a separate RDS/t4g-style database.

Prod continues to use the SST Aurora resource connection unless that decision
is changed explicitly later.

## Domain notes

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

For **dev RDS**, point `DATABASE_URL` at the tunnel target, then run the same command once (ops — not on container startup).

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
