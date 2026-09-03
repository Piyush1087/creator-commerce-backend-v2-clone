# C-01 clone refs vs origin port

## Took from clone (path checkout, then reconcile)

- `src/features/creator-entry/`
- `src/features/c01-persistence/`
- `src/features/provider-oauth/`
- Four C-01 migrations listed in the developer handoff
- `scripts/c01-i1-historical-conflict-scan.sql` (for later AWS; not run)
- Creator Entry frontend client/view/platform guard/callback
- Campaign Apply continuation issuance on public marketplace

## Kept on origin (did not overwrite)

- Origin collaboration migrations (8 origin-only; clone never had them)
- `sst.config.ts` except `CREATOR_INSTAGRAM_REDIRECT_URI`
- Shared BS-12 auth already on origin (same filenames as clone)
- `src/features/auth/` wholesale
- `prisma/schema.prisma` wholesale — patched in place
- `ZodValidationPipe` at `src/features/creator-onboarding/pipes/` (still imported by marketplace/centre/co-pilot/instagram)
- Brand Instagram OAuth adapted onto `ProviderOAuthTransaction` instead of deleting Brand flows

## Schema deltas applied on origin (surgical)

- `OrganizationKind`; `Organization.kind`; `CreatorWorkspace.organizationId`
- `ProviderOAuthTransaction` replaces `BrandInstagramOAuthState`
- Creator social provider-health fields
- `CreatorEntryContinuation`
- User kept origin-only `uceCampaignCreators`

## Explicit non-actions

| Item | Why |
|------|-----|
| Merge `piyush/development` | Would drop origin collaboration history and collide Settings migration names |
| Checkout clone `prisma/schema.prisma` | Origin has Brand Centre / PI / collaboration models clone does not |
| Checkout clone `sst.config.ts` | Would drop Gatekeeper, Razorpay Route, Brand Return, Postmark team invite |
| Execute AWS bootstrap handoff | `AWS_PRODUCTION_DB_STATE = UNRESOLVED`; wrong-account risk |
| Run clone `0→70` replay claim | Origin already had 74 migrations before this port |
