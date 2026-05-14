# Brand discovery and platform users (v2)

This note records the first approved Prisma slice for Step 1 discovery plus a
minimal `User` / `Organization` model so role and org linkage rules are encoded
early.

## User and organization rules

- `User.role` is one of `BRAND`, `INFLUENCER`, `ADMIN`.
- `User.organizationId` is **optional**. Brand accounts are expected to attach
  to an `Organization` when the org-first model is enforced. Influencer and
  admin accounts typically remain **without** an organization; do not assume
  every user row has an org foreign key.
- This is intentionally minimal: no auth provider fields, passwords, or
  session tables yet.

## Discovery tables (product Step 1)

Aligned with the product “Brand onboarding journey” schema sketch:

- `discovery_leads` — supported submissions after triage; `normalized_url` is
  unique; optional `user_id` when a session is authenticated later.
- `market_intelligence_logs` — unsupported, invalid, or blocked attempts;
  `domain_name` is **unique** so we can upsert and increment `attempt_count`.
- `waitlist_leads` — captures email interest; links to either a discovery lead
  or a market intelligence row (both FKs optional at DB level; application must
  enforce “at least one” when the waitlist endpoint ships).

## Enums

- `IndustryVertical` — single enum combining supported, regret, and blocked
  verticals (matches product gatekeeper lists).
- `MarketIntelRejectionType` — `UNSUPPORTED_NICHE`, `GARBAGE_ENTRY`,
  `BLOCKED_PLATFORM`, `SECURITY_RISK`.
- `DiscoveryLeadStatus` — `PENDING`, `VALIDATING`, `IDENTIFIED`, `REJECTED`
  (status progression reserved for async classifiers later).

## Migration

Initial migration folder:

- `prisma/migrations/20260514180000_init_discovery_and_users/`

Apply locally after review:

```bash
npm run db:migrate:dev
```

**Troubleshooting:** If `migrate dev` fails on the shadow DB with
`syntax error at or near ""`, check that `migration.sql` is **UTF-8 without a
BOM**. PowerShell `Out-File -Encoding utf8` writes a BOM by default; use
`Utf8Encoding` with `$false` for BOM or save the file from an editor that writes
UTF-8 no BOM.
