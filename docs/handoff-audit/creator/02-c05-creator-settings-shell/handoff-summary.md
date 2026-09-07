# C-05 — Creator Settings + persistent Creator shell (origin port)

**Reference handoff:** `docs/ai-collaboration/c05-developer-code-integration-handoff-v1.md`  
**Reference closeout:** `docs/ai-collaboration/c05-module-closeout-v1.md`  
**Reference ledger:** `docs/ai-collaboration/c05-execution-ledger-v1.yaml`  
**Status:** CODE PORTED ON ORIGIN / TYPECHECK+BUILD VERIFIED / SCOPED TESTS PARTIAL / UI SMOKE PENDING

## Clone canonical refs (from clone closeout — reference only)

| Area | Repository | SHA |
|------|------------|-----|
| Backend runtime acceptance | `Piyush1087/creator-commerce-backend-v2-clone` | `156d583` |
| Frontend runtime acceptance | `Piyush1087/creator-commerce-frontend-v2-clone` | `323658d` |
| Backend file checkout | clone `development` | `4c5f428` |

Clone ledger checkpoint SHAs (P0–P4) stay in `c05-execution-ledger-v1.yaml`.
Origin does not re-run that clone program; it ports the accepted runtime tree.

## Origin integration branches

Same combined branch as C-01: `feature/c01-c05-creator-integration`.

## Clone acceptance baselines (clone — not origin)

| Suite | Clone closeout cited |
|-------|----------------------|
| Backend full | 1,229 passed / 610 skipped; 184 passed files / 44 skipped files |
| Backend C-05 security matrix | 17/17 files, 124/124 tests |
| Frontend full | 112 files / 853 tests |
| Clone migrations at C-05 | 74 |

Do not copy these into origin result files.

## Product summary (frozen)

Authenticated Creator nav:

```text
Home / Campaigns / Collaborations / Creator Center / Payouts / Settings
```

390px footer: Home / Campaigns / Collaborations / Creator Center.

Marketplace out of MVP nav; dormant routes stay compatibility-only.

Settings sections: Account & Security, Profile & Contact, Team, Instagram,
Payouts & Legal. Notifications deferred.

## Origin port summary

- C-05 `creator-settings` tree; legacy controller delegates; `POST payouts/bank` → 410
- Actor contract + Team `userId`; legal profile + encrypted payout destination
- Four additive migrations `20260909120000`–`20260909123000`
- Frontend Settings routes: account / profile / team / instagram / payouts
- `/creator/settings/social` redirects to Instagram
- Team invite accept via `AUTH_ROUTES.creatorTeamInvitationAccept`
- `AppShellLayout` wraps `CreatorWorkspaceActorProvider`
- Did **not** overwrite `brand-escrow.module.ts` (keeps `CollaborationEscrowReserveService`)
