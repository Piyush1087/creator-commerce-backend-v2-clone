# Backend proof files for the §11 suite

| ID | Backend proof |
| --- | --- |
| INV-01 | `src/features/auth/*`, `auth-security.static.test.ts`, `auth-security.postgres.test.ts` |
| INV-02 | Prisma `User` `Organization`; C-01 I1 migrations |
| INV-03 | `src/features/creator-entry/*` |
| INV-04 | `src/features/creator-settings/team/creator-workspace-actor.controller.ts` |
| INV-06 | `src/features/campaign-applications/*`, C-03 snapshot migrations |
| INV-07 | `src/features/collaboration/application-handoff.module.ts` |
| INV-08 | `src/features/brand-escrow/*`, collaboration settlement models — not Brand Payouts v1, not C-06 |
| INV-10 | Instagram/Razorpay/Postmark clients; missing secrets fail closed |
| INV-12 | workspace authorization tests (`brand-workspace-authorization.postgres.test.ts`, C-05 team tests) |
| INV-13 | Prisma duplicates classified in `../14-migration-schema/` |

OUT modules still imported in `src/app.module.ts` are not invariant targets except “must not be required for MVP journeys”.
