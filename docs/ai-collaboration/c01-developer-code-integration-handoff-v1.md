# C01_DEVELOPER_CODE_INTEGRATION_HANDOFF_V1

## Status

`COMPLETE`

This handoff transfers the accepted C-01 — Creator Entry & Onboarding implementation from the canonical clone repositories to the human developer responsible for integrating it into the actual production application repository/runtime.

This document is a **code integration handoff**. It is not authorization to provision AWS, run production migrations, deploy production, or modify Meta configuration.

---

## 1. C-01 Product summary

C-01 establishes the minimum canonical Creator Entry journey:

```text
ENTRY
→ shared Creator Shop SIGN UP / SIGN IN
→ verified authenticated Creator account
→ mandatory Professional Instagram connection
→ CREATOR_WORKSPACE_ENTRY
```

Campaign-origin journey:

```text
PUBLIC CAMPAIGN
→ explicit Apply intent
→ durable Campaign continuation
→ shared signup/signin
→ mandatory Professional Instagram
→ RETURN_TO_ORIGINATING_CAMPAIGN
```

`RETURN_TO_ORIGINATING_CAMPAIGN` does **not** automatically create or submit a Campaign Application.

Frozen Product rules:

- Instagram is provider identity/capability, not Creator Shop authentication.
- No Instagram handle pre-check is authoritative.
- No global Creator follower threshold or admission filter.
- No waitlist in C-01.
- Instagram cannot be skipped before normal Creator product access.
- Insights is not a platform-entry gate.
- One normalized email participates in one canonical Organization.
- An active Brand account is not converted into a Creator account and does not receive a second Organization.
- An authenticated Creator may remain onboarding-incomplete.
- Creator Intelligence is not C-01 completion authority.
- Creator Settings section-level Product policy is outside C-01.
- `CREATOR_WORKSPACE_ENTRY` is the Product handoff; current `/creator/home` routing is only the present frontend target and does not freeze the future Creator Home/Centre Product architecture.

---

## 2. Accepted source checkpoints

### Backend clone

Repository:

`Piyush1087/creator-commerce-backend-v2-clone`

Accepted source checkpoint:

`3ec01751d28cfa60840ecf97d95c706f94c3dec9`

Accepted source branch:

`c01/i7-joint-runtime-acceptance`

### Frontend clone

Repository:

`Piyush1087/creator-commerce-frontend-v2-clone`

Accepted source checkpoint:

`b50c36fd4b99b6e0ec0718291d794d7a58353f4c`

Accepted source branch:

`c01/i7-joint-runtime-acceptance`

### Clone integration branch

Both repositories used:

`c01/integration-development-closeout`

The accepted sources were strict descendants of the pre-integration clone `development` heads, so C-01 integration was a normal fast-forward with no Product/architecture conflict and no three-way merge.

Final clone `development` SHAs are recorded in `C01_MODULE_CLOSEOUT_V1` and must be used as the clone-side handoff authority.

---

## 3. Major behavior changes

### Account/authentication

C-01 retires the legacy Creator onboarding account authority and reuses the shared BS-12 authentication/session system.

Supported Creator registration paths:

- password registration;
- email OTP verification;
- Google registration through the shared Google verifier/session system.

Existing-account sign-in remains shared platform sign-in.

Account conflict behavior:

- existing active Brand account → `ACCOUNT_CONTEXT_CONFLICT`;
- no role conversion;
- no second Organization;
- malformed Creator context → fail closed with `CONTEXT_RECOVERY_REQUIRED`.

### Creator context

Verified Creator provisioning atomically establishes the canonical Creator organization context:

- `User`;
- `Organization(kind=CREATOR)`;
- `CreatorProfile`;
- one canonical `CreatorWorkspace`;
- exactly one active OWNER seat.

A provisional Creator does not own canonical Organization/Profile/Workspace authority before verification.

### Instagram

Creator Instagram is backend-owned provider OAuth using the shared provider OAuth transaction engine.

The backend controls:

- redirect URI;
- OAuth state;
- stable Instagram Professional identity;
- encrypted access-token persistence;
- Basic authorization capability;
- Insights capability;
- authorization health;
- reconnect/revalidate/refresh/disconnect continuity;
- generation and credential-version fencing.

Frontend must never generate security OAuth state or submit a redirect URI.

### Platform capability

Normal Creator product access depends on backend `canEnterCreatorPlatform`.

Current accepted formula:

```text
canonical active Creator
AND stable Instagram identity CONNECTED
AND Basic authorization AVAILABLE
AND authorization health USABLE
```

Insights does not gate entry.

### Campaign continuation

Generic public Campaign Apply-origin onboarding uses a server-side continuation row and a short-lived host-only HttpOnly cookie reference.

The browser does not receive the raw continuation token in JSON and JavaScript does not store it.

The backend owns:

- Campaign relationship;
- User binding;
- expiry;
- consumption;
- one-time/idempotent return semantics.

No arbitrary return URL is stored.

No automatic Application, CampaignCreator, Collaboration, applicant aggregate, or `CREATOR_APPLIED` audit event is created by C-01.

---

## 4. Exact C-01 migrations

C-01 introduced exactly these four migrations:

1. `prisma/migrations/20260908120000_c01_i1_organization_workspace_foundation/migration.sql`
2. `prisma/migrations/20260908121000_c01_i1_provider_oauth_transaction/migration.sql`
3. `prisma/migrations/20260908122000_c01_i1_creator_provider_health/migration.sql`
4. `prisma/migrations/20260908123000_c01_i1_campaign_continuation/migration.sql`

Do not rename or reorder these migration identifiers. Their timestamp-looking prefixes are accepted migration-order identifiers, not wall-clock assertions.

Migration count at C-01 acceptance: `70` total repository migrations.

### Migration 1 — organization/workspace foundation

Creates/reconciles the Creator Organization boundary, including:

- `OrganizationKind` = `BRAND | CREATOR`;
- `organizations.kind`;
- `creator_workspaces.organization_id`;
- unique Creator workspace per Organization;
- active OWNER-seat invariants;
- Brand/Creator Organization guards;
- User/CreatorProfile/Workspace organization consistency guards;
- deterministic reconciliation only where historical evidence is unambiguous;
- hard failures for ambiguous identity/ownership/provider state.

### Migration 2 — shared provider OAuth transactions

Promotes the prior Brand Instagram OAuth-state table into shared `provider_oauth_transactions`, adds Creator subject support, provider/subject enums, Creator-profile foreign key, subject-shape constraints, and generation fencing.

### Migration 3 — Creator provider health

Adds Creator provider continuity state to `creator_social_integrations`, including:

- token issued/refreshed timestamps;
- authorization generation;
- credential version;
- authorization health/reason;
- Basic capability;
- Insights capability;
- last validation timestamp;
- disconnect timestamp;
- consistency checks/indexes.

### Migration 4 — Campaign continuation

Creates `creator_entry_continuations` with:

- digest-only opaque-token persistence;
- Campaign FK;
- optional bound User FK;
- expiry and consumption timestamps;
- immutable Campaign/token/intent/bound-identity authority trigger.

---

## 5. Backend modules/services/routes

### Primary C-01 backend module

`src/features/creator-entry/`

Principal files/services:

- `creator-entry.module.ts`
- `creator-entry.controller.ts`
- `creator-entry-registration.service.ts`
- `creator-entry-provisioning.service.ts`
- `creator-entry-state.service.ts`
- `creator-canonical-context.service.ts`
- `creator-instagram-authority.ts`
- `creator-instagram-connection.service.ts`
- `creator-instagram-continuity.service.ts`
- `creator-instagram-token-refresh.service.ts`
- `creator-instagram-token-refresh.scheduler.ts`
- `creator-platform-access.guard.ts`
- `creator-entry-continuation.store.ts`
- `creator-campaign-apply-continuation.service.ts`
- `creator-campaign-apply-continuation-cookie.util.ts`
- `dto/creator-entry.dto.ts`

### Creator Entry routes

Registration/auth facade:

- `POST /api/v1/creator-entry/register/password`
- `POST /api/v1/creator-entry/register/email/otp/request`
- `POST /api/v1/creator-entry/register/email/otp/verify`
- `POST /api/v1/creator-entry/register/google`

State:

- `GET /api/v1/creator-entry/state`

Instagram initial connection:

- `POST /api/v1/creator-entry/instagram/authorize`
- `POST /api/v1/creator-entry/instagram/complete`

Instagram continuity:

- `POST /api/v1/creator-entry/instagram/revalidate`
- `POST /api/v1/creator-entry/instagram/reconnect/authorize`
- `POST /api/v1/creator-entry/instagram/reconnect/complete`

Campaign continuation:

- `GET /api/v1/creator-entry/campaign-apply/continuation/status` — public boolean presence only
- `POST /api/v1/creator-entry/campaign-apply/continuation/discard` — public cookie clear only
- `POST /api/v1/creator-entry/campaign-apply/continuation/resolve` — shared JWT required, bodyless, cookie-backed

### Public Campaign continuation issuance

Under `src/features/creator-marketplace/`:

- `public-marketplace.controller.ts`
- `services/campaign-apply-continuation-issuance.service.ts`

Route:

- `POST /api/v1/public/marketplace/campaigns/:campaignId/apply-continuation`

The public Campaign must resolve as valid public Campaign authority before continuation issuance.

### Shared authentication files materially reconciled

C-01 depends on the accepted shared-auth stack, notably:

- `src/features/auth/auth.controller.ts`
- `auth.service.ts`
- `auth-session.service.ts`
- `auth-cookie.util.ts`
- `email-otp.service.ts`
- `google-auth.service.ts`
- `password-reset.service.ts`
- JWT config/strategy and shared auth DTOs.

Do not recreate a Creator-specific JWT/session stack.

### Legacy Creator onboarding

`src/features/creator-onboarding/` backend HTTP authority was retired from canonical C-01 behavior. Compatibility endpoints must not regain Product authority.

---

## 6. Frontend architecture/routes

Primary C-01 frontend area:

`src/features/creator-onboarding/`

Principal files:

- `api/creator-entry-client.ts`
- `contracts/creator-entry.contracts.ts`
- `components/creator-entry-view.tsx`
- `components/creator-platform-route-guard.tsx`
- `utils/creator-entry-oauth-session.ts`
- `creator-entry-architecture.test.ts`
- `creator-settings-guard-scope.test.ts`

OAuth callback:

- `src/pages/creator/onboarding/creator-instagram-oauth-callback-page.tsx`

Routing:

- `src/routes/app-routes.tsx`
- `src/routes/creator-onboarding-app.tsx`

Shared auth/navigation:

- `src/shared/auth/*`
- `src/features/auth/*`
- `src/shared/api/authenticated-fetch.ts`
- `src/shared/navigation/safe-internal-path.ts`

Campaign CTA:

- `src/features/creator-campaigns/components/CampaignDetailWorkspace.tsx`

### Canonical Creator Entry route

`/creator/onboarding`

Legacy onboarding subpaths redirect into the state-driven orchestrator.

### Canonical Meta callback

`/creator-marketplace/callback`

`/integrate-instagram` is compatibility-only and must not become the canonical callback authority.

### Frontend platform guard

`RequireCreatorPlatformAccess` consumes backend `canEnterCreatorPlatform`.

Normal Creator product routes are guarded, including current Creator Home/Centre, analytics, media kit, Marketplace, Campaigns, Collaborations, and product Payouts.

Creator Settings remains inside shared authentication but outside the blanket C-01 platform guard:

- `/creator/settings/profile`
- `/creator/settings/social`
- `/creator/settings/payouts`

Do not invent new Settings access policy during production integration.

---

## 7. Shared-auth/session implications

C-01 assumes the accepted shared authentication architecture is integrated as a unit.

Important invariants:

- access token is in frontend memory;
- refresh token uses HttpOnly cookie transport;
- authenticated fetch refreshes once on 401 and retries once;
- Creator registration OTP verification/Google registration adopt the shared `AuthSession`;
- existing login, email code, Google sign-in, password recovery/change and logout remain shared platform behavior;
- `location.state.from` and other externally influenced internal return destinations pass through the accepted allowlisted internal-navigation resolver.

Do not copy only `creator-entry` while leaving the old auth implementation in the target production repository.

---

## 8. Creator organization/schema implications

Production code must use the accepted Prisma schema and migration chain together.

Core schema authority:

- `User.normalizedEmail` remains canonical normalized identity key;
- `User.organizationId` expresses single Organization participation;
- `Organization.kind` distinguishes Brand vs Creator;
- active Creator has a canonical CreatorProfile;
- CreatorWorkspace is tied one-to-one to Creator Organization;
- owner profile/User/Organization consistency is database guarded;
- active OWNER seat is unique per workspace;
- provider identity is globally stable by `(platformNetwork, nativePlatformUserId)`;
- typed Instagram username is metadata, not provider identity.

Do not manually bypass database invariants in application integration.

---

## 9. Instagram/provider architecture

### Meta App authority

Accepted C-01 App A:

- App name: `The Creator Shop`
- App ID: `1180027506417007`

C-01 uses Instagram Login / Business Login for Instagram for first-party Professional Instagram accounts.

Supported account authority: Professional Business and Professional Creator.

Required platform-entry permission/capability: `instagram_business_basic`.

`instagram_business_manage_insights` is available in the accepted Meta configuration but is not an entry gate.

Facebook Login and Facebook Page linkage are not part of the C-01 first-party Instagram Login requirement.

### Stable provider identity

Backend treats the Instagram Professional `user_id` as stable provider identity. Username is mutable metadata.

### Token lifecycle

Accepted provider model supports short→long exchange, long-lived token refresh, expiry/reconnect, provider access block, transient-provider preservation, explicit disconnect and same-ID reconnect fencing.

### Token storage

Provider token material is encrypted using `SETTINGS_FIELD_ENCRYPTION_KEY`. Never log or expose provider tokens.

---

## 10. Campaign continuation architecture

Browser transport cookie:

`tcs_creator_apply_continuation`

Properties:

- HttpOnly;
- host-only;
- SameSite=Lax;
- Secure outside local/test;
- restricted to `/api/v1/creator-entry/campaign-apply/continuation`;
- bounded by original continuation expiry (24h maximum);
- shortened to a maximum 10-minute idempotency grace after READY_TO_RETURN.

Database is sole continuation authority.

Frontend observes only boolean presence before authentication and performs bodyless authenticated resolve.

Do not reintroduce:

- raw continuation token in JSON;
- localStorage/sessionStorage continuation authority;
- continuation token in URL/query;
- arbitrary return URL;
- automatic Application creation.

---

## 11. Environment/config prerequisites

Production developer must reconcile the target production application's environment with the accepted `.env.example` and SST configuration.

C-01-critical backend environment:

- `DATABASE_URL` — supplied by production database/bootstrap architecture;
- `JWT_SECRET_PROD`;
- `AUTH_OTP_PEPPER_PROD`;
- `JWT_ISSUER` where overridden;
- `JWT_AUDIENCE` where overridden;
- `POSTMARK_SERVER_TOKEN`;
- `POSTMARK_AUTH_OTP_TEMPLATE_ID`;
- `POSTMARK_PASSWORD_RESET_TEMPLATE_ID`;
- `POSTMARK_AUTH_FROM`;
- `POSTMARK_AUTH_MESSAGE_STREAM`;
- `INSTAGRAM_API_ID`;
- `INSTAGRAM_APP_SECRET`;
- `CREATOR_INSTAGRAM_REDIRECT_URI`;
- `SETTINGS_FIELD_ENCRYPTION_KEY` — 32-byte base64 secret expected by accepted encryption code;
- `GOOGLE_CLIENT_ID` if Google Creator registration is enabled;
- `APP_FRONTEND_URL_PROD` or accepted default;
- `CORS_ORIGINS` if overriding accepted production dashboard origin.

Current production defaults in SST:

- frontend: `https://dashboard.thecreatorshop.in`;
- backend API: `https://api.thecreatorshop.in`;
- Creator Instagram callback: `https://dashboard.thecreatorshop.in/creator-marketplace/callback`.

Frontend production build expects:

- `VITE_API_URL=https://api.thecreatorshop.in` from SST;
- `VITE_STAGE=prod`;
- `VITE_GOOGLE_CLIENT_ID` where Google registration is enabled;
- `VITE_PUBLIC_APP_URL=https://dashboard.thecreatorshop.in`.

Never commit secret values.

---

## 12. Postmark/auth-mail requirements

Authentication challenges have no fixed-code mode; Postmark is the accepted mail provider.

At minimum production must have valid:

- `POSTMARK_SERVER_TOKEN`;
- `POSTMARK_AUTH_OTP_TEMPLATE_ID`;
- `POSTMARK_PASSWORD_RESET_TEMPLATE_ID`;
- verified `POSTMARK_AUTH_FROM` sender/domain;
- usable `POSTMARK_AUTH_MESSAGE_STREAM` (default `outbound`).

Confirm templates accept the variables used by the accepted shared-auth email services before production smoke testing.

C-01 registration and shared authentication should not be production-certified if OTP/password-reset delivery is unavailable.

---

## 13. Meta callback/config assumptions

Accepted registered Creator callbacks observed in read-only Meta audit:

- `https://dashboard.dev.thecreatorshop.in/creator-marketplace/callback`
- `https://dashboard.thecreatorshop.in/creator-marketplace/callback`

Production runtime must send the exact server-owned production callback.

Open Meta production-readiness items remain:

```text
LIVE_META_OAUTH_E2E = NOT_EXECUTED_NO_AUTHORIZED_TEST_IDENTITY
META_DEAUTHORIZATION_CALLBACK = OPEN FOLLOW UP
META_DATA_DELETION_CALLBACK = OPEN COMPLIANCE GAP
```

No developer should claim live Meta certification from the mocked-provider C-01 runtime suite.

Meta configuration changes require their own release authority.

---

## 14. Regression evidence already completed

Final C-01 I7 evidence includes:

### Backend

- `1,103` tests passed across `166` files;
- production build PASS;
- Prisma format/validate/generate PASS;
- fresh disposable PostgreSQL migration replay PASS, `0→70`;
- historical-shaped disposable fixtures PASS;
- shared auth/session regressions PASS;
- Brand Settings / Brand Instagram regressions PASS;
- Campaign/explicit Apply regressions PASS;
- Creator Entry/Instagram/continuation PostgreSQL and architecture regressions PASS;
- Brand Centre/Data Extraction/Intelligence/Offering tests included in the accepted full repository suite.

### Frontend

After bounded dependency-security remediation:

- `744` tests passed across `92` files;
- production build PASS;
- typecheck PASS;
- C-01/auth/navigation/Campaign continuation regressions PASS;
- Brand/Creator/Collaboration/PDF export/realtime regressions PASS;
- true browser viewport smoke PASS at 1440, 768 and 390px.

Frontend dependency security final classification:

`PASS_WITH_NONBLOCKING_DEBT`

No high/critical production audit finding remained after the bounded correction; residual React Router findings were moderate and locally/reachability mitigated for accepted SPA usage.

---

## 15. Developer integration order

Use this order when moving from clone code into the actual production application repository:

1. Freeze current production-repository base SHA/tag before any C-01 merge.
2. Diff production repository against final clone `development`, not only against the original C-01 feature branch.
3. Bring shared-auth/security prerequisites first if the production repository does not already contain them.
4. Bring Prisma schema and **all missing predecessor migrations in repository order**. Do not cherry-pick only the four C-01 migrations if earlier accepted migrations are absent.
5. Bring C-01 backend module, shared provider OAuth/Instagram changes, platform guards and Campaign continuation.
6. Bring C-01 frontend shared-auth/session/navigation changes.
7. Bring Creator Entry frontend state family, callback route, platform guard and Campaign CTA continuation.
8. Reconcile environment/config contracts without committing secrets.
9. Run local/disposable DB migration replay and full backend/frontend regression.
10. Only after a separately authorized AWS/database gate, determine production DB state and migration/bootstrap path.
11. Only after separate deployment authority, run production migration/deployment/smoke sequence.

Do not collapse steps 9–11.

---

## 16. Migration ordering

The accepted repository migration chain contains 70 migrations through C-01 acceptance.

C-01 migrations must sort after accepted predecessor:

`20260907120000_bs12_auth_security`

C-01 order:

```text
20260908120000_c01_i1_organization_workspace_foundation
20260908121000_c01_i1_provider_oauth_transaction
20260908122000_c01_i1_creator_provider_health
20260908123000_c01_i1_campaign_continuation
```

Before any real production migration, compare `_prisma_migrations` in the actual target database to the production repository migration set.

Do not infer migration safety from directory dates alone.

---

## 17. Production smoke-test checklist

After production bootstrap/deployment is separately authorized and completed, validate at minimum:

### Shared auth

- password login;
- email OTP login;
- refresh-cookie restoration;
- logout;
- password reset;
- Google sign-in/registration if enabled.

### Creator direct entry

- unauthenticated `/creator/onboarding`;
- password registration;
- verification email delivery;
- canonical Creator context creation;
- Instagram connect;
- callback completion;
- normal Creator product entry.

### Creator recovery

- disconnect/recovery routing;
- reconnect same provider identity;
- revalidate;
- incomplete Creator denied normal product API/routes;
- Creator Settings remains reachable according to Settings authority.

### Campaign origin

- public Campaign Apply CTA;
- HttpOnly continuation cookie issued;
- browser close/reopen recovery;
- authenticated Creator Entry continuation;
- return to originating Campaign;
- application wizard closed on return;
- no Application/CampaignCreator/Collaboration before explicit Apply.

### Responsive/accessibility

- 390px Creator Entry and callback;
- no horizontal overflow;
- form labels/alerts/focus behavior.

### Logs/security

Confirm application logs do not expose:

- OAuth code/state;
- Instagram token;
- refresh token;
- Campaign continuation reference;
- OTP/reset secrets.

---

## 18. Rollback considerations

### Code rollback

Before deployment, tag/record the previous production frontend/backend revisions.

Frontend/static code can normally be rolled back independently **only if** the previous frontend remains compatible with the migrated backend/schema.

Backend rollback after schema migration requires compatibility analysis. Do not assume the pre-C01 backend can safely run against the C-01 schema/triggers.

### Database rollback

No automatic production rollback is frozen for C-01.

Do not reverse migrations ad hoc.

The organization/workspace migration introduces constraints/triggers and may reconcile historical rows. Once applied to a non-empty database, rollback is a separately designed database operation.

For a fresh pre-launch database, the preferred failure strategy may be destroy/recreate before live data exists, but that is an AWS/bootstrap decision and is not authorized by this handoff.

### Meta rollback

C-01 production integration does not authorize Meta configuration changes, so no Meta rollback should be needed from this code merge itself.

---

## 19. Known deferred/open items

Carry forward exactly:

```text
LIVE_META_OAUTH_E2E = NOT_EXECUTED_NO_AUTHORIZED_TEST_IDENTITY
META_DEAUTHORIZATION_CALLBACK = OPEN FOLLOW UP
META_DATA_DELETION_CALLBACK = OPEN COMPLIANCE GAP
FRONTEND_DEPENDENCY_SECURITY = PASS_WITH_NONBLOCKING_DEBT
```

Additional deferred boundaries:

- actual AWS production account/database identification;
- classification of production DB as existing-with-data / fresh-empty / not-present / unresolved;
- production database bootstrap/migration authorization;
- production deployment authorization;
- live Provider OAuth validation with an explicitly authorized non-production Professional Instagram identity;
- future Creator Home/Centre Product architecture;
- Campaign identity-specific invite continuity remains Campaign-owned compatibility behavior;
- React Router 7 / remaining dev-tool major upgrades are future maintenance, not C-01 implementation blockers.

---

## 20. Critical separation of authorities

### CODE MERGE

Clone `development` integration is authorized and complete under C-01 closeout.

Integrating the accepted code into the developer's actual production application repository is a developer code task covered by this handoff.

### DATABASE PROVISIONING / MIGRATION

**NOT authorized by this handoff.**

The developer must use `C01_AWS_DATABASE_BOOTSTRAP_HANDOFF_V1` and obtain the appropriate production-bootstrap/migration authority before writes.

### PRODUCTION DEPLOYMENT

**NOT authorized by this handoff.**

No ECS/SST/static-site production deployment, production migration, or Meta configuration change is implied by C-01 code acceptance.

---

## Terminal developer code status

```text
C01_CODE_IMPLEMENTATION = ACCEPTED
C01_CLONE_DEVELOPMENT_INTEGRATION = COMPLETE
C01_PRODUCTION_APPLICATION_CODE_INTEGRATION = DEVELOPER_ACTION
C01_PRODUCTION_DATABASE_BOOTSTRAP = SEPARATE_GATE
C01_PRODUCTION_DEPLOYMENT = SEPARATE_GATE
```
