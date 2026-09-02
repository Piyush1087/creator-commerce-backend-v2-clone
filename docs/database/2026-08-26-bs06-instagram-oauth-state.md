# BS-06: Instagram Settings OAuth state

Base: `program/brand-settings-mvp` at
`9f3fccfcdd3c85af38288ae1a9566b1b203aa657` (fetched and verified before changes).

## Migration review

`prisma/migrations/20260826190000_brand_instagram_oauth_state/migration.sql`
is additive and follows `20260826180000_data_extraction_wave2_supported_capabilities`.
It adds `brand_instagram_oauth_states`, with cascading Brand/User foreign
keys, a unique state hash, expiry/consumption index and foreign-key indexes.
Existing migration files and persisted encrypted token values are unchanged.
The same migration adds three staging fields to `brand_integrations`: encrypted
pending access token, pending scopes and pending token expiry. These repair the
concrete reconnect identity defect below without rewriting existing credentials.
No production migration is run. Deploy this migration before the new backend;
deploy the frontend callback contract with that backend. Handshakes started by
the old implementation must be restarted. No compatibility bypass is allowed.

## Security boundary

`BrandInstagramOAuthStateService` creates 32 random bytes (256 bits), encoded as
43 base64url characters. Only a SHA-256 hex digest is persisted. A raw state is
returned only inside the provider authorize URL, never as a redundant response
field. The OAuth-start response is `Cache-Control: no-store`.

Attempts bind the explicit authorized Brand, authenticated initiating user and
exact redirect URI. TTL is ten minutes. Redirects must be HTTP(S), without
embedded credentials or fragments; the existing provider configuration remains
responsible for registered redirect allowlisting. Provider scopes are unchanged.

After the existing active-membership resolution, one conditional database UPDATE
matches the digest, Brand, user, redirect, unconsumed status and future expiry.
Exactly one affected row authorizes exchange. PostgreSQL locks/rechecks competing
updates; there is no read-then-write gap. Consumption commits before provider I/O.
Failure after consumption, including exchange failure, burns the attempt. Restart
OAuth to recover. Expired/consumed rows may be retained for operational retention;
there is no new cleanup scheduler. Raw state and provider tokens are never logged
by the new service. Production request logging must continue to redact OAuth query
and request bodies; do not enable request-payload logging for these endpoints.

## Preserved lifecycle and bounded corrections

Existing AES-256-GCM field encryption, scope mapping, provider client calls and
token expiry persistence remain. Reconnect starts a new attempt. Disconnect and
credential removal retain the active-campaign interlock. The compatibility enum
`DELETE_INGESTED_DATA` remains, but its response reports disconnection, credential
removal, stopped future ingestion and retained history; it never reports a purge.
No remote revocation API or historical-data deletion is introduced.

Security regression inspection found active reconnect conflicts previously put
the newly staged token into an active connection under the old canonical handle.
BOUNDED_CORRECTION: mismatched credentials now use the three pending fields, with
the same encryption utility. Existing active credentials, scopes, expiry and
status remain intact. `OVERWRITE_HANDLE` promotes the staged values atomically
with the canonical handle update; `CANCEL_CONNECT` clears pending fields and
preserves the old active connection. A first-time conflict remains disconnected.
Disconnect/credential removal clears both active and pending credentials under
the existing campaign interlock. Legacy unresolved conflicts must restart OAuth
after deployment; existing encrypted token values are never rewritten. There is
no canonical-handle authority redesign or generic credential store.

The existing daily scheduler is retained, with an explicit diagnostic job name.
No additional `ScheduleModule.forRoot()` or scheduler provider is registered.
BOUNDED_CORRECTION: the expiry sweep targets Instagram only, and rechecks active
status/expiry in its conditional write so it cannot overwrite a concurrent new
connection. Meta functionality and automatic refresh remain deferred.

## Validation

The PostgreSQL suite uses only a disposable loopback database whose name begins
`bs06_`. Provider calls are faked and external network is denied. It exercises
state issuance, all required rejection cases, concurrent replay, burned failures,
encryption/scopes, identities, lifecycle, membership, cross-Brand access and expiry.
The compiled smoke script boots the actual `AppModule` (not an alternate scheduler
bootstrap), replaces external provider clients, discovers the running named daily
job and fires its registered callback against PostgreSQL. HTTP uses the real JWT
guard and Zod validation pipeline. The active-campaign interlock test fakes only
the campaign count; it does not create or modify campaign product behavior.

Configuration references only: `INSTAGRAM_API_ID`, `INSTAGRAM_APP_SECRET`,
`INSTAGRAM_GRAPH_API_VERSION`, `EXTERNAL_API_TIMEOUT_MS`,
`SETTINGS_FIELD_ENCRYPTION_KEY`. No provider configuration values are included.
No generic provider framework, token refresh, Meta provider, Intelligence,
Data Extraction, financial, Team policy or OTP remediation is part of BS-06.

## Existing schema drift (outside BS-06)

The current migration chain applies successfully. A full Prisma migration/schema
diff is not empty at the required base: it proposes index renames on Creator
Co-Pilot, Gatekeeper and campaign-creators tables; unique indexes on Creator
public slug and User Google subject; removal of a shipping-address index; a
Discovery expiry timestamp precision change; and removal of the existing
`uce_campaigns.canonical_definition` and `creation_source` columns. These are
baseline differences, not BS-06 changes. Comparing the deployed DB against both
the exact base schema and this branch isolates the BS-06 additions. None of the
out-of-scope diff SQL is applied. The BS-06 table and staging fields have no drift.

## Recorded self-validation

- `npm run prisma:generate`, `npx prisma validate`, `npx prisma migrate deploy`
  and `npx prisma migrate status`: passed on a fresh disposable PostgreSQL 16
  database; all 50 migrations applied and status is up to date.
- `BS06_DATABASE_TEST=true` with `npx vitest run --config vitest.config.ts
  src/features/brand-settings --maxWorkers=1 --minWorkers=1`: 29 BS-06 tests and
  37 existing policy tests passed. The separate opt-in suites were subsequently
  run explicitly on disposable clones of the same deployed chain.
- `BS02_DATABASE_TEST=true` with `npx vitest run --config vitest.config.ts
  src/features/brand-settings/team --maxWorkers=1 --minWorkers=1`: 115 passed
  (78 PostgreSQL + 37 policy).
- `BRAND_WORKSPACE_DATABASE_TEST=true` with `npx vitest run --config vitest.config.ts
  src/features/brand-centre/brand-workspace-authorization.postgres.test.ts
  --maxWorkers=1 --minWorkers=1`: 10 passed. Overall: 154 distinct backend tests.
- `npm run build`, `npx tsc -p scripts/tsconfig.bs06.json`, scoped ESLint on
  the changed TypeScript files and `git diff --check`: passed.
- `node scripts/smoke-bs06-instagram.cjs`: 11 HTTP/scheduler checks passed
  against the final schema and compiled actual AppModule.
- Full migration/schema drift was compared with the exact required base. The
  final unrelated diff is identical to the earlier baseline drift; BS-06 adds
  no drift. No diff-generated SQL was applied.

The first attempt at migration deploy returned an empty schema-engine error;
retry succeeded. The finalized migration was then applied successfully from
scratch to a second disposable database, not edited in an existing program DB.
