# C-01 — Creator Entry & Onboarding (origin port)

**Reference handoff:** `docs/ai-collaboration/c01-developer-code-integration-handoff-v1.md`  
**Reference closeout:** `docs/ai-collaboration/c01-module-closeout-v1.md`  
**AWS bootstrap (do not execute):** `docs/ai-collaboration/c01-aws-database-bootstrap-handoff-v1.md`  
**Status:** CODE PORTED ON ORIGIN / TYPECHECK+BUILD VERIFIED / SCOPED TESTS PARTIAL / UI SMOKE PENDING

## Clone canonical refs (from clone closeout — reference only)

| Area | Repository | Role | SHA |
|------|------------|------|-----|
| Backend C-01 ancestor | `Piyush1087/creator-commerce-backend-v2-clone` | Pre-C-05 `development` | `8f2a3b3` |
| Frontend C-01 ancestor | `Piyush1087/creator-commerce-frontend-v2-clone` | Accepted C-01 FE | `b50c36f` |
| Backend file checkout | same clone | C-05 `development` (contains C-01) | `4c5f428` |
| Frontend file checkout | `Piyush1087/creator-commerce-frontend-v2-clone` | C-05 runtime = FE `development` | `323658d` |

The C-01 developer handoff also cites code checkpoint `3ec01751`. That SHA was
**not** used as the file source; C-05 heads already include C-01.

## Origin integration branches

| Repo | Branch | Base |
|------|--------|------|
| Backend | `feature/c01-c05-creator-integration` | origin `development` @ `2f03819` |
| Frontend | `feature/c01-c05-creator-integration` | origin `development` @ `f4e6c49` |

Combined with C-05 on purpose. C-05 does not compile without C-01.

## Clone acceptance baselines (clone — not origin)

| Suite | Clone closeout cited |
|-------|----------------------|
| Backend full | 1,103 passed / 166 files |
| Frontend full | 744 passed / 92 files |
| Clone migrations at C-01 | 70 |

Do not copy these into origin result files.

## Product summary (frozen)

```text
ENTRY
→ shared Creator Shop SIGN UP / SIGN IN
→ verified authenticated Creator account
→ mandatory Professional Instagram connection
→ CREATOR_WORKSPACE_ENTRY
```

Campaign origin: Apply issues a continuation cookie only. It does **not** create
an Application.

Also frozen: no handle pre-check, no waitlist, no follower gate, Instagram cannot
be skipped before `canEnterCreatorPlatform`.

## Origin port summary

- New backend: `creator-entry`, `c01-persistence`, `provider-oauth`
- Legacy `creator-onboarding` HTTP retired to **410**
- Google no longer creates Creators from `onboardingTrackId`
- Four additive migrations `20260908120000`–`20260908123000`
- Frontend Entry UI under `src/features/creator-onboarding/`; landing renders `CreatorEntryView`
- Callback remains `/creator-marketplace/callback`
- `CREATOR_INSTAGRAM_REDIRECT_URI` added to origin env/SST only
