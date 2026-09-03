# C-01 / C-05 clone reconcile (backend)

Date: 2026-09-03
Branch: `feature/c01-c05-creator-integration` (from origin `development` @ Settings MVP PR #23)
Frozen source: clone `development` @ `4c5f42858b950b7cd342f8972f99f548f3daa942`
C-01 runtime ancestor: `8f2a3b3acf6b48dc1d5cb4a212a26b9f0755fbbd`
C-05 runtime acceptance: `156d5834266077be7e2b6a2d459bae5489edbbd6`

## Source of truth

- Executable C-01 + C-05 implementation: frozen clone SHA above
- Handoffs: `docs/ai-collaboration/c01-developer-code-integration-handoff-v1.md`,
  `docs/ai-collaboration/c05-developer-code-integration-handoff-v1.md`
- Base on origin `development` (Brand Centre, PI, Settings MVP, collaboration already merged)
- Do **not** merge clone `development` wholesale (clone lacks origin collaboration migration history)

## Integration scope (code port)

- `creator-entry`, `c01-persistence`, `provider-oauth`
- C-05 `creator-settings` expansion (team/actor/contact/instagram/payouts)
- Legacy `creator-onboarding` HTTP retired to 410 compatibility
- Shared provider OAuth adapter in Brand Instagram state service
- Eight additive migrations after `20260907120000_bs12_auth_security`
- Bounded `.env.example` + `sst.config.ts` (`CREATOR_INSTAGRAM_REDIRECT_URI` only)

## Preserve on origin (do not overwrite from clone)

- Origin collaboration migrations and modules
- Gatekeeper / brand-preview / data-extraction / Razorpay Route / Brand Return env
- Product Intelligence v1 slice already on `development`
- `AGENTS.md`, `BRANCHING.md`
- Clone `20260828120000_bs03/bs08` folders (origin already renamed to `210` / `220`)

## Deferred

- AWS production DB discovery / bootstrap
- Production migrate and deploy
- Live Meta OAuth, KYC, payout execution

## Origin audit (not clone closeout)

Clone `c01-*` / `c05-*` files in this folder are reference only. Record origin
test/build results in `docs/handoff-audit/creator/` before any merge. Commands:
`docs/handoff-audit/creator/commands-to-run.md`.
