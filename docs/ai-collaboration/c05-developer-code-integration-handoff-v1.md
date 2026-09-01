# C05_DEVELOPER_CODE_INTEGRATION_HANDOFF_V1

## Status and purpose

`COMPLETE`

This is the developer code-integration handoff for C-05 — Creator Settings. It transfers the accepted clone implementation and its operational constraints to the developer responsible for a later production-repository/runtime integration.

It does **not** authorize production deployment, production or shared-database access, migration execution against persistent data, provider configuration, provider onboarding, KYC, verification, payout execution, settlement, or ledger/reconciliation work.

---

## 1. Frozen Product behavior

C-05 owns the persistent authenticated Creator shell and the canonical Creator Settings platform. It does not own Creator Home/Centre content.

Expanded Creator navigation is exactly:

```text
Home
Campaigns
Collaborations
Creator Center
Payouts
Settings
```

The 390px footer is exactly:

```text
Home
Campaigns
Collaborations
Creator Center
```

Creator Marketplace is out of MVP and is absent from authenticated Creator navigation and visual promotion. Dormant technical Marketplace routes remain compatibility-only.

Settings sections are:

```text
Account & Security
Profile & Contact
Team
Instagram
Payouts & Legal
```

Notifications are deferred. C-05 does not generalize Brand-bound notification persistence.

`CREATOR_WORKSPACE_ENTRY` remains the abstract Product mount. Current `/creator/home` and `/creator/centre` routes do not freeze C-02 Home, Media Kit, Insights, or performance content.

---

## 2. Final clone development authority

Backend repository:

`Piyush1087/creator-commerce-backend-v2-clone`

Final C-05 runtime `development` SHA:

`156d5834266077be7e2b6a2d459bae5489edbbd6`

Frontend repository:

`Piyush1087/creator-commerce-frontend-v2-clone`

Final C-05 runtime `development` SHA:

`323658d4b147b95b5629ff8d91fa90b8fe9077e4`

Both were normal non-force fast-forwards from the exact accepted C-01 heads. Each accepted result was `3` commits ahead, `0` commits behind, with the original `development` head as exact merge base.

Durable C-05 handoff/closeout documents are published separately on backend branch `c05/p4-closeout`, whose parent is the final backend runtime SHA above. Keeping documentation on that branch allows this document to record both final runtime `development` SHAs without moving either runtime tree after acceptance.

---

## 3. Shared shell and Settings architecture

C-05 reuses the Aurora application shell and the Brand/shared Settings platform rather than retaining legacy Creator Settings as authority.

Frontend shell authority:

- `src/layouts/app-shell/AppShell.tsx`
- `src/layouts/app-shell/sidebar-items.ts`
- `src/layouts/app-shell/bottom-nav-items.ts`
- `src/layouts/app-shell/creator-shell-capabilities.ts`
- `src/shared/creator/creator-workspace-actor-context.tsx`
- `src/features/settings/components/creator-settings-shell.tsx`
- `src/features/settings/components/creator-settings-action-guard.tsx`

The shell consumes one actor-context source with `LOADING`, `READY`, and `RECOVERY` states. Workspace destinations fail closed while authority is loading or unavailable; Account & Security remains recoverable. Frontend capability projection keeps navigation truthful, while backend guards remain authorization authority.

Shared account-security UI is reused through `src/features/settings/components/account-security-settings.tsx`. Brand Settings behavior remains covered by regression tests.

---

## 4. Frontend routes

Canonical Creator Settings routes:

- `/creator/settings/account`
- `/creator/settings/profile`
- `/creator/settings/team`
- `/creator/settings/instagram`
- `/creator/settings/payouts`

Compatibility route:

- `/creator/settings/social` redirects to `/creator/settings/instagram`.

Team invitation acceptance uses the shared authenticated/public-entry route constant `AUTH_ROUTES.creatorTeamInvitationAccept` and immediately scrubs invitation material from browser-visible navigation state.

Provider callback authority remains the C-01 callback route `/creator-marketplace/callback`; its pathname is technical compatibility and is not Marketplace Product navigation authority.

---

## 5. Backend routes and principal services

### Actor and Team

- `GET /api/v1/creator/workspace/actor-context`
- `GET /api/v1/creator/settings/team`
- `POST /api/v1/creator/settings/team/invitations`
- `PATCH /api/v1/creator/settings/team/members/:membershipId/role`
- `DELETE /api/v1/creator/settings/team/members/:membershipId`
- `DELETE /api/v1/creator/settings/team/invitations/:invitationId`
- `POST /api/v1/creator/team-invitations/inspect`
- `POST /api/v1/creator/team-invitations/accept`

Principal services:

- `creator-workspace-actor.service.ts`
- `creator-team.service.ts`
- `creator-team-invitations.service.ts`
- `creator-team.policy.ts`

### Profile and contact

- `GET /api/v1/creator/settings/profile`
- `PATCH /api/v1/creator/settings/profile`
- `GET /api/v1/creator/settings/contact`
- `PUT /api/v1/creator/settings/contact`

Principal service: `creator-profile-contact.service.ts`.

### Instagram

- `GET /api/v1/creator/settings/instagram`
- `POST /api/v1/creator/settings/instagram/revalidate`
- `POST /api/v1/creator/settings/instagram/reconnect/authorize`
- `POST /api/v1/creator/settings/instagram/reconnect/complete`
- `DELETE /api/v1/creator/settings/instagram`

Principal service: `instagram/creator-instagram-settings.service.ts`.

### Payout and legal profile

- `GET /api/v1/creator/settings/payouts`
- `PUT /api/v1/creator/settings/payouts/destination`
- `DELETE /api/v1/creator/settings/payouts/destination/:destinationId`
- `PUT /api/v1/creator/settings/payouts/legal-profile`

Principal services:

- `payouts/creator-payout-settings.service.ts`
- `payouts/prisma-creator-payout-settings.repository.ts`

All canonical routes are JWT protected. Team admission and mutation paths use the canonical actor/subject resolver and bounded policy layer.

---

## 6. Creator subject/actor contract

Shared contract: `src/shared/creator/creator-workspace-actor.contract.ts`.

```text
actorUserId
actorMembershipId
actorRole
workspaceId
organizationId
subjectCreatorProfileId
subjectOwnerUserId
allowedActions
```

The authenticated Team member is the **actor**. The canonical Owner CreatorProfile remains the business **subject**. `associatedEmail` is intentionally absent from the contract and is never authorization authority.

Resolver requirements:

- authenticated `User.role=CREATOR` and active auth state;
- one direct active `CreatorWorkspaceMember.userId` match;
- one unambiguous workspace;
- exactly one active Owner;
- Owner membership consistent with the C-01 owner Profile/User/Organization;
- fail closed on absent, ambiguous, inactive, or inconsistent identity.

The only automatic compatibility binding is an existing null-`userId` Owner membership whose canonical `ownerProfile.userId` proves the identity. No email inference or User fabrication is permitted.

---

## 7. Team policy and downstream permission boundary

C-05 roles are `OWNER`, `MANAGER`, and `ASSISTANT`.

Settings authority:

- Owner and Manager receive the canonical C-05 Settings action set.
- Manager cannot mutate the Owner's personal account name.
- Assistant receives no Creator Settings workspace action and cannot view/administer Team, Instagram, payout, or legal Settings.
- Owner cannot be invited, demoted, removed, or transferred through Settings.
- An actor cannot change or remove their own membership.
- Maximum occupancy is five active/pending seats.

Admission persists invitation token hashes only, enforces expiry/replay/cancellation, serializes workspace/identity admission, and requires an existing active Creator User whose canonical normalized email matches the invitation. It never creates a User.

C-05 does **not** define downstream business commands:

- C-03 owns Campaign action policy, Assistant Apply semantics, eligibility, and application state.
- C-04 owns Collaboration/negotiation command policy and business state/UX.
- C-06 owns provider beneficiary provisioning, KYC, verification, transfers, settlement, and ledger/reconciliation.

Downstream modules should consume the actor/subject contract and define their own action sets; they must not infer authority from the broad C-05 Settings actions.

---

## 8. Profile and canonical contact

Editable canonical profile fields:

- Owner personal account name (`User.name`; Owner only);
- Creator display name;
- avatar URL;
- primary region;
- Creator Organization name.

Email remains read-only identity data.

C-05 owns one canonical default shipping/contact record with recipient, international address, structured calling code/national number/E.164 phone, and delivery instructions. The default write is serialized. Historical unstructured phone evidence is not guessed; the legacy writer returns reconciliation-required until it can be safely normalized.

Shipping/contact ownership is Creator Settings authority. Fulfillment-specific shipping behavior remains downstream.

---

## 9. Instagram Settings lifecycle

C-05 exposes the C-01 provider-health model through six truthful lifecycle states:

```text
NOT_CONNECTED
CONNECTED_HEALTHY
REVALIDATION_REQUIRED
RECONNECT_REQUIRED
PROVIDER_BLOCKED_RECOVERABLE
DISCONNECTED_IDENTITY_RETAINED
```

Rules:

- the stable Instagram Professional `user_id` is permanent provider identity;
- handle/display metadata may change and is not identity;
- disconnect revokes authorization but retains the stable identity;
- reconnect is fenced to the same stable provider ID;
- selecting a different account is blocked and requires manual review;
- OAuth state/redirect/generation/initiating actor remain backend-owned;
- Manager initial connect acts as the authenticated Manager but targets the canonical Owner subject;
- Settings remain available during provider recovery.

No Meta configuration or live provider certification occurred during C-05.

---

## 10. Payout destination and legal profile

Supported MVP rail matrix:

| Country       | Currency | Destinations         |
| ------------- | -------- | -------------------- |
| India         | INR      | Bank account, UPI    |
| United States | USD      | Bank account, PayPal |

Canonical models:

- `CreatorLegalProfile`
- `CreatorPayoutDestination`
- `CreatorPayoutDestinationProviderMapping`

Legal profile MVP fields are payee type, legal name, country, address lines, city, state/region, and postal code. PAN, tax identifier, KYC, and verification fields are intentionally absent.

Destination secret material is serialized and encrypted with the shared AES-256-GCM field-encryption utility before persistence in `secretPayloadEncrypted`. The row also records encryption key version and a response-safe `maskedDisplay`. Canonical responses never return account/routing/IFSC/UPI/PayPal secret material.

Every newly configured destination starts `CONFIGURED_UNVERIFIED`. A provider mapping may later hold a provider reference, but C-05 does not provision or verify it. Replacing/disabling destination or changing legal identity invalidates downstream payout readiness through a narrow `COMPATIBILITY_RECONCILIATION_ONLY` port.

---

## 11. Exact migrations

C-05 adds exactly four additive-first migrations:

```text
20260909120000_c05_p0_team_user_identity
20260909121000_c05_p0_contact_phone
20260909122000_c05_p0_legal_profile
20260909123000_c05_p0_payout_destination
```

Accepted repository migration count: `74`.

They add nullable direct Team User identity and indexes, structured phone fields, legal profile, provider-neutral encrypted payout destination/provider mapping, and active-primary/version uniqueness constraints. They contain no `DROP`, `TRUNCATE`, data backfill, or legacy-data promotion.

Do not rename/reorder these migration IDs. Their prefixes are repository ordering identifiers.

---

## 12. Legacy compatibility

Legacy Creator Settings is evidence/compatibility only. `CreatorSettingsController` delegates non-conflicting legacy workspace, Team, social, and shipping shapes to canonical C-05 services.

Important fail-closed behavior:

- unresolved historical Team identity remains unauthorized;
- `associatedEmail` may locate collision/evidence but cannot grant access;
- ambiguous/unstructured legacy phone is not inferred;
- legacy payout/bank secrets are not copied into canonical storage;
- legacy `VERIFIED` does not become canonical verification;
- legacy PAN is not imported;
- `POST /api/v1/creator/settings/payouts/bank` is retired with HTTP `410`.

Compatibility adapters must not regain Product or persistence authority.

---

## 13. Environment implications

Backend runtime requirements already shared with C-01/Brand Settings:

- `SETTINGS_FIELD_ENCRYPTION_KEY` — required for encrypted Settings/provider fields; use a managed 32-byte base64 production secret and a documented rotation/version strategy;
- `CREATOR_INSTAGRAM_REDIRECT_URI` — must be one of the backend allowlisted callback URIs;
- `INSTAGRAM_API_ID` and `INSTAGRAM_APP_SECRET` for separately authorized live Instagram behavior;
- `APP_FRONTEND_URL` or stage-specific frontend URL for Team invitation links;
- normal shared auth/JWT/database/mail configuration.

Frontend production builds require `VITE_API_URL`. The accepted browser artifact was explicitly built with a non-routable fixture origin; the build correctly fails closed when a production-mode API URL is absent.

Never commit secret values. No environment or provider configuration was changed during C-05.

---

## 14. Regression and acceptance evidence

Backend final accepted tree:

- full suite: `184` passed / `44` skipped files;
- tests: `1,229` passed / `610` skipped;
- focused C-05 security matrix: `17/17` files, `124/124` tests;
- production build PASS;
- Prisma validate/generate PASS;
- all `74` migrations replayed from zero against disposable PGlite/PostgreSQL 18.3 compatibility runtime;
- `165` public relations materialized and C-05 indexes/nullable Team identity verified;
- Creator Settings + Creator Entry scoped Nest dependency graph PASS.

Database-gated files remain skipped without an authorized PostgreSQL URL. The five `c05_*` real-PostgreSQL Team lock-contention cases remain an explicit CI gate. The local PGlite socket multiplexer cannot provide trustworthy concurrent Prisma sessions; its protocol failures were classified as harness limitations, not Product passes. Deterministic scheduler tests cover duplicate invitation and seat-cap races and verify `FOR UPDATE` ordering.

Frontend final accepted tree:

- `112/112` files and `853/853` tests PASS;
- typecheck PASS;
- production build PASS, `2,104` modules;
- existing chunk-size advisory only;
- Brand/shared Settings regression retained.

Joint deterministic browser acceptance used Chromium `149.0.7827.0`, local static assets, fully intercepted API fixtures, and no external/provider traffic. It passed 1440px, 768px, and 390px layouts; exact footer/shell navigation; Marketplace absence; fail-closed role/recovery behavior; keyboard open/focus trap/Escape/focus restoration; long international values; masked payout responses and cleared secret fields; all six Instagram lifecycle states; same-ID reconnect; different-ID block; and callback query scrubbing.

---

## 15. Production migration and integration considerations

Before any production action:

1. Freeze the actual production repository and environment identity.
2. Compare its complete migration history and code against the final clone SHAs, not only against a C-05 feature branch.
3. Replay all missing migrations against a fresh/disposable real PostgreSQL instance.
4. Run the five real-PostgreSQL Team concurrency cases.
5. If persistent legacy data exists, obtain separate read-only data authority and produce a reconciliation register before attempting any backfill.
6. Fail closed for unresolved Team identity and ambiguous payout/contact evidence.
7. Configure encryption and callback/frontend origins through authorized secret/configuration workflows.
8. Run full backend/frontend regression and production-like smoke tests.
9. Obtain separate migration, provider, deployment, and production smoke authority.

Do not inspect or transform real persistent data merely because these additive migrations exist.

---

## 16. Rollback considerations

Record pre-integration application and database revisions before deployment.

The repository migrations are additive, so a pre-C-05 application may remain schema-compatible in some cases, but that must be proven against the actual production revision. Do not automatically reverse/drop C-05 columns, tables, indexes, or enums.

Code rollback after canonical Team actors or payout destinations are in use requires compatibility analysis. Preserve encrypted destination rows and unresolved legacy evidence; never decrypt/copy them into legacy plaintext columns. Provider-side rollback is not applicable because C-05 made no provider changes.

---

## 17. Deferred module work

- C-02: Creator Home/Centre, Media Kit, Insights, and performance Product content.
- C-03: Campaign Team actions, Assistant Apply contract, eligibility/application behavior.
- C-04: Collaboration Team commands, negotiation policy, business-state UX.
- C-06: beneficiary onboarding, KYC, verification, transfer, settlement, ledger/reconciliation.
- MVP.v2: KYC/legal verification policy and provider mappings/provisioning.
- Product-deferred Creator notification preferences.
- Real PostgreSQL Team contention gate in an authorized CI/runtime.
- Persistent legacy-data reconciliation only if separately authorized and evidence proves it necessary.

---

## 18. Remaining security and operational debt

- establish production encryption-key custody, rotation, and recovery procedures;
- run the real-PostgreSQL contention suite before release certification;
- conduct separately authorized live Instagram same-ID lifecycle validation;
- maintain C-01 Meta deauthorization/data-deletion compliance follow-ups;
- resolve inherited full-App `NotificationsModule imports[2] undefined` test-harness debt (the C-05 scoped runtime graph passes);
- evaluate inherited React Router future warnings and frontend bundle-size advisory in normal platform maintenance.

These items do not reopen C-05 Product logic or authorize downstream business implementation.
