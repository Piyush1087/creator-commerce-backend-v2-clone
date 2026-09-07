# C-05 clone refs vs origin port

## Took from clone (path checkout, then reconcile)

- `src/features/creator-settings/` expansion (team/actor/contact/instagram/payouts)
- `src/shared/creator/creator-workspace-actor.contract.ts`
- `src/shared/identity/sterile-provisional-creator.policy.ts`
- `src/shared/team/`
- Thin `creator-payout-profile.module.ts` compatibility module
- Four C-05 migrations listed in the developer handoff
- Frontend actor context, Settings shell, payout-legal feature, Creator nav

## Kept on origin (did not overwrite)

- `brand-escrow.module.ts` / `collaboration-escrow-reserve.service.ts`
- Brand Settings routes and Brand shell items
- Brand Centre / Product Intelligence offering routes
- Collaboration / UCE / payouts hubs
- Origin Settings MVP creator-settings that C-05 now supersedes via compatibility 410 on `POST payouts/bank`

## Schema deltas applied on origin (surgical)

- `CreatorWorkspaceMember.userId` nullable + `CreatorWorkspaceMemberUser`
- Phone fields on `CreatorShippingAddress`
- `CreatorLegalProfile`, `CreatorPayoutDestination`, provider mapping

## Explicit non-actions

| Item | Why |
|------|-----|
| Copy clone `20260828120000_bs03/bs08` | Origin already renamed those to `210` / `220` |
| Claim clone 1,229 / 853 as origin results | Different repo history and extra origin modules |
| KYC / payout execution / live Instagram Settings certification | C-05 freeze excludes them |
| Real PostgreSQL Team lock-contention (5 cases) | Clone closeout: CI/release gate, not local PGlite proof |
