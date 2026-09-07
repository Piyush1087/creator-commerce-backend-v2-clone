# C-01 checklist vs origin port

Mapped from `c01-developer-code-integration-handoff-v1.md` §15–17.

| Handoff item | Origin status |
|--------------|---------------|
| Freeze production-repo base SHA | Done (`2f03819` / `f4e6c49`) |
| Diff against clone `development`, not only C-01 feature branch | Done (used C-05 heads that contain C-01) |
| Shared auth already on origin | Done (Settings MVP / BS-12) |
| Prisma + missing predecessor migrations in order | Done (8 additive after `bs12_auth_security`; origin 74 → expected 82) |
| C-01 backend module + provider OAuth + continuation | Ported |
| Legacy onboarding HTTP retired | Ported (410) |
| C-01 frontend Entry + callback + platform guard | Ported |
| Env without committing secrets | Bounded `CREATOR_INSTAGRAM_REDIRECT_URI` only |
| Local/disposable migrate + regression | PARTIAL — Prisma/82 migrations VERIFIED; scoped C-01 tests classified in `automated-test-results.md` |
| AWS/DB bootstrap | Deferred; handoff is reference only |
| Production migrate/deploy/smoke | Not authorized |
| Password / OTP / Google / Instagram live smoke | Local UI packet PENDING — `../ui-verification.md`. Live Meta BLOCKED |
| Campaign Apply creates no Application | Ported in code; runtime smoke in `../ui-verification.md` C01-7 |

## Product-visible changes to tell product before merge

- Shared auth + Creator Entry; no handle pre-check; no waitlist
- Instagram mandatory before `canEnterCreatorPlatform`
- Campaign Apply only issues a continuation cookie
- Legacy `/api/v1/creator-onboarding/*` → 410
