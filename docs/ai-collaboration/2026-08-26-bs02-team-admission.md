# BS-02 — Team admission and workspace roles

## Reviewed base and scope

Original BS-02 base: `program/brand-settings-mvp` at
`c8105e9983a13f65f45ee9e6c3d0023941a0bcce`. Stage-B P1 reconciles from the
canonical program head `7d35c0b2f70d9783bace55cf355952ee44b02007`.
Branch: `settings-mvp/bs-02-team-admission`. No database schema or migration change.
BS-07's financial authorization service/contract, Pricing, Escrow, Withdrawal,
Notifications/Slack, Instagram, Data Extraction, and OTP remediation are unchanged.
Settings consumers now require explicit active membership, including the existing
notification caller of the retained, read-only `ensureMembership` method.

## Boundaries

- `BrandSettingsAccessService` delegates to the accepted
  `BrandWorkspaceAuthorizationService`. Authorization never creates/reactivates a member.
- Existing authenticated Settings team endpoints delegate through
  `BrandSettingsService` to `BrandTeamService` and `BrandTeamInvitationsService`.
- `BrandTeamInvitationsController` adds public POST
  `/api/v1/brand/team-invitations/inspect` and `/accept`, throttled at 10 requests
  per minute per endpoint/IP using the existing Throttler. Responses are no-store.
- Team writes lock the existing BrandProfile row in PostgreSQL. Actor role and
  active membership are rechecked inside the transaction. This serializes
  organizational-anchor checks, invitation creation/cancellation, lazy expiry
  and acceptance.
- Admission also takes a transaction-scoped recipient-email advisory lock, so
  two Brands cannot simultaneously associate the same unassigned recipient.
- `AuthService` retains password hashing, JWT signing and the existing response
  shape. Its transaction-user issuance method avoids a second identity system.

## Authority

Owners administer all canonical roles, including other Owners. Finance Admins
administer only non-Owners and cannot assign Owner. Campaign Managers cannot
administer the team. Self-revoke remains prohibited. Owner reduction must retain
a recognized organizational anchor, including during concurrent requests.

## Invitation lifecycle

New invitations use 32 cryptographically random bytes. Only `sha256:<digest>`
is persisted in the existing unbounded text field. New role writes are canonical;
legacy `ADMIN` reads as `BRAND_OWNER`. Existing plaintext tokens remain consumable.
Stored hash representations are rejected as bearer tokens.

Expiry is seven days. Cancellation and natural expiry retain distinct terminal
states. Duplicate active-member emails and unexpired pending
invitations are rejected case-insensitively. The legacy five-seat limit remains;
expired pending rows no longer occupy seats or appear as actionable invitations.

MailService uses the existing Postmark client and sender. Template fields are
`brand_name`, `invited_role`, `expires_at`, and `acceptance_url`. The frontend URL
uses `/brand/team-invitations/accept#token=...`; fragments avoid HTTP access logs.
Link/open tracking is disabled. No raw token or provider payload is logged.

The create transaction waits for provider acceptance. Missing configuration,
provider failure or nonzero provider error rolls back creation; the API does not
report success. This is not a distributed transaction with email: a provider
delivery followed by a database commit failure can yield an unusable link, but
never an active stranded invite reported as dispatched. Transactions time out
after 20 seconds. There is no background retry/outbox or new platform.

Acceptance rechecks pending/unexpired state under lock. It atomically creates or
associates the Brand user, creates/reactivates membership, and changes status to
ACCEPTED. The token determines recipient identity; request email/Brand/role fields
are not accepted. New accounts need a password and receive emailVerifiedAt.
Existing non-Brand or other-organization accounts are rejected. Already active
members retain their current role; a legacy invite cannot overwrite authority.
Signing failure rolls back admission. Replay cannot mutate membership or issue
another session; a client that lost the successful response must sign in.

## Stage-B Team state reconciliation

An Owner-reducing mutation must retain an active Brand-domain Owner. Anchor
recognition reuses the accepted onboarding semantic
`emailDomainMatchesBrandDomain(user.email, BrandProfile.domain)`, including the
accepted corporate-subdomain relationship. External Owners do not satisfy the
minimum unless their own email matches that rule. A malformed domain fails
Owner reduction closed with `TEAM_ANCHOR_AUTHORITY_UNRESOLVED`; removal of the
last resolved anchor fails with `TEAM_ANCHOR_OWNER_REQUIRED`. Mutable
`verificationEmail` is not Team anchor authority.

New cancellation persists `CANCELLED`; natural expiry persists `EXPIRED`.
Existing historical `EXPIRED` rows are not reinterpreted. Overview, General
Team read, creation, inspection, acceptance and cancellation use one lazy expiry
helper under the Brand lock and one captured time boundary. Terminal endpoint
errors are thrown only after the expiry transaction commits. Both Settings read
surfaces add top-level `can_manage_team`: true for Owners and Finance Admins,
false for Campaign Managers.

Historical plaintext-token lookup remains temporarily available as
`LEGACY_SECURITY_COMPATIBILITY`; every new token remains digest-only. Production
inventory is required before any later removal. The pre-production Brand OTP
path can rewrite verification identity state; this is a `CROSS_UNIT_DEPENDENCY`
for BS-12 / Brand verification security reconciliation. BS-02 does not change
OTP, Google, password bootstrap, JWT/session behavior, or Brand claim state.

## Initial Owner and historical rollout

Both `BrandVerificationService.setPasswordAndActivate` and
`AuthService.completeBrandRegistration` call `establishInitialBrandOwner` inside
their activation transaction. Profile/email/Brand user/organization linkage must
match. An existing team prevents arbitrary Owner assignment. Verification/claim
gates remain in place; no additional OTP flow was added.

Historical verified Brands can lack membership because previous activation did
not create one. A controlled data repair is necessary before strict Settings
authorization is deployed to those accounts. No schema migration is justified.

`scripts/reconcile-initial-brand-owners.ts` accepts 1–100 explicitly reviewed
BrandProfile UUIDs, defaults to dry-run, and writes only with `--apply`. Run using
the existing approved runtime environment injection:

```text
npx ts-node scripts/reconcile-initial-brand-owners.ts <reviewed-brand-profile-uuid>
npx ts-node scripts/reconcile-initial-brand-owners.ts --apply <reviewed-brand-profile-uuid>
```

Require a verified BrandProfile, linked Organization and exactly one matching
Brand User by verified email in that Organization. It skips ambiguous records
and every workspace with any membership history, including inactive rows. This
is deliberately more conservative than counting active rows alone: revoked
members must return through a new invitation, not a repair script. Review skips
manually; never run this from an authorization lookup or startup hook. No
historical or production data was repaired during this implementation.

## Configuration and release checks

Configuration references only: `POSTMARK_SERVER_TOKEN`,
`POSTMARK_TEAM_INVITE_TEMPLATE_ID`, `APP_FRONTEND_URL`. Local/dev uses approved
environment injection; production uses the existing approved AWS/runtime secret
mechanism. Configure the template with the documented fields before release.

Run current migrations only on a disposable local PostgreSQL database for tests.
The PostgreSQL suite requires `BS02_DATABASE_TEST=true` and a loopback database
whose name starts with `bs02_`. The Postmark fake calls the real MailService
method without network. Test password/JWT values are generated or synthetic.

```text
npm run prisma:generate
npx prisma validate
npm run db:migrate:deploy
npx vitest run --config vitest.config.ts src/features/brand-settings src/features/brand-centre/brand-workspace-authorization.service.test.ts src/features/brand-uce/services/campaign-reconciliation-authorization.test.ts --maxWorkers=2 --minWorkers=1 --testTimeout=30000
npm run build
npx tsc --project scripts/tsconfig.bs02.json
node scripts/smoke-bs02-team.cjs
git diff --check
```

Run ESLint on changed TypeScript files. The compiled HTTP smoke exercises the
actual public controller, validation pipe, throttler, Prisma acceptance and JWT
issuance; it does not boot unrelated provider subsystems. Do not merge or deploy
as part of this execution unit.
